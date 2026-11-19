/* =========================================================================
   Angebot online annehmen (Seite für den Kunden des Betriebs)
   #angebot/<betrieb>/<angebot>/<schlüssel>
   Links: Überblick, Haken (AGB, Widerruf, Datenschutz), Unterschrift,
          verbindliche Annahme oder eine Frage ans Büro.
   Rechts: das Angebot so, wie es gedruckt aussieht.
   Was der Kunde hier tut, steht sofort in der Betriebszentrale.
   ========================================================================= */
/* Rechtliche Texte: vorhanden und sichtbar, aber Muster. Vor dem echten Einsatz prüfen lassen. */
const RECHT_TITEL = { agb: 'Allgemeine Geschäftsbedingungen', widerruf: 'Widerrufsbelehrung', datenschutz: 'Datenschutzhinweis', impressum: 'Impressum' };
function rechtText(c, was) {
  const P = c.R.p('angebote'); const f = c.cfg;
  if (was === 'impressum') return [`Angaben gemäß § 5 DDG`, `${f.name}${f.inhaber ? `\nInhaber: ${f.inhaber}` : ''}`, [f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join('\n'), [f.telefon && 'Telefon: ' + f.telefon, f.email && 'E-Mail: ' + f.email].filter(Boolean).join('\n'), f.ustid ? 'Umsatzsteuer-Identifikationsnummer: ' + f.ustid : '', 'Zuständige Handwerkskammer: [bitte ergänzen]\nEintragung in die Handwerksrolle: [bitte ergänzen]\nBerufshaftpflichtversicherung: [Versicherer und Geltungsbereich ergänzen]', 'Verbraucherstreitbeilegung: Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'].filter(Boolean).join('\n\n');
  return { agb: P.agb, widerruf: P.widerrufText, datenschutz: P.datenschutz }[was] || '';
}

Buero.erweitern({
  einstellungen: (c) => `<div class="karte"><div class="kopf"><h3>Rechtliche Texte</h3><span class="chip warn">Muster, vor Einsatz prüfen</span></div><div class="koerper recht-knoepfe">
    <p style="margin:0 0 12px;color:#5f6862">Diese Texte erscheinen auf Angeboten und auf der Seite, auf der Ihre Kunden online annehmen. Richtwerk pflegt sie für Sie ein. Die Muster ersetzen keine Rechtsberatung.</p>
    ${Object.entries(RECHT_TITEL).map(([k, t]) => `<button class="k" data-a="recht" data-id="${k}">${Icon('paragraph')} ${t}</button>`).join(' ')}</div></div>`,
  aktionen: { recht(el) { KundenSeite.lesen(el.dataset.id); } },
});

const KundenSeite = (() => {
  let leer = true;

  function warteAufDaten(fid, id) {
    return new Promise((fertig) => {
      Store.oeffne(fid);
      const pruefe = () => Store.cfg && Store.items.some((i) => i.id === id);
      if (pruefe()) return fertig(true);
      const ab = Store.abonniere(() => { if (pruefe()) { ab(); clearTimeout(t); fertig(true); } });
      const t = setTimeout(() => { ab(); fertig(pruefe()); }, 6000);
    });
  }

  async function start(ziel) {
    const [, fid, id, schluessel] = ziel.split('/');
    document.body.className = 'kunde-modus';
    Wurzel().innerHTML = `<div class="laden"><div>Angebot wird geladen<div class="balken"><i></i></div></div></div>`;
    const da = await warteAufDaten(fid, id);
    const a = da && Store.items.find((i) => i.id === id);
    if (!a || a.typ !== 'angebot' || !a.schluessel || a.schluessel !== schluessel) return hinweis('Dieses Angebot wurde nicht gefunden', 'Der Link ist unvollständig oder nicht mehr gültig. Bitte wenden Sie sich an den Betrieb, von dem Sie den Link bekommen haben.');
    Store.setzeBenutzer('kunde');
    zeichne(id);
  }

  function hinweis(titel, text) {
    Wurzel().innerHTML = `<div class="kd-leer"><h1>${esc(titel)}</h1><p>${esc(text)}</p></div>`;
  }

  const ctx = () => kontext(Store.cfg, Store.items, null);
  const datum = (iso) => `${Datum.kurz(iso)}${iso.slice(0, 4)}`;

  function zeichne(id) {
    const c = ctx(); const a = Store.items.find((i) => i.id === id); const f = c.cfg;
    const P = c.R.p('angebote'); const s = Auftraege.summen(a, Auftraege.mwstVon(c, a)); const mwst = Auftraege.mwstVon(c, a);
    document.documentElement.style.setProperty('--firma', f.farbe || '#2f5e4e');
    document.title = `Angebot ${a.nr} · ${f.name}`;
    const privat = a.kundenart !== 'gewerblich';
    const widerruf = !privat || P.widerruf === 'nicht anzeigen' ? '' : P.widerruf === 'Ausschluss Maßanfertigung' ? 'massanfertigung' : 'belehrung';
    const mitAgb = String(P.agb || '').trim() !== '';
    const abgelaufen = a.status === 'gesendet' && a.gueltigBis && a.gueltigBis < c.heute;
    const online = c.R.an('angebote', 'onlineAnnahme');

    let links;
    if (a.status === 'angenommen') {
      const o = a.angenommenOnline;
      links = `<div class="kd-fertig">${Icon('haken')}<h2>Vielen Dank für Ihren Auftrag!</h2>
        <p>${o ? `Sie haben das Angebot am ${datum(Datum.iso(new Date(o.wann)))} verbindlich angenommen.` : 'Dieses Angebot ist angenommen.'} Wir melden uns in den nächsten Tagen bei Ihnen, um den Termin abzustimmen.</p>
        ${c.R.an('angebote', 'bestaetigung') ? `<button class="kd-knopf" data-k="bestaetigung">${Icon('drucken')} Auftragsbestätigung drucken oder als PDF speichern</button>` : ''}
        <p class="kd-klein">Fragen? ${f.telefon ? `Telefon <a href="tel:${esc(f.telefon.replace(/\s+/g, ''))}">${esc(f.telefon)}</a>` : ''}${f.telefon && f.email ? ' · ' : ''}${f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : ''}</p></div>`;
    } else if (a.status === 'abgelehnt' || a.status === 'storniert' || !online) {
      links = `<div class="kd-fertig neutral"><h2>Dieses Angebot ist nicht mehr offen</h2><p>Bitte sprechen Sie uns an, wenn Sie den Auftrag doch vergeben möchten. Wir erstellen Ihnen gern ein neues Angebot.</p></div>`;
    } else {
      const haken = (name, text) => `<label class="kd-haken"><input type="checkbox" name="${name}"><span>${text}</span></label>`;
      links = `
        <form id="kd-annahme" autocomplete="off">
          ${abgelaufen ? `<p class="kd-warn">Die Annahmefrist ist am ${datum(a.gueltigBis)} abgelaufen. Bitte rufen Sie uns kurz an, damit wir Preise und Termin bestätigen können.</p>` : ''}
          <fieldset ${abgelaufen ? 'disabled' : ''}>
          ${mitAgb ? haken('agb', `Ich habe die <button type="button" class="kd-link" data-k="lesen" data-id="agb">Allgemeinen Geschäftsbedingungen</button> gelesen und akzeptiere sie. Ich kann sie speichern und ausdrucken.`) : ''}
          ${widerruf === 'massanfertigung' ? haken('widerruf', `Mir ist bekannt, dass es sich um eine Anfertigung nach meinen Maßen und Wünschen handelt und ein Widerrufsrecht nach § 312g Abs. 2 Nr. 1 BGB nicht besteht. <button type="button" class="kd-link" data-k="lesen" data-id="widerruf">Widerrufsbelehrung</button>`) : ''}
          ${widerruf === 'belehrung' ? haken('widerruf', `Ich habe die <button type="button" class="kd-link" data-k="lesen" data-id="widerruf">Widerrufsbelehrung</button> zur Kenntnis genommen.`) : ''}
          ${widerruf === 'belehrung' ? `<label class="kd-haken frei"><input type="checkbox" name="beginn"><span>Optional: Ich verlange ausdrücklich, dass Sie schon vor Ende der 14-tägigen Widerrufsfrist mit den Arbeiten beginnen. Mir ist bekannt, dass ich bei einem Widerruf die bis dahin erbrachten Leistungen bezahlen muss.</span></label>` : ''}
          ${haken('datenschutz', `Ich habe den <button type="button" class="kd-link" data-k="lesen" data-id="datenschutz">Datenschutzhinweis</button> gelesen.`)}
          ${c.R.an('angebote', 'unterschriftOnline') ? `<div class="kd-feld"><span>Ihre Unterschrift</span><div class="unterschrift-feld kd-unterschrift"><canvas id="kd-canvas" aria-label="Hier mit Finger oder Maus unterschreiben"></canvas><span class="linie">Hier mit Finger oder Maus unterschreiben</span><button type="button" data-k="neu-zeichnen">Neu zeichnen</button></div></div>` : ''}
          <label class="kd-feld"><span>Vor- und Nachname</span><input name="name" autocomplete="name" value=""></label>
          <p class="kd-recht">Mit Klick auf „Zahlungspflichtig annehmen“ nehmen Sie das Angebot Nr. ${esc(a.nr)} vom ${datum(a.datum)} verbindlich an. Gesamtpreis: <b>${Zahl.eur(s.brutto)}</b> inkl. ${mwst} % USt. Danach erhalten Sie eine Auftragsbestätigung.</p>
          <button class="kd-knopf voll" type="submit">Zahlungspflichtig annehmen</button>
          </fieldset>
        </form>
        ${c.R.an('angebote', 'fragen') ? `<details class="kd-frage" ${abgelaufen ? 'open' : ''}><summary>Ich habe noch eine Frage zum Angebot</summary>
          <form id="kd-frage"><label class="kd-feld"><span>Woran hakt es noch?</span><textarea name="text" rows="4" placeholder="z. B. Geht es auch mit Lärche statt Douglasie?"></textarea></label>
          <label class="kd-feld"><span>Rückruf unter (optional)</span><input name="telefon" type="tel" autocomplete="tel"></label>
          <button class="kd-knopf" type="submit">Frage senden</button></form></details>` : ''}`;
    }

    Wurzel().innerHTML = `<div class="kd">
      <header class="kd-kopf"><div class="kd-firma"><span class="kd-zeichen">${esc((f.kuerzel || f.name || '?').slice(0, 2))}</span><div><b>${esc(f.name)}</b><small>${esc([f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</small></div></div>
        <button class="kd-knopf rand" data-k="drucken">${Icon('drucken')} Drucken / PDF</button></header>
      <div class="kd-raster">
        <aside class="kd-links">
          <h1>Ihr Angebot von ${esc(f.name)}</h1>
          <dl class="kd-uebersicht">
            <dt>Angebot-Nr.</dt><dd>${esc(a.nr)}</dd>
            <dt>Für</dt><dd>${esc(a.kunde)}</dd>
            ${a.betreff ? `<dt>Leistung</dt><dd>${esc(a.betreff)}</dd>` : ''}
            <dt>Betrag netto</dt><dd>${Zahl.eur(s.netto)}</dd>
            <dt>Gesamtbetrag</dt><dd class="gross">${Zahl.eur(s.brutto)}</dd>
            ${a.gueltigBis && a.status === 'gesendet' ? `<dt>Gültig bis</dt><dd>${datum(a.gueltigBis)}</dd>` : ''}
          </dl>
          ${links}
        </aside>
        <main class="kd-papier" aria-label="Angebot als Dokument">${Auftraege.dokumentHtml(c, a, a.status === 'angenommen' && c.R.an('angebote', 'bestaetigung') ? 'bestaetigung' : 'angebot')}</main>
      </div>
      <footer class="kd-fuss">${esc(f.name)}${f.inhaber ? ', Inh. ' + esc(f.inhaber) : ''} · ${esc([f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))}${f.telefon ? ' · Tel. ' + esc(f.telefon) : ''} · <button class="kd-link" data-k="lesen" data-id="impressum">Impressum</button> · <button class="kd-link" data-k="lesen" data-id="datenschutz">Datenschutz</button> · <button class="kd-link" data-k="lesen" data-id="agb">AGB</button></footer>
    </div>`;
    bilderNachladen(Wurzel(), Store.items);
    unterschrift();
    verbinden(id, { widerruf, mitAgb });
  }

  function unterschrift() {
    const cv = $('#kd-canvas'); leer = true; if (!cv) return;
    const r = cv.getBoundingClientRect(); const f = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * f; cv.height = r.height * f;
    const g = cv.getContext('2d'); g.scale(f, f); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1d2a4a';
    let zieht = false;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener('pointerdown', (e) => { zieht = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); e.preventDefault(); });
    cv.addEventListener('pointermove', (e) => { if (!zieht) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); leer = false; cv.parentElement.classList.add('voll'); });
    const ende = () => { zieht = false; }; cv.addEventListener('pointerup', ende); cv.addEventListener('pointercancel', ende);
  }

  function lesen(was) {
    const c = ctx(); const P = c.R.p('angebote');
    const titel = RECHT_TITEL[was];
    const text = rechtText(c, was);
    Fenster.oeffne({ titel, bereich: 'ui-buero-fenster kd-fenster', inhalt: `<p class="muster-hinweis">${Icon('paragraph')} Mustertext: vor dem Einsatz von einem Anwalt prüfen lassen.</p><div class="kd-lesetext">${esc(text).replace(/\n/g, '<br>')}</div>`,
      fuss: `<button class="k" data-f="druck">${Icon('drucken')} Drucken / speichern</button><button class="k haupt" data-f="zu">Schließen</button>`,
      aktionen: { druck: () => drucken(`<div class="dokument"><h2>${esc(titel)}</h2><p>${esc(text).replace(/\n/g, '<br>')}</p></div>`) } });
  }

  function verbinden(id, { widerruf, mitAgb }) {
    const w = Wurzel();
    w.onclick = (e) => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const a = Store.items.find((i) => i.id === id); const c = ctx();
      const k = el.dataset.k;
      if (k === 'lesen') return lesen(el.dataset.id);
      if (k === 'drucken') return drucken(Auftraege.dokumentHtml(c, a, a.status === 'angenommen' && c.R.an('angebote', 'bestaetigung') ? 'bestaetigung' : 'angebot'));
      if (k === 'bestaetigung') return drucken(Auftraege.dokumentHtml(c, a, 'bestaetigung'));
      if (k === 'neu-zeichnen') { const cv = $('#kd-canvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv.parentElement.classList.remove('voll'); leer = true; }
    };
    const fa = $('#kd-annahme');
    if (fa) fa.addEventListener('submit', async (e) => {
      e.preventDefault();
      const c = ctx(); const a = Store.items.find((i) => i.id === id);
      const fd = new FormData(fa); const name = String(fd.get('name') || '').trim();
      if (mitAgb && !fd.get('agb')) return meldung('Bitte bestätigen Sie die AGB.', 'fehler');
      if (widerruf && !fd.get('widerruf')) return meldung('Bitte bestätigen Sie den Hinweis zum Widerruf.', 'fehler');
      if (!fd.get('datenschutz')) return meldung('Bitte bestätigen Sie den Datenschutzhinweis.', 'fehler');
      if ($('#kd-canvas') && leer) return meldung('Bitte unterschreiben Sie im Feld.', 'fehler');
      if (name.length < 3) return meldung('Bitte geben Sie Ihren Vor- und Nachnamen ein.', 'fehler');
      const knopf = $('button[type=submit]', fa); knopf.disabled = true; knopf.textContent = 'Wird gesendet …';
      try {
        const bild = $('#kd-canvas') ? await Store.speichereDatei($('#kd-canvas').toDataURL('image/png'), 'unterschrift.png') : '';
        const patch = { status: 'angenommen', entschieden: Date.now(), angenommenOnline: { name, wann: Date.now(), unterschrift: bild, agb: mitAgb, widerruf, beginnVorFrist: !!fd.get('beginn'), datenschutz: true, geraet: navigator.userAgent.slice(0, 160) } };
        if (!a.bs && c.R.an('angebote', 'baustelleAnlegen')) patch.bs = Auftraege.baustelleAusAngebot(a);
        await Store.aendere(id, patch);
        window.scrollTo(0, 0); zeichne(id);
      } catch (err) { knopf.disabled = false; knopf.textContent = 'Zahlungspflichtig annehmen'; meldung(err.message || 'Das hat nicht geklappt. Bitte noch einmal versuchen.', 'fehler'); }
    });
    const ff = $('#kd-frage');
    if (ff) ff.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(ff); const text = String(fd.get('text') || '').trim(); const tel = String(fd.get('telefon') || '').trim();
      if (!text) return meldung('Bitte schreiben Sie Ihre Frage ins Feld.', 'fehler');
      const a = Store.items.find((i) => i.id === id);
      Store.aendere(id, { fragen: [...(a.fragen || []), { text: tel ? `${text} (Rückruf: ${tel})` : text, wann: Date.now() }] });
      ff.closest('details').innerHTML = `<p class="kd-danke">${Icon('haken')} Danke, Ihre Frage ist angekommen. Wir melden uns bei Ihnen.</p>`;
    });
  }

  return { start, lesen: (was) => lesen(was) };
})();
