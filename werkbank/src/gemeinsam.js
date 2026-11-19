/* =========================================================================
   Gemeinsame Auswertungen für Büro, App und Vorschau
   Ein "Kontext" bündelt alles, was eine Ansicht braucht.
   ========================================================================= */
function kontext(cfg, items, pid) {
  const R = regeln(cfg);
  const personen = (cfg && cfg.personen) || [];
  const c = {
    cfg, items, R, personen,
    ich: personen.find((p) => p.id === pid) || null,
    heute: Datum.heute(),
    person: (id) => personen.find((p) => p.id === id) || { name: 'Unbekannt', rolle: '', id },
    baustelle: (id) => ((cfg && cfg.baustellen) || []).find((b) => b.id === id),
    bsName: (id) => { const b = c.baustelle(id); return b ? b.name : (id ? '–' : 'ohne Baustelle'); },
    baustellenOffen: () => ((cfg && cfg.baustellen) || []).filter((b) => b.status !== 'fertig'),
    tageloehner: (id) => ((cfg && cfg.tageloehner) || []).find((t) => t.id === id) || { name: 'Unbekannt' },
    arbeiter: () => personen.filter((p) => Number(p.soll) > 0),
    typ: (t) => items.filter((i) => i.typ === t),
    kuerzel: (name) => String(name || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase(),
  };

  c.stundenAm = (pid, datum) => items.filter((i) => i.typ === 'stunden' && i.pid === pid && i.datum === datum);
  c.stundenSumme = (pid, von, bis) => items.filter((i) => i.typ === 'stunden' && i.pid === pid && i.datum >= von && i.datum <= bis).reduce((s, e) => s + stundenVon(e), 0);
  c.laeuft = (pid) => items.find((i) => i.typ === 'stunden' && i.pid === pid && i.status === 'laeuft');
  c.abwesend = (pid, datum) => items.find((i) => (i.typ === 'urlaub' || i.typ === 'krank') && i.pid === pid && i.von <= datum && i.bis >= datum && i.status !== 'abgelehnt');

  c.urlaubstage = (e, jahr) => {
    const von = e.von < `${jahr}-01-01` ? `${jahr}-01-01` : e.von;
    const bis = e.bis > `${jahr}-12-31` ? `${jahr}-12-31` : e.bis;
    return von > bis ? 0 : Datum.werktageZwischen(von, bis);
  };
  c.urlaubKonto = (pid, jahr = Number(c.heute.slice(0, 4))) => {
    const p = c.person(pid);
    const anspruch = Number(p.urlaub) || Number(R.p('urlaub').tage) || 30;
    const eig = items.filter((i) => i.typ === 'urlaub' && i.pid === pid && i.art !== 'Überstundenabbau');
    const genommen = eig.filter((i) => i.status === 'genehmigt').reduce((s, e) => s + c.urlaubstage(e, jahr), 0);
    const beantragt = eig.filter((i) => i.status === 'beantragt').reduce((s, e) => s + c.urlaubstage(e, jahr), 0);
    return { anspruch, genommen, beantragt, rest: anspruch - genommen };
  };

  /* Wochenplan: Eintrag für eine Person an einem Tag (Baustellen-ID, 'S' Schule, 'U' Urlaub) */
  c.planWoche = (montag) => items.find((i) => i.typ === 'plan' && i.montag === montag) || null;
  c.geplant = (pid, datum) => {
    if (!R.plan()) return '';
    const abw = c.abwesend(pid, datum); if (abw) return abw.typ === 'krank' ? 'K' : 'U';
    const w = c.planWoche(Datum.montag(datum)); const t = Datum.wochentag(datum);
    return (w && w.zellen && w.zellen[pid] && w.zellen[pid][t]) || '';
  };
  c.planText = (wert) => ({ '': 'nicht geplant', S: 'Berufsschule', U: 'Urlaub', K: 'krank' }[wert] || c.bsName(wert));

  /* Monatsnachweis: Soll, Ist, Gutschrift für Urlaub und Krankheit */
  c.monatsnachweis = (pid, ym) => {
    const p = c.person(pid); const sollTag = (Number(p.soll) || 0) / 5;
    const [j, m] = ym.split('-').map(Number); const n = new Date(j, m, 0).getDate();
    const tage = []; let soll = 0; let ist = 0; let gut = 0; let urlaub = 0; let krank = 0;
    for (let d = 1; d <= n; d++) {
      const datum = `${ym}-${String(d).padStart(2, '0')}`;
      const eintr = c.stundenAm(pid, datum).filter((e) => e.bis);
      const h = eintr.reduce((s, e) => s + stundenVon(e), 0);
      const arbeitstag = Datum.istArbeitstag(datum);
      const zukunft = datum > c.heute || (datum === c.heute && !eintr.length); // heute zählt erst nach Feierabend
      const abw = arbeitstag ? c.abwesend(pid, datum) : null;
      const abwOk = abw && (abw.typ === 'krank' || abw.status === 'genehmigt') ? abw : null;
      let g = 0;
      if (abwOk && abwOk.art !== 'Überstundenabbau' && !zukunft) { g = sollTag; if (abwOk.typ === 'krank') krank++; else urlaub++; }
      if (arbeitstag && !zukunft) soll += sollTag;
      ist += h; gut += g;
      tage.push({ datum, eintr, h, g, arbeitstag, zukunft, abw: abwOk, feiertag: Datum.feiertag(datum) });
    }
    return { tage, soll, ist, gut, diff: ist + gut - soll, urlaub, krank };
  };
  /* Überstundenkonto: Summe der Monate dieses Jahres ab dem ersten erfassten Monat */
  c.konto = (pid, bisYm) => {
    const eig = items.filter((i) => i.typ === 'stunden' && i.pid === pid && i.datum.slice(0, 4) === bisYm.slice(0, 4));
    if (!eig.length) return 0;
    let ym = eig.reduce((a, e) => (e.datum < a ? e.datum : a), '9999').slice(0, 7); let summe = 0;
    while (ym <= bisYm) { summe += c.monatsnachweis(pid, ym).diff; const [j, m] = ym.split('-').map(Number); ym = Datum.iso(new Date(j, m, 1)).slice(0, 7); }
    return summe;
  };

  /* Was wartet auf eine Entscheidung? */
  c.offen = () => {
    const out = { stunden: [], urlaub: [], belege: [], lieferscheine: [], material: [], tagelohn: [], regie: [] };
    for (const i of items) {
      if (i.typ === 'stunden' && i.status === 'offen' && R.freigabe('stunden')) out.stunden.push(i);
      if (i.typ === 'urlaub' && i.status === 'beantragt') out.urlaub.push(i);
      if (i.typ === 'beleg' && (i.status === 'offen' || i.status === 'neu')) out.belege.push(i);
      if (i.typ === 'lieferschein' && i.status === 'neu') out.lieferscheine.push(i);
      if (i.typ === 'material' && i.status === 'offen') out.material.push(i);
      if (i.typ === 'tagelohn' && i.status === 'offen' && R.freigabe('tagelohn')) out.tagelohn.push(i);
      if (i.typ === 'regie' && i.status !== 'abgerechnet' && R.hat('regie')) out.regie.push(i);
    }
    return out;
  };
  return c;
}

/* Status neuer Einträge je nach Aufbau */
function startStatus(R, typ, e = {}) {
  if (typ === 'stunden') return R.freigabe('stunden') ? 'offen' : 'freigegeben';
  if (typ === 'urlaub') return R.freigabe('urlaub') ? 'beantragt' : 'genehmigt';
  if (typ === 'beleg') return R.freigabe('belege') && Number(e.betrag) >= Number(R.p('belege').grenze) ? 'offen' : 'neu';
  if (typ === 'tagelohn') return R.freigabe('tagelohn') ? 'offen' : 'freigegeben';
  if (typ === 'material') return 'offen';
  if (typ === 'lieferschein') return 'neu';
  return 'neu';
}

const STATUS_TEXT = {
  offen: ['Zu prüfen', 'warn'], laeuft: ['Läuft', 'info'], freigegeben: ['Freigegeben', 'ok'], abgelehnt: ['Abgelehnt', 'bad'],
  beantragt: ['Beantragt', 'warn'], genehmigt: ['Genehmigt', 'ok'], gemeldet: ['Gemeldet', 'info'],
  neu: ['Neu', 'info'], unterschrieben: ['Unterschrieben', 'ok'], abgerechnet: ['Abgerechnet', ''], geprueft: ['Geprüft', 'ok'], erledigt: ['Erledigt', 'ok'], bestellt: ['Bestellt', 'info'],
};
const chip = (status, klasse = 'chip') => { const [t, k] = STATUS_TEXT[status] || [status, '']; return `<span class="${klasse} ${k}">${esc(t)}</span>`; };

/* Bild eines Eintrags auflösen (Musterbild oder gespeicherte Datei) */
async function bildFuer(e) {
  if (!e || !e.datei) return null;
  if (e.datei === 'muster') {
    if (e.typ === 'dokument') return lohnzettelBild(e);
    return musterBild(e.typ === 'lieferschein' ? 'lieferschein' : 'beleg', e);
  }
  return Store.datei(e.datei);
}
/* Fotos und Unterschriften über ihre Datei-ID ("muster-…" sind Beispielbilder) */
function dateiUrl(id) {
  if (!id) return Promise.resolve(null);
  if (id === 'muster-unterschrift') return Promise.resolve(unterschriftMuster());
  if (id.startsWith('muster-')) return Promise.resolve(baustellenFoto(id.slice(7)));
  return Store.datei(id);
}
function unterschriftMuster() {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M20 70c20-40 30-50 35-40s-15 40 0 38 20-45 30-40-5 30 5 32 15-20 25-22 5 18 18 16 20-14 40-12 40 4 80-2" fill="none" stroke="#1d2a4a" stroke-width="3" stroke-linecap="round"/></svg>');
}
function baustellenFoto(art) {
  const himmel = art === 'plane' ? '#9aa3ab' : '#bcd3e6';
  const motiv = {
    sparren: '<rect x="40" y="120" width="260" height="22" fill="#8a6a45"/><rect x="40" y="120" width="90" height="22" fill="#4a3a28"/><path d="M60 125l10 12M80 124l6 14M100 126l8 10" stroke="#2a2016" stroke-width="3"/><rect x="40" y="170" width="260" height="22" fill="#a98557"/>',
    dach: '<path d="M30 200L170 70l140 130z" fill="none" stroke="#b08a58" stroke-width="10"/><path d="M80 154v46M120 117v83M170 70v130M220 117v83M260 154v46" stroke="#b08a58" stroke-width="7"/><rect x="20" y="200" width="300" height="40" fill="#9b9b93"/>',
    plane: '<path d="M30 200L170 80l140 120z" fill="#3a6fb0"/><path d="M60 175h220M95 145h150" stroke="#2c578c" stroke-width="3"/><rect x="20" y="200" width="300" height="40" fill="#8f8f87"/>',
    richtfest: '<path d="M30 200L170 70l140 130z" fill="none" stroke="#b08a58" stroke-width="10"/><path d="M170 70V30" stroke="#5b4a33" stroke-width="5"/><circle cx="170" cy="30" r="16" fill="#3f7a3a"/><path d="M160 46l-12 14M180 46l12 14" stroke="#c23a2b" stroke-width="4"/><rect x="20" y="200" width="300" height="40" fill="#9b9b93"/>',
  }[art] || '';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 240"><rect width="340" height="240" fill="${himmel}"/>${motiv}</svg>`);
}
function lohnzettelBild(e) {
  const p = (Store.cfg && Store.cfg.personen || []).find((x) => x.id === e.fuer) || { name: '' };
  const z = ['Lohnabrechnung', esc(Datum.monatName(e.monat || Datum.heute().slice(0, 7))), '', 'Arbeitnehmer: ' + esc(p.name), 'Steuerklasse I', '', 'Bruttolohn', 'Gesetzl. Abzüge', 'Nettolohn', '', '(Musterdokument)'];
  const t = z.map((s, i) => `<text x="30" y="${50 + i * 26}" font-size="${i === 0 ? 20 : 14}" font-weight="${i === 0 ? 700 : 400}">${s}</text>`).join('');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 460"><rect width="340" height="460" fill="#fff"/><rect x="0" y="0" width="340" height="8" fill="#2f5e4e"/><g font-family="Arial" fill="#222">${t}</g></svg>`);
}
/* Nach dem Zeichnen: alle <img data-eintrag="id"> befüllen */
function bilderNachladen(wurzel, items) {
  $$('img[data-eintrag]', wurzel).forEach(async (img) => {
    const e = items.find((i) => i.id === img.dataset.eintrag);
    const url = await bildFuer(e).catch(() => null);
    if (url && img.isConnected) img.src = url;
  });
  $$('img[data-datei]', wurzel).forEach(async (img) => {
    const url = await dateiUrl(img.dataset.datei).catch(() => null);
    if (url && img.isConnected) img.src = url;
  });
}
