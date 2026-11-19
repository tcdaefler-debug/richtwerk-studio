/* =========================================================================
   Auftragstafel (Büro): jeder Auftrag ist eine Karte, die von links nach
   rechts wandert: Anfrage → Angebot → Auftrag → Baustelle → Rechnung → Bezahlt.
   Karten rücken von selbst weiter, wenn im Angebot, auf der Baustelle oder
   in der Rechnung etwas passiert. Von Hand verschieben geht per Ziehen oder
   mit dem Pfeil auf der Karte (Handy, Tastatur).

   Übergabe an bewährte Programme: Rechnungsliste (CSV) mit E-Rechnungen für
   Buchhaltung und Steuerbüro, Wochenplan als Kalenderdatei (.ics).
   ========================================================================= */
const Uebergabe = (() => {
  const csv = (zeilen) => '\ufeff' + zeilen.map((z) => z.map((v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');
  const dez = (n) => Number(n || 0).toFixed(2).replace('.', ',');
  const dt = (iso) => (iso ? `${Datum.kurz(iso)}${iso.slice(0, 4)}` : '');

  function rechnungsZeilen(c, liste) {
    const z = [['Rechnungsnummer', 'Rechnungsdatum', 'Faellig', 'Kunde', 'Kundenart', 'Betreff', 'Netto', 'USt-Satz', 'USt', 'Brutto', 'Status', 'Bezahlt am', 'Angebot']];
    liste.forEach((r) => { const m = Auftraege.mwstVon(c, r); const s = Auftraege.summen(r, m); z.push([r.nr, dt(r.datum), dt(r.faellig), r.kunde, r.kundenart === 'gewerblich' ? 'Firma' : 'Privat', r.betreff, dez(s.netto), m, dez(s.steuer), dez(s.brutto), { gestellt: 'offen', bezahlt: 'bezahlt', storniert: 'storniert' }[r.status] || r.status, dt(r.bezahltAm), r.angebotNr || '']); });
    return z;
  }
  const gestellte = (c, filter = () => true) => c.typ('rechnung').filter((r) => r.nr && r.status !== 'entwurf').filter(filter).sort((a, b) => a.nr.localeCompare(b.nr));

  /* In einen ZIP-Ordner: Liste + eine E-Rechnung je Rechnung */
  function rechnungenInZip(c, ordner, filter) {
    const liste = gestellte(c, filter); if (!liste.length) return 0;
    ordner.file('Ausgangsrechnungen.csv', csv(rechnungsZeilen(c, liste)));
    if (c.R.p('rechnungen').erechnung !== 'aus') { const x = ordner.folder('E-Rechnungen'); liste.filter((r) => r.status !== 'storniert').forEach((r) => x.file(`${r.nr}_XRechnung.xml`, Auftraege.xrechnung(c, r))); }
    return liste.length;
  }

  async function buchhaltungsPaket(c, von, bis) {
    if (!window.JSZip) return meldung('Das ZIP-Werkzeug konnte nicht geladen werden (keine Internetverbindung?).', 'fehler');
    const zip = new JSZip(); const n = rechnungenInZip(c, zip, (r) => r.datum >= von && r.datum <= bis);
    if (!n) return meldung('In diesem Zeitraum gibt es keine gestellten Rechnungen.', 'fehler');
    zip.file('LIESMICH.txt', `Ausgangsrechnungen ${c.cfg.name}, ${dt(von)} bis ${dt(bis)}\r\n\r\nAusgangsrechnungen.csv: eine Zeile je Rechnung, Trennzeichen Semikolon, Beträge mit Komma.\r\nE-Rechnungen: je Rechnung eine XRechnung-Datei (UBL). Buchhaltungsprogramme und das Steuerbüro können sie einlesen.\r\n`);
    const blob = await zip.generateAsync({ type: 'blob' });
    speichern(`Rechnungen_${c.cfg.kennung || 'betrieb'}_${von}_${bis}.zip`, blob);
    meldung(`${n} Rechnungen exportiert`);
  }

  /* Wochenplan als Kalenderdatei: ein ganztägiger Termin je Baustelle und Tag */
  function planIcs(c, montag) {
    const w = c.planWoche(montag); const n = Number(c.R.p('wochenplan').tage) || 5;
    const stempel = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const t = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const ereignisse = [];
    for (let i = 0; i < n; i++) {
      const d = Datum.plus(montag, i);
      c.baustellenOffen().forEach((b) => {
        const leute = c.arbeiter().filter((p) => !c.abwesend(p.id, d) && w && w.zellen && w.zellen[p.id] && w.zellen[p.id][i] === b.id);
        if (!leute.length) return;
        const tag = d.replace(/-/g, ''); const naechster = Datum.plus(d, 1).replace(/-/g, '');
        ereignisse.push(['BEGIN:VEVENT', `UID:${b.id}-${tag}@${c.cfg.kennung || 'richtwerk'}`, `DTSTAMP:${stempel}`, `DTSTART;VALUE=DATE:${tag}`, `DTEND;VALUE=DATE:${naechster}`,
          `SUMMARY:${t(b.name)}: ${t(leute.map((p) => p.name.split(' ')[0]).join(', '))}`, `LOCATION:${t(b.adresse || b.ort)}`, `DESCRIPTION:${t([b.arbeit, b.kunde && 'Kunde: ' + b.kunde, b.telefon && 'Tel. ' + b.telefon, b.notiz].filter(Boolean).join('\n'))}`, 'END:VEVENT'].join('\r\n'));
      });
    }
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${t(c.cfg.name)}//Wochenplan//DE`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:Wochenplan ${t(c.cfg.name)}`, ...ereignisse, 'END:VCALENDAR', ''].join('\r\n');
  }

  return { rechnungenInZip, buchhaltungsPaket, planIcs, gestellte };
})();

const Tafel = (() => {
  const { seitenkopf, leer } = Buero.teile;
  const STUFEN = ['anfrage', 'angebot', 'auftrag', 'baustelle', 'rechnung', 'bezahlt'];
  const spaltenNamen = (c) => { const n = c.R.liste('tafel', 'spalten'); const std = ['Anfrage', 'Angebot', 'Auftrag', 'Auf der Baustelle', 'Rechnung', 'Bezahlt']; return std.map((s, i) => n[i] || s); };

  /* Alle Karten: eigene Vorgänge (Anfragen) plus Angebote und Rechnungen, die noch keinen Vorgang haben */
  function karten(c) {
    const vorgaenge = c.typ('vorgang').filter((v) => !v.archiv);
    const angeboteMitV = new Set(vorgaenge.map((v) => v.angebot).filter(Boolean));
    const rechnungenMitV = new Set();
    const out = vorgaenge.map((v) => ({ v, id: v.id, angebot: c.items.find((i) => i.id === v.angebot), bs: v.bs }));
    c.typ('angebot').filter((a) => !angeboteMitV.has(a.id) && a.status !== 'abgelehnt').forEach((a) => out.push({ id: 'a:' + a.id, angebot: a, bs: a.bs }));
    out.forEach((k) => {
      const a = k.angebot; k.bs = k.bs || (a && a.bs) || '';
      k.rechnung = c.typ('rechnung').filter((r) => r.status !== 'storniert' && ((a && r.angebot === a.id) || (k.v && r.id === k.v.rechnung))).sort((x, y) => (x.status === 'bezahlt') - (y.status === 'bezahlt'))[0];
      if (k.rechnung) rechnungenMitV.add(k.rechnung.id);
    });
    c.typ('rechnung').filter((r) => !rechnungenMitV.has(r.id) && r.status !== 'storniert').forEach((r) => out.push({ id: 'r:' + r.id, rechnung: r, bs: r.bs }));
    out.forEach((k) => { k.auto = automatisch(c, k); k.stufe = Math.max(k.auto, k.v ? STUFEN.indexOf(k.v.spalte) : 0); });
    return out;
  }
  /* Wie weit ist der Auftrag laut Angebot, Baustelle und Rechnung? */
  function automatisch(c, k) {
    const r = k.rechnung; const a = k.angebot; const b = k.bs && c.baustelle(k.bs);
    if (r && r.status === 'bezahlt') return 5;
    if (r && r.status === 'gestellt') return 4;
    if (b && (b.status === 'laufend' || b.status === 'fertig') && c.typ('stunden').some((s) => s.bs === b.id)) return 3;
    if (a && a.status === 'angenommen') return 2;
    if (a) return 1;
    return 0;
  }
  const kunde = (k) => (k.v && k.v.kunde) || (k.angebot && k.angebot.kunde) || (k.rechnung && k.rechnung.kunde) || '';
  const titel = (k) => (k.v && k.v.titel) || (k.angebot && k.angebot.betreff) || (k.rechnung && k.rechnung.betreff) || 'Ohne Titel';

  function karteHtml(c, k, namen) {
    const doc = k.rechnung || k.angebot; const betrag = doc ? Auftraege.summen(doc, Auftraege.mwstVon(c, doc)).netto : 0;
    const chips = [];
    if (k.angebot && Auftraege.offeneFragen(k.angebot).length) chips.push('<span class="chip warn">Kundenfrage</span>');
    if (k.angebot && k.angebot.angenommenOnline && k.stufe === 2) chips.push('<span class="chip ok">online angenommen</span>');
    if (k.rechnung && Auftraege.ueberfaellig(c, k.rechnung)) chips.push('<span class="chip bad">überfällig</span>');
    if (k.stufe === 1 && k.angebot && k.angebot.status === 'entwurf') chips.push('<span class="chip">Entwurf</span>');
    if (k.v && k.v.termin) chips.push(`<span class="chip info">${Icon('kalender')} ${Datum.kurz(k.v.termin)}</span>`);
    const links = [];
    if (k.angebot) links.push(`<button class="t-link" data-a="angebot" data-id="${k.angebot.id}">${Icon('angebot')} ${esc(k.angebot.nr || 'Angebot')}</button>`);
    else if (k.v && c.R.hat('angebote')) links.push(`<button class="t-link" data-a="tafel-angebot" data-id="${k.id}">${Icon('plus')} Angebot schreiben</button>`);
    if (k.bs && c.baustelle(k.bs)) links.push(`<button class="t-link" data-a="akte" data-id="${k.bs}">${Icon('karte')} Akte</button>`);
    if (k.rechnung) links.push(`<button class="t-link" data-a="rechnung" data-id="${k.rechnung.id}">${Icon('rechnung')} ${esc(k.rechnung.nr || 'Entwurf')}</button>`);
    return `<article class="t-karte" draggable="true" data-karte="${k.id}" tabindex="0" aria-label="${esc(kunde(k))}: ${esc(titel(k))}, ${esc(namen[k.stufe])}">
      <div class="t-oben"><b>${esc(kunde(k) || 'Neuer Kunde')}</b>${betrag ? `<span class="num">${Zahl.eur(betrag)}</span>` : ''}</div>
      <p>${esc(titel(k))}</p>
      ${k.v && k.v.notiz && k.stufe === 0 ? `<small>${esc(k.v.notiz)}</small>` : ''}
      ${chips.length ? `<div class="t-chips">${chips.join('')}</div>` : ''}
      <div class="t-unten"><div class="t-links">${links.join('')}</div>
        <span class="t-pfeile">${k.v && k.stufe > k.auto ? `<button class="k klein" data-a="tafel-schieben" data-id="${k.id}" data-wohin="-1" aria-label="Eine Spalte zurück">${Icon('zurueck')}</button>` : ''}${k.stufe < 5 ? `<button class="k klein" data-a="tafel-schieben" data-id="${k.id}" data-wohin="1" aria-label="Eine Spalte weiter">${Icon('pfeil')}</button>` : ''}</span></div>
    </article>`;
  }

  function seite(c) {
    const alle = karten(c); const namen = spaltenNamen(c);
    const grenze = Datum.plus(c.heute, -Number(c.R.p('tafel').bezahltTage || 30));
    const sichtbar = alle.filter((k) => k.stufe < 5 || !k.rechnung || (k.rechnung.bezahltAm || c.heute) >= grenze);
    const spalten = STUFEN.map((s, i) => {
      const hier = sichtbar.filter((k) => k.stufe === i).sort((a, b) => kunde(a).localeCompare(kunde(b)));
      const summe = hier.reduce((x, k) => { const d = k.rechnung || k.angebot; return x + (d ? Auftraege.summen(d, Auftraege.mwstVon(c, d)).netto : 0); }, 0);
      return `<section class="t-spalte" data-spalte="${i}" aria-label="${esc(namen[i])}">
        <header><b>${esc(namen[i])}</b><span class="t-zahl">${hier.length}</span>${summe ? `<small class="num">${Zahl.eur(summe)}</small>` : ''}</header>
        <div class="t-liste">${hier.map((k) => karteHtml(c, k, namen)).join('') || '<div class="t-leer">Karte hierher ziehen</div>'}</div>
        ${i === 0 ? `<button class="t-neu" data-a="tafel-neu">${Icon('plus')} Anfrage</button>` : ''}
      </section>`;
    }).join('');
    return seitenkopf(esc(c.R.name('tafel')), 'Jeder Auftrag eine Karte. Sie rückt von selbst weiter, wenn Angebot, Baustelle oder Rechnung sich ändern.', `<button class="k haupt" data-a="tafel-neu">${Icon('plus')} Neue Anfrage</button>`)
      + `<div class="tafel">${spalten}</div>`;
  }

  function anfrageFenster(c, v = {}) {
    Fenster.oeffne({
      titel: v.id ? 'Anfrage bearbeiten' : 'Neue Anfrage', bereich: 'ui-buero-fenster',
      inhalt: `<div class="reihe"><label class="feld"><span>Kunde</span><input name="kunde" value="${esc(v.kunde || '')}" placeholder="Name oder Firma"></label><label class="feld"><span>Telefon</span><input name="telefon" type="tel" value="${esc(v.telefon || '')}"></label></div>
        <div class="reihe"><label class="feld"><span>Was soll gemacht werden?</span><input name="titel" value="${esc(v.titel || '')}" placeholder="z. B. Carport 6 x 3 m"></label><label class="feld"><span>Besichtigung (optional)</span><input name="termin" type="date" value="${esc(v.termin || '')}"></label></div>
        <label class="feld"><span>Anschrift (Straße, PLZ Ort)</span><textarea name="adresse" rows="2">${esc(v.adresse || '')}</textarea></label>
        <label class="feld"><span>Notiz</span><input name="notiz" value="${esc(v.notiz || '')}" placeholder="z. B. kam über Empfehlung Gerdes"></label>`,
      fuss: `${v.id ? '<button class="k nein" data-f="weg" style="margin-right:auto">Karte entfernen</button>' : '<span style="margin-right:auto"></span>'}<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: {
        ok: (b, hg) => {
          const w = Fenster.werte(hg); if (!w.kunde.trim()) return meldung('Bitte einen Kunden eintragen.', 'fehler');
          const daten = { kunde: w.kunde.trim(), telefon: w.telefon.trim(), titel: w.titel.trim(), termin: w.termin, adresse: w.adresse.trim(), notiz: w.notiz.trim() };
          if (v.id) Store.aendere(v.id, daten); else Store.neu({ typ: 'vorgang', spalte: 'anfrage', datum: c.heute, ...daten });
          Fenster.schliesse(); meldung('Gespeichert');
        },
        weg: (b) => { if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich entfernen?'; return; } Store.aendere(v.id, { archiv: true }); Fenster.schliesse(); },
      },
    });
  }

  /* Karte verschieben. Nach vorn geht immer, zurück nur so weit, wie Angebot und Rechnung es zulassen. */
  async function schieben(c, kid, ziel) {
    const k = karten(c).find((x) => x.id === kid); if (!k || ziel === k.stufe) return;
    if (ziel < k.auto) return meldung(`Das geht nicht zurück: ${k.auto >= 4 ? 'die Rechnung ist schon gestellt' : k.auto === 3 ? 'auf der Baustelle wurde schon gearbeitet' : k.auto === 2 ? 'das Angebot ist angenommen' : 'es gibt schon ein Angebot'}.`, 'fehler');
    let vid = k.v && k.v.id;
    if (!vid) vid = await Store.neu({ typ: 'vorgang', spalte: STUFEN[ziel], datum: c.heute, kunde: kunde(k), titel: titel(k), angebot: k.angebot ? k.angebot.id : '', rechnung: k.rechnung ? k.rechnung.id : '', bs: k.bs || '' });
    else Store.aendere(vid, { spalte: STUFEN[ziel] });
    if (ziel === 2 && k.angebot && ['entwurf', 'gesendet'].includes(k.angebot.status)) {
      const patch = { status: 'angenommen', entschieden: Date.now() };
      if (!k.angebot.bs && c.R.an('angebote', 'baustelleAnlegen')) { patch.bs = Auftraege.baustelleAusAngebot(k.angebot); Store.aendere(vid, { bs: patch.bs }); }
      Store.aendere(k.angebot.id, patch); meldung(`Angebot ${k.angebot.nr} als angenommen markiert${patch.bs ? ', Baustelle angelegt' : ''}.`);
    } else if (ziel === 1 && !k.angebot && c.R.hat('angebote')) {
      neuesAngebot(c, { ...k.v, id: vid });
    } else if (ziel === 3 && k.bs && c.baustelle(k.bs) && c.baustelle(k.bs).status === 'geplant') {
      Store.speichereCfg({ ...Store.cfg, baustellen: Store.cfg.baustellen.map((b) => (b.id === k.bs ? { ...b, status: 'laufend' } : b)) }); meldung('Baustelle läuft');
    } else if (ziel === 4 && !k.rechnung) {
      meldung('Rechnung erstellen: Öffnen Sie das Angebot und klicken Sie auf „Rechnung erstellen“.');
    } else if (ziel === 5 && k.rechnung && k.rechnung.status === 'gestellt') {
      Store.aendere(k.rechnung.id, { status: 'bezahlt', bezahltAm: c.heute }); meldung(`Rechnung ${k.rechnung.nr} als bezahlt markiert`);
    }
  }
  async function neuesAngebot(c, v) {
    const id = Store.uid('d');
    const a = { id, typ: 'angebot', status: 'entwurf', kunde: v.kunde, adresse: v.adresse || '', betreff: v.titel || '', kundenart: 'privat', telefon: v.telefon || '', positionen: [{ text: '', menge: 1, einheit: 'm²', preis: '' }] };
    // Nummer, Datum, Gültigkeit vergibt der Editor beim ersten Speichern, dann hängt er das Angebot an die Karte
    Auftraege.editor(c, { ...a, id: undefined, _vorgang: v.id, _id: id });
  }

  /* Ziehen und Ablegen */
  let gezogen = null;
  document.addEventListener('dragstart', (e) => { const k = e.target.closest && e.target.closest('.t-karte'); if (!k) return; gezogen = k.dataset.karte; k.classList.add('zieht'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', gezogen); } catch { /* alt */ } });
  document.addEventListener('dragend', () => { gezogen = null; $$('.t-karte.zieht, .t-spalte.ueber').forEach((x) => x.classList.remove('zieht', 'ueber')); });
  document.addEventListener('dragover', (e) => { const s = e.target.closest && e.target.closest('.t-spalte'); if (!s || !gezogen) return; e.preventDefault(); $$('.t-spalte.ueber').forEach((x) => x !== s && x.classList.remove('ueber')); s.classList.add('ueber'); });
  document.addEventListener('drop', (e) => { const s = e.target.closest && e.target.closest('.t-spalte'); if (!s || !gezogen) return; e.preventDefault(); const kid = gezogen; gezogen = null; s.classList.remove('ueber'); schieben(ctxNeu(), kid, Number(s.dataset.spalte)); });
  const ctxNeu = () => kontext(Store.cfg, Store.items, (Sitzung.lies('buero') || {}).pid);

  Buero.erweitern({
    nav: [{ id: 'tafel', name: 'Auftragstafel', icon: 'plan', braucht: 'tafel', gruppe: 'Aufträge', zahl: (o, c) => c.typ('vorgang').filter((v) => !v.archiv && v.spalte === 'anfrage' && !v.angebot).length }],
    seiten: { tafel: seite },
    aktionen: {
      'tafel-neu'(el, c) { anfrageFenster(c); },
      'tafel-schieben'(el, c) { const k = karten(c).find((x) => x.id === el.dataset.id); if (k) schieben(c, k.id, k.stufe + Number(el.dataset.wohin)); },
      'tafel-angebot'(el, c) { const v = c.items.find((i) => i.id === el.dataset.id); if (v) neuesAngebot(c, v); },
    },
  });
  // Doppelklick auf eine Anfrage öffnet sie
  document.addEventListener('dblclick', (e) => { const k = e.target.closest && e.target.closest('.t-karte'); if (!k) return; const c = ctxNeu(); const v = c.items.find((i) => i.id === k.dataset.karte); if (v && v.typ === 'vorgang') anfrageFenster(c, v); });

  return { karten };
})();
