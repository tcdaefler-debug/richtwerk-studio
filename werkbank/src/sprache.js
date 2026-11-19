/* =========================================================================
   Einsprechen: Erinnerungen und Materialbestellungen per Sprache
   Spracherkennung: in claude.ai die Diktierfunktion der Seite, sonst die des
   Browsers (Chrome, Edge, Safari). Wo es keine gibt, bleibt das Textfeld
   (die Diktiertaste der Handy-Tastatur funktioniert dort trotzdem).
   Aus dem Text wird erkannt: Händler, Mengen mit Einheit, Fälligkeit.
   ========================================================================= */
const Sprache = (() => {
  /* ---------- Spracherkennung ---------- */
  let diktat = null;
  try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('dictation').then((d) => { diktat = d; }).catch(() => {}); } catch { /* ohne */ }
  const BrowserSR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const verfuegbar = () => !!(diktat || BrowserSR);

  /* ---------- Text verstehen ---------- */
  const ZAHLWORT = { ein: 1, eine: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwanzig: 20, dreißig: 30, fünfzig: 50, hundert: 100, halbe: 0.5 };
  const EINHEIT = [
    [/^paletten?$/i, 'Pal.'], [/^rollen?$/i, 'Rollen'], [/^(stück|stk\.?)$/i, 'Stk'], [/^bund$/i, 'Bund'], [/^(pakete?|pack|packungen?)$/i, 'Pak.'],
    [/^kartons?$/i, 'Kart.'], [/^eimer$/i, 'Eimer'], [/^(sack|säcke)$/i, 'Sack'], [/^(m²|qm|quadratmeter)$/i, 'm²'], [/^(m³|kubik(meter)?)$/i, 'm³'],
    [/^(meter|m|lfm|laufmeter|laufende meter)$/i, 'm'], [/^(kg|kilo(gramm)?)$/i, 'kg'], [/^(liter|l)$/i, 'l'], [/^(dosen?|kartuschen?)$/i, 'Dosen'], [/^(kisten?|boxen?|schachteln?)$/i, 'Kisten'], [/^(tafeln|platten)$/i, 'Platten'],
  ];
  const zahlVon = (w) => { const s = String(w).toLowerCase().replace(',', '.'); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : ZAHLWORT[s]; };
  const WT = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };

  function lieferantenListe(c) {
    return String(c.R.p('material').lieferanten || '').split('\n').map((z) => z.split('|').map((s) => s.trim())).filter((t) => t[0]).map(([name, telefon, email]) => ({ name, telefon: telefon || '', email: email || '' }));
  }

  function verstehen(c, roh) {
    const text = String(roh || '').replace(/\s+/g, ' ').trim();
    const klein = text.toLowerCase();
    // Händler: bekannte zuerst, sonst „bei/beim X“
    let lieferant = '';
    const bekannte = lieferantenListe(c);
    const treffer = bekannte.find((l) => { const n = l.name.toLowerCase(); const kern = n.split(/[\s-]+/)[0]; return klein.includes(n) || (kern.length > 3 && klein.includes(kern)); });
    if (treffer) lieferant = treffer.name;
    else { const m = text.match(/\b(?:bei|beim|von)\s+(?:der |dem |den )?([A-ZÄÖÜ][\wäöüß.&-]*(?:[\s-](?:[A-ZÄÖÜ][\wäöüß.&-]*|Einkauf|Handel))*)/); if (m && !/^(Baustelle|Kunde|Chef)/.test(m[1])) lieferant = m[1].replace(/[.,]$/, ''); }
    // Fälligkeit
    let faellig = '';
    if (/übermorgen/.test(klein)) faellig = Datum.plus(c.heute, 2);
    else if (/morgen/.test(klein)) faellig = Datum.plus(c.heute, 1);
    else if (/\bheute\b/.test(klein)) faellig = c.heute;
    else { const w = Object.keys(WT).find((t) => klein.includes(t)); if (w) { let d = Datum.plus(c.heute, 1); while (Datum.wochentag(d) !== WT[w] - 1) d = Datum.plus(d, 1); faellig = d; } }
    // Mengen: „6 Paletten Steine“, „eine Palette Gratziegel“, „3 Rollen Firstrolle“
    const positionen = [];
    const teile = text.split(/,|;|\.\s|\bund\b|\bsowie\b|\bplus\b|\n/i);
    teile.forEach((t) => {
      const m = t.trim().match(/(?:^|\s)(\d+(?:[.,]\d+)?|ein|eine|einen|einer|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|fünfzig|hundert|halbe)\s+(.+)$/i);
      if (!m) return; const menge = zahlVon(m[1]); if (!menge) return;
      const worte = m[2].trim().split(/\s+/);
      let einheit = ''; const e = EINHEIT.find(([r]) => r.test(worte[0])); if (e && worte.length > 1) { einheit = e[1]; worte.shift(); }
      let was = worte.join(' ').replace(/^(stück|stk)\s+/i, '').replace(/\s+(bestellen|besorgen|mitbringen|holen|ordern)\b.*$/i, '').replace(/\b(beim|bei|von)\s+.*$/i, '').replace(/[.!?]+$/, '').trim();
      if (!was || /^(uhr|tage?n?|wochen?|minuten?|mal|erinnerung|frage|termin|moment|bestellung|sache|gefallen)\b/i.test(was)) return;
      if (!einheit && /^(paletten?|rollen?)$/i.test(was)) return;
      positionen.push({ menge, einheit: einheit || 'Stk', text: was.charAt(0).toUpperCase() + was.slice(1) });
    });
    const art = positionen.length ? 'bestellung' : 'erinnerung';
    // Kurzer Titel für Erinnerungen: Floskeln vorne weg
    const kurz = text.replace(/^(bitte\s+)?(schreib(e)?\s+(mir\s+)?(eine\s+)?erinnerung,?\s*|erinner(e|n)?\s+(mich|uns)\s*(daran)?,?\s*|nicht vergessen,?\s*)/i, '').replace(/^(dass|das)\s+(ich|wir)\s+/i, '').replace(/^an\s+/i, '');
    return { art, text, kurz: kurz.charAt(0).toUpperCase() + kurz.slice(1), lieferant, faellig, positionen };
  }

  /* ---------- Dialog ---------- */
  let hoert = false; let stopFn = null;
  function oeffne(c, bereich = 'ui-buero-fenster') {
    let erkannt = verstehen(c, '');
    const kannHoeren = verfuegbar();
    const hg = Fenster.oeffne({
      titel: 'Einsprechen', bereich: `${bereich} sprach-fenster`,
      inhalt: `<div class="sp-mikro">
          <button type="button" class="sp-knopf" data-f="hoeren" ${kannHoeren ? '' : 'hidden'} aria-label="Aufnahme starten">${Icon('mikro')}</button>
          <div><b id="sp-status">${kannHoeren ? 'Antippen und sprechen' : 'Hier eintippen oder die Diktiertaste der Tastatur nutzen'}</b>
          <small>z. B. „Beim Dachdecker-Einkauf bestellen: 6 Paletten Steine, eine Palette Gratziegel, 3 Rollen Firstrolle“ oder „Erinnere mich morgen, Gerdes wegen der Rinne anzurufen“</small></div></div>
        <label class="feld"><span>Text</span><textarea id="sp-text" rows="3" placeholder="Was soll ich aufschreiben?"></textarea></label>
        <div id="sp-ergebnis"></div>
        <p class="sp-ausblick">Die Erkennung von Mengen und Händlern läuft nach festen Regeln im Programm. Ausblick: Ein KI-Assistent, der aus dem Gesprochenen auch Aufmaße und Angebotsentwürfe macht, ist in Planung.</p>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="speichern">${Icon('haken')} Speichern</button>`,
      aktionen: {
        hoeren: () => (hoert ? stopp() : hoeren()),
        art: (b) => { erkannt.art = b.dataset.id; zeigen(); },
        speichern: () => speichern(),
      },
    });
    const feld = $('#sp-text', hg);
    feld.addEventListener('input', () => { erkannt = verstehen(c, feld.value); zeigen(); });
    hg.addEventListener('change', (e) => { if (e.target.id === 'sp-lieferant') erkannt.lieferant = e.target.value.trim(); if (e.target.id === 'sp-faellig') erkannt.faellig = e.target.value; });
    function status(t, an) { const s = $('#sp-status', hg); if (s) s.textContent = t; const k = $('.sp-knopf', hg); if (k) k.classList.toggle('an', !!an); }
    function zeigen() {
      const e = erkannt; const z = $('#sp-ergebnis', hg); if (!z) return;
      if (!e.text) { z.innerHTML = ''; return; }
      const wahl = `<span class="segment"><button type="button" class="${e.art === 'bestellung' ? 'an' : ''}" data-f="art" data-id="bestellung">Bestellung</button><button type="button" class="${e.art === 'erinnerung' ? 'an' : ''}" data-f="art" data-id="erinnerung">Erinnerung</button></span>`;
      z.innerHTML = `<div class="sp-erkannt"><div class="sp-kopf"><b>Erkannt</b>${wahl}</div>
        ${e.art === 'bestellung' ? `<div class="reihe"><label class="feld"><span>Bei</span><input id="sp-lieferant" list="sp-liste" value="${esc(e.lieferant)}" placeholder="${esc(c.R.p('material').haendler)}"><datalist id="sp-liste">${lieferantenListe(c).map((l) => `<option value="${esc(l.name)}">`).join('')}</datalist></label>
          ${c.R.mitBaustelle('material') ? `<label class="feld"><span>Baustelle</span><select id="sp-bs"><option value="">ohne Baustelle</option>${c.baustellenOffen().map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>` : ''}</div>
          ${e.positionen.length ? `<table class="t sp-pos"><tbody>${e.positionen.map((p) => `<tr><td class="r num">${String(p.menge).replace('.', ',')}</td><td>${esc(p.einheit)}</td><td>${esc(p.text)}</td></tr>`).join('')}</tbody></table>` : '<p class="sp-leer">Keine Mengen erkannt. Die Bestellung wird als Text gespeichert.</p>'}`
        : `<div class="reihe"><label class="feld"><span>Erinnerung</span><input id="sp-kurz" value="${esc(e.kurz)}"></label><label class="feld"><span>Wann</span><input id="sp-faellig" type="date" value="${esc(e.faellig || c.heute)}"></label></div>`}</div>`;
    }
    function hoeren() {
      hoert = true; status('Ich höre zu …', true);
      const basis = feld.value ? feld.value.replace(/\s*$/, ' ') : '';
      let fertig = basis;
      const neu = (t, vorlaeufig) => { feld.value = (fertig + (vorlaeufig || '')).trimStart(); if (!vorlaeufig) fertig = feld.value; erkannt = verstehen(c, feld.value); zeigen(); };
      if (diktat) {
        const ab = [diktat.onPartial(({ text }) => neu('', text)), diktat.onFinal(({ text }) => { fertig += text; neu(''); }),
          diktat.onState(({ state, reason }) => { if (state === 'idle') { hoert = false; ab.forEach((u) => u()); status(reason === 'not_granted' ? 'Mikrofon nicht erlaubt. Bitte eintippen.' : 'Fertig. Noch etwas? Nochmal antippen.', false); } })];
        diktat.start({ language: 'de' }).catch((err) => { hoert = false; ab.forEach((u) => u()); status(err && err.code === 'not_granted' ? 'Mikrofon nicht erlaubt. Bitte eintippen.' : 'Spracherkennung gerade nicht verfügbar. Bitte eintippen.', false); });
        stopFn = () => diktat.stop();
        return;
      }
      const sr = new BrowserSR(); sr.lang = 'de-DE'; sr.interimResults = true; sr.continuous = true;
      sr.onresult = (ev) => { let vorl = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) { fertig += (fertig && !/\s$/.test(fertig) ? ' ' : '') + r[0].transcript.trim(); neu(''); } else vorl += r[0].transcript; } if (vorl) neu('', (fertig && !/\s$/.test(fertig) ? ' ' : '') + vorl); };
      sr.onerror = (ev) => { status(ev.error === 'not-allowed' ? 'Mikrofon nicht erlaubt. Bitte eintippen.' : 'Nicht verstanden. Nochmal antippen oder eintippen.', false); };
      sr.onend = () => { hoert = false; status('Fertig. Noch etwas? Nochmal antippen.', false); };
      try { sr.start(); } catch { hoert = false; status('Spracherkennung gerade nicht verfügbar. Bitte eintippen.', false); }
      stopFn = () => sr.stop();
    }
    function stopp() { hoert = false; if (stopFn) stopFn(); status('Fertig.', false); }
    async function speichern() {
      if (hoert) { stopp(); await new Promise((r) => setTimeout(r, 400)); }
      const e = verstehen(c, feld.value); e.art = erkannt.art || e.art;
      if (!e.text) return meldung('Bitte etwas einsprechen oder eintippen.', 'fehler');
      const pid = c.ich ? c.ich.id : '';
      if (e.art === 'bestellung') {
        const lief = ($('#sp-lieferant', hg) || {}).value; const bs = ($('#sp-bs', hg) || {}).value || '';
        const text = e.positionen.length ? e.positionen.map((p) => `${String(p.menge).replace('.', ',')} ${p.einheit} ${p.text}`).join(', ') : e.text;
        Store.neu({ typ: 'material', pid, datum: c.heute, bs, text, positionen: e.positionen, lieferant: (lief || e.lieferant || '').trim(), quelle: 'sprache', status: 'offen' });
        meldung(c.ich && ['chef', 'buero'].includes(c.ich.rolle) ? 'Auf der Bestellliste' : 'An den Chef gesendet');
      } else {
        Store.neu({ typ: 'erinnerung', pid, datum: c.heute, text: (($('#sp-kurz', hg) || {}).value || e.kurz).trim(), faellig: ($('#sp-faellig', hg) || {}).value || e.faellig || c.heute, quelle: 'sprache' });
        meldung('Erinnerung gespeichert');
      }
      Fenster.schliesse();
    }
    if (kannHoeren) setTimeout(() => { const k = $('.sp-knopf', hg); if (k) k.focus(); }, 50);
  }

  /* Knöpfe mit data-sprache gehen überall (Büro und App) */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-sprache]'); if (!el) return;
    ev.preventDefault();
    const app = document.body.classList.contains('app-modus');
    const s = Sitzung.lies(app ? 'app' : 'buero') || {};
    oeffne(kontext(Store.cfg, Store.items, s.pid), app ? 'ui-buero-fenster app-fenster' : 'ui-buero-fenster');
  });

  /* Erinnerungen abhaken (Büro und App) */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-erinnerung]'); if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    Store.aendere(el.dataset.erinnerung, { erledigt: Date.now() }); meldung('Erledigt');
  }, true);
  const meine = (c) => c.typ('erinnerung').filter((e) => !e.erledigt && c.ich && e.pid === c.ich.id).sort((a, b) => (a.faellig || '').localeCompare(b.faellig || ''));
  const wann = (c, e) => (!e.faellig ? '' : e.faellig < c.heute ? 'überfällig seit ' + Datum.kurz(e.faellig) : e.faellig === c.heute ? 'heute' : e.faellig === Datum.plus(c.heute, 1) ? 'morgen' : Datum.WT[Datum.wochentag(e.faellig)] + ', ' + Datum.kurz(e.faellig));
  Buero.erweitern({ aufgaben: (c) => meine(c).filter((e) => !e.faellig || e.faellig <= Datum.plus(c.heute, 1)).map((e) => ({ titel: e.text, unter: `Erinnerung · ${wann(c, e)}`, erinnerung: e.id })) });

  return { oeffne, verstehen, lieferantenListe, meine, wann };
})();
