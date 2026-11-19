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

  /* Was wartet auf eine Entscheidung? */
  c.offen = () => {
    const out = { stunden: [], urlaub: [], belege: [], lieferscheine: [], material: [], tagelohn: [] };
    for (const i of items) {
      if (i.typ === 'stunden' && i.status === 'offen' && R.freigabe('stunden')) out.stunden.push(i);
      if (i.typ === 'urlaub' && i.status === 'beantragt') out.urlaub.push(i);
      if (i.typ === 'beleg' && (i.status === 'offen' || i.status === 'neu')) out.belege.push(i);
      if (i.typ === 'lieferschein' && i.status === 'neu') out.lieferscheine.push(i);
      if (i.typ === 'material' && i.status === 'offen') out.material.push(i);
      if (i.typ === 'tagelohn' && i.status === 'offen' && R.freigabe('tagelohn')) out.tagelohn.push(i);
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
  neu: ['Neu', 'info'], geprueft: ['Geprüft', 'ok'], erledigt: ['Erledigt', 'ok'], bestellt: ['Bestellt', 'info'],
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
}
