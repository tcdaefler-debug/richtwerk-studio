/* =========================================================================
   Rechner für die Baustelle: Lattung mit Schrauben bei Aufsparrendämmung
   und U-Wert eines Bauteils. Ergebnisse sind Richtwerte, kein Ersatz für
   Statik, Herstellerangaben oder einen Energieberater. Druck = PDF.
   ========================================================================= */
const Rechner = (() => {
  const zahl = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
  const z1 = (n, s = 1) => (Math.round(n * 10 ** s) / 10 ** s).toLocaleString('de-DE', { minimumFractionDigits: s, maximumFractionDigits: s });
  const ganz = (n) => Math.round(n).toLocaleString('de-DE');
  const feld = (name, titel, wert, einheit, extra = '') => `<label class="feld"><span>${titel}</span><div class="mit-einheit"><input name="${name}" inputmode="decimal" value="${esc(String(wert).replace('.', ','))}" ${extra}><i>${einheit}</i></div></label>`;
  const HINWEIS = 'Richtwert zur Planung und Bestellung. Maßgeblich sind Statik, Verlegeanleitung und Zulassung des Herstellers.';
  const HERSTELLER = [['SFS', 'https://www.sfs.com'], ['Würth', 'https://www.wuerth.de'], ['SPAX', 'https://www.spax.com'], ['Steico', 'https://www.steico.com'], ['Gutex', 'https://www.gutex.de'], ['Bauder', 'https://www.bauder.de']];

  /* ---------- Lattung ---------- */
  function lattung(w) {
    const traufe = zahl(w.traufe); const sparren = zahl(w.sparren); const flaechen = Math.max(1, Math.round(zahl(w.flaechen)));
    const abstand = zahl(w.abstand) / 100; const lattweite = zahl(w.lattweite) / 100; const sAbst = zahl(w.schraubAbstand) / 100;
    const [klH, klB] = String(w.kl).split('/').map(Number); const [tlH, tlB] = String(w.tl).split('/').map(Number);
    const daemm = zahl(w.daemmung); const tiefe = zahl(w.tiefe); const versch = 1 + zahl(w.verschnitt) / 100;
    if (!traufe || !sparren || !abstand || !lattweite) return null;
    const nSparren = Math.floor(traufe / abstand + 1e-9) + 1;
    const reihen = Math.ceil(sparren / lattweite - 1e-9) + 1;
    const klLfm = nSparren * sparren * flaechen * versch;
    const tlLfm = reihen * traufe * flaechen * versch;
    const schraubenJeSparren = Math.ceil(sparren / sAbst - 1e-9) + 1;
    const schrauben = Math.ceil(nSparren * schraubenJeSparren * flaechen * 1.03);
    const mindLaenge = klH + daemm + (tiefe || 80);
    const laenge = Math.ceil(mindLaenge / 20) * 20;
    const befestiger = Math.ceil(nSparren * reihen * flaechen * 1.05);
    const flaeche = traufe * sparren * flaechen;
    return { nSparren, reihen, klLfm, tlLfm, schraubenJeSparren, schrauben, mindLaenge, laenge, befestiger, flaeche, klB, klH, tlB, tlH, flaechen, daemm, lattStk: Math.ceil(tlLfm / zahl(w.lattlaenge || 4)), klStk: Math.ceil(klLfm / zahl(w.lattlaenge || 4)) };
  }
  function lattungHtml(c, w, e) {
    const zeilen = [
      [`Konterlatten ${e.klH}/${e.klB} mm`, `${z1(e.klLfm)} lfm`, `ca. ${e.klStk} Stk à ${z1(zahl(w.lattlaenge), 1)} m`],
      [`Traglatten ${e.tlH}/${e.tlB} mm`, `${z1(e.tlLfm)} lfm`, `ca. ${e.lattStk} Stk à ${z1(zahl(w.lattlaenge), 1)} m`],
      ['Befestiger Traglatte (je Kreuzungspunkt)', `${ganz(e.befestiger)} Stk`, 'Nägel oder Schrauben nach Herstellerangabe'],
    ];
    return `<div class="r-ergebnis"><div class="r-kacheln">
        <div><small>Dachfläche</small><b>${z1(e.flaeche)} m²</b></div><div><small>Sparren je Fläche</small><b>${e.nSparren}</b></div><div><small>Lattreihen</small><b>${e.reihen}</b></div></div>
      <table class="t"><thead><tr><th>Material</th><th class="r">Menge</th><th>Hinweis</th></tr></thead><tbody>${zeilen.map(([a, b, h]) => `<tr><td>${a}</td><td class="r num">${b}</td><td>${h}</td></tr>`).join('')}</tbody></table>
      ${e.daemm ? `<div class="r-hersteller"><b>Schrauben für die Konterlatte durch ${e.daemm} mm Aufsparrendämmung</b><p>Anzahl, Länge und Abstand hängen von Schneelast, Windsog und Dachneigung ab. Sie werden mit dem Bemessungsprogramm des Herstellers ermittelt, dessen Dämmung oder Schrauben verbaut werden. Richtwerk rechnet sie bewusst nicht selbst.</p>
        <div class="r-links">${HERSTELLER.map(([n, u]) => `<a class="k klein" href="${u}" target="_blank" rel="noopener">${n}</a>`).join('')}</div></div>` : ''}
      <p class="r-hinweis">Verschnitt ${z1(zahl(w.verschnitt), 0)} % auf Latten, 5 % auf Befestiger. ${HINWEIS}</p></div>`;
  }

  /* ---------- U-Wert ---------- */
  const STOFFE = [
    ['Mineralwolle WLS 035', 0.035], ['Mineralwolle WLS 032', 0.032], ['Holzfaser WLS 040', 0.040], ['Holzfaser-Unterdeckplatte WLS 045', 0.045], ['Zellulose WLS 040', 0.040],
    ['PIR/PUR WLS 023', 0.023], ['EPS WLS 035', 0.035], ['Holz (Sparren, Schalung)', 0.13], ['OSB-Platte', 0.13], ['Gipskartonplatte', 0.25], ['Ziegelmauerwerk (alt)', 0.81], ['Beton', 2.1], ['Eigener Wert', 0],
  ];
  const STD_SCHICHTEN = [
    { stoff: 'Holzfaser-Unterdeckplatte WLS 045', d: 60, lambda: 0.045, zw: false },
    { stoff: 'Mineralwolle WLS 035', d: 180, lambda: 0.035, zw: true },
    { stoff: 'OSB-Platte', d: 15, lambda: 0.13, zw: false },
    { stoff: 'Gipskartonplatte', d: 12.5, lambda: 0.25, zw: false },
  ];
  function uwert(schichten, w) {
    const rsi = 0.10; const rse = w.belueftet === 'ja' ? 0.10 : 0.04;
    const f = Math.min(0.5, Math.max(0, zahl(w.holz) / 100));
    let rG = rsi + rse; let rH = rsi + rse;
    schichten.forEach((s) => { const d = zahl(s.d) / 1000; const l = zahl(s.lambda); if (!d || !l) return; rG += d / l; rH += d / (s.zw ? 0.13 : l); });
    const hatZw = schichten.some((s) => s.zw);
    const u = hatZw ? f / rH + (1 - f) / rG : 1 / rG;
    const vorher = zahl(w.vorher); const flaeche = zahl(w.flaeche);
    return { u, rG, vorher, flaeche, ersparnis: vorher > u && flaeche ? (vorher - u) * flaeche * 84 : 0, f, hatZw };
  }
  function uHtml(e) {
    const ampel = e.u <= 0.14 ? 'ok' : e.u <= 0.24 ? 'info' : 'bad';
    return `<div class="r-ergebnis"><div class="r-kacheln">
        <div class="gross ${ampel}"><small>U-Wert</small><b>${z1(e.u, 3)}</b><i>W/(m²·K)</i></div>
        ${e.vorher ? `<div><small>Vorher</small><b>${z1(e.vorher, 2)}</b><i>W/(m²·K)</i></div><div><small>Verbesserung</small><b>${e.vorher > e.u ? z1(100 * (e.vorher - e.u) / e.vorher, 0) + ' %' : '–'}</b></div>` : ''}
        ${e.ersparnis ? `<div><small>Heizwärme gespart, grob</small><b>${ganz(e.ersparnis)}</b><i>kWh im Jahr</i></div>` : ''}</div>
      <ul class="r-grenzen">
        <li class="${e.u <= 0.24 ? 'ok' : 'bad'}">${e.u <= 0.24 ? 'Erfüllt' : 'Nicht erfüllt'}: Höchstwert 0,24 W/(m²·K) für Steildächer bei Erneuerung (GEG, Anlage 7)</li>
        <li class="${e.u <= 0.14 ? 'ok' : 'bad'}">${e.u <= 0.14 ? 'Erfüllt' : 'Nicht erfüllt'}: 0,14 W/(m²·K) für die Förderung als Einzelmaßnahme (BEG, Dachflächen)</li></ul>
      <p class="r-hinweis">Vereinfacht nach DIN EN ISO 6946: Rsi 0,10${e.f && e.hatZw ? `, Holzanteil ${z1(e.f * 100, 0)} % in der Dämmebene (λ 0,13)` : ''}, ohne Wärmebrücken und Korrekturen. Ersparnis geschätzt mit 84 kKh/a. Grenzwerte vor Angebot auf aktuellen Stand prüfen. Kein Ersatz für einen Energieausweis oder die Berechnung eines Energieberaters.</p></div>`;
  }

  /* ---------- Fenster ---------- */
  function oeffne(c, art = 'lattung', bereich = 'ui-buero-fenster') {
    const P = c.R.hat('rechner') ? c.R.p('rechner') : {};
    let schichten = JSON.parse(JSON.stringify(STD_SCHICHTEN));
    const reiter = `<div class="bf-reiter r-reiter"><button type="button" data-f="art" data-id="lattung" class="${art === 'lattung' ? 'an' : ''}">Lattung</button><button type="button" data-f="art" data-id="uwert" class="${art === 'uwert' ? 'an' : ''}">U-Wert</button></div>`;
    const formLattung = `<form id="r-form" class="r-form">
        <div class="r-raster">${feld('traufe', 'Länge an der Traufe', 10.5, 'm')}${feld('sparren', 'Sparrenlänge (Traufe bis First)', 6.2, 'm')}${feld('flaechen', 'Dachflächen (Satteldach = 2)', 2, 'Stk')}
          ${feld('abstand', 'Sparrenabstand', 75, 'cm')}${feld('lattweite', 'Lattweite (laut Ziegel)', 33.5, 'cm')}${feld('daemmung', 'Aufsparrendämmung', 160, 'mm')}
          <label class="feld"><span>Konterlatte</span><select name="kl">${['40/60', '30/50', '50/80', '60/80'].map((v) => `<option ${v === '40/60' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="feld"><span>Traglatte</span><select name="tl">${['30/50', '40/60', '24/48'].map((v) => `<option ${v === '30/50' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          ${feld('verschnitt', 'Verschnitt Latten', P.verschnitt || 10, '%')}${feld('lattlaenge', 'Lattenlänge', 4, 'm')}</div>
      </form>`;
    const formU = () => `<form id="r-form" class="r-form">
        <table class="t r-schichten"><thead><tr><th>Schicht von außen nach innen</th><th style="width:96px">Dicke mm</th><th style="width:96px">λ W/(m·K)</th><th style="width:96px" title="Liegt zwischen den Sparren">Zw. Sparren</th><th></th></tr></thead><tbody>
          ${schichten.map((s, i) => `<tr data-i="${i}"><td><select data-k="stoff">${STOFFE.map(([n]) => `<option ${n === s.stoff ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
            <td><input data-k="d" inputmode="decimal" value="${String(s.d).replace('.', ',')}"></td><td><input data-k="lambda" inputmode="decimal" value="${String(s.lambda).replace('.', ',')}"></td>
            <td style="text-align:center"><input type="checkbox" data-k="zw" ${s.zw ? 'checked' : ''} aria-label="Zwischen den Sparren"></td><td><button type="button" class="k klein" data-f="schicht-weg" data-id="${i}" aria-label="Schicht entfernen">${Icon('x')}</button></td></tr>`).join('')}
        </tbody></table><button type="button" class="k klein" data-f="schicht-neu" style="margin:8px 0 14px">${Icon('plus')} Schicht</button>
        <div class="r-raster">${feld('holz', 'Holzanteil zwischen den Sparren', 12, '%')}${feld('vorher', 'U-Wert vorher (optional)', '', 'W/(m²·K)')}${feld('flaeche', 'Fläche (optional)', '', 'm²')}
          <label class="feld"><span>Dach hinterlüftet (Ziegel, Schiefer)</span><select name="belueftet"><option value="ja">ja</option><option value="nein">nein</option></select></label></div>
      </form>`;
    const hg = Fenster.oeffne({
      titel: 'Rechner', breit: true, bereich: `${bereich} rechner-fenster`,
      inhalt: `${reiter}<div id="r-koerper"></div>`,
      fuss: `<span class="r-richtwert">${Icon('glocke')} Richtwert</span><button class="k" data-f="bestellen" id="r-bestellen">${Icon('material')} Auf die Bestellliste</button><button class="k haupt" data-f="drucken">${Icon('drucken')} PDF / Drucken</button>`,
      aktionen: {
        art: (b) => { art = b.dataset.id; $$('.r-reiter button', hg).forEach((x) => x.classList.toggle('an', x === b)); aufbauen(); },
        'schicht-neu': () => { lesenSchichten(); schichten.push({ stoff: 'Mineralwolle WLS 035', d: 100, lambda: 0.035, zw: false }); aufbauen(); },
        'schicht-weg': (b) => { lesenSchichten(); schichten.splice(Number(b.dataset.id), 1); aufbauen(); },
        drucken: () => drucken(dokument()),
        bestellen: () => {
          const e = lattung(werte()); if (!e) return;
          const positionen = [{ menge: Math.round(e.klLfm), einheit: 'm', text: `Konterlatte ${e.klH}/${e.klB}` }, { menge: Math.round(e.tlLfm), einheit: 'm', text: `Dachlatte ${e.tlH}/${e.tlB}` }, { menge: e.befestiger, einheit: 'Stk', text: 'Befestiger Traglatte' }];
          Store.neu({ typ: 'material', pid: c.ich ? c.ich.id : '', datum: c.heute, bs: '', text: positionen.map((p) => `${p.menge} ${p.einheit} ${p.text}`).join(', '), positionen, lieferant: '', quelle: 'rechner', status: 'offen' });
          meldung('Auf der Bestellliste');
        },
      },
    });
    const werte = () => Object.fromEntries(new FormData($('#r-form', hg)));
    function lesenSchichten() { $$('.r-schichten tr[data-i]', hg).forEach((tr) => { const s = schichten[Number(tr.dataset.i)]; s.stoff = $('[data-k=stoff]', tr).value; s.d = zahl($('[data-k=d]', tr).value); s.lambda = zahl($('[data-k=lambda]', tr).value); s.zw = $('[data-k=zw]', tr).checked; }); }
    function rechnen() {
      const out = $('#r-aus', hg); if (!out) return;
      if (art === 'lattung') { const e = lattung(werte()); out.innerHTML = e ? lattungHtml(c, werte(), e) : '<p class="r-hinweis">Bitte Maße eintragen.</p>'; }
      else { lesenSchichten(); out.innerHTML = uHtml(uwert(schichten, werte())); }
    }
    function aufbauen() { $('#r-koerper', hg).innerHTML = (art === 'lattung' ? formLattung : formU()) + '<div id="r-aus"></div>'; $('#r-bestellen', hg).hidden = art !== 'lattung'; rechnen(); }
    hg.addEventListener('input', rechnen);
    hg.addEventListener('change', (ev) => {
      if (ev.target.dataset.k === 'stoff') { const st = STOFFE.find(([n]) => n === ev.target.value); if (st && st[1]) ev.target.closest('tr').querySelector('[data-k=lambda]').value = String(st[1]).replace('.', ','); }
      rechnen();
    });
    function dokument() {
      const f = c.cfg; const w = werte();
      const titel = art === 'lattung' ? 'Materialermittlung Lattung' : 'U-Wert-Berechnung (Richtwert)';
      const eingaben = art === 'lattung'
        ? `<table class="d-pos"><tbody>${[['Länge Traufe', w.traufe + ' m'], ['Sparrenlänge', w.sparren + ' m'], ['Dachflächen', w.flaechen], ['Sparrenabstand', w.abstand + ' cm'], ['Lattweite', w.lattweite + ' cm'], ['Aufsparrendämmung', w.daemmung + ' mm'], ['Konterlatte / Traglatte', `${w.kl} / ${w.tl} mm`]].map(([a, b]) => `<tr><td>${a}</td><td class="r">${esc(b)}</td></tr>`).join('')}</tbody></table>`
        : `<table class="d-pos"><thead><tr><th>Schicht (außen nach innen)</th><th class="r">Dicke</th><th class="r">λ</th></tr></thead><tbody>${schichten.map((s) => `<tr><td>${esc(s.stoff)}${s.zw ? ' (zwischen den Sparren)' : ''}</td><td class="r">${String(s.d).replace('.', ',')} mm</td><td class="r">${String(s.lambda).replace('.', ',')}</td></tr>`).join('')}</tbody></table>`;
      return `<div class="dokument"><div class="d-kopf"><div class="d-firma"><b>${esc(f.name)}</b><span>${esc(f.zusatz || '')}</span></div><div class="d-adresse">${[f.strasse, [f.plz, f.ort].filter(Boolean).join(' '), f.telefon && 'Tel. ' + f.telefon].filter(Boolean).map(esc).join('<br>')}</div></div>
        <h2 style="margin-top:28px">${titel}</h2><p class="d-klein">Erstellt am ${Datum.kurz(c.heute)}${c.heute.slice(0, 4)}${c.ich ? ' von ' + esc(c.ich.name) : ''}</p>
        <h3 style="font-size:13px">Eingaben</h3>${eingaben}<h3 style="font-size:13px">Ergebnis</h3>${$('#r-aus', hg).innerHTML}</div>`;
    }
    aufbauen();
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-rechner]'); if (!el) return;
    ev.preventDefault();
    const app = document.body.classList.contains('app-modus');
    const s = Sitzung.lies(app ? 'app' : 'buero') || {};
    oeffne(kontext(Store.cfg, Store.items, s.pid), el.dataset.rechner || 'lattung', app ? 'ui-buero-fenster app-fenster' : 'ui-buero-fenster');
  });

  /* Seite im Büro */
  Buero.erweitern({
    nav: [{ id: 'rechner', name: 'Rechner', icon: 'rechner', braucht: 'rechner', gruppe: 'Aufträge' }],
    seiten: {
      rechner: (c) => Buero.teile.seitenkopf(esc(c.R.name('rechner')), 'Material und Dämmwerte schnell ausrechnen, als PDF für Kunde oder Baustelle')
        + `<div class="zwei"><div class="karte"><div class="kopf"><h3>Lattung</h3><span class="chip">Richtwert</span></div><div class="koerper"><p style="margin:0 0 14px;color:#5f6862">Konterlatten, Traglatten und Befestiger aus Traufe, Sparrenlänge und Lattweite. Schrauben durch die Aufsparrendämmung über die Rechner der Hersteller.</p><button class="k haupt" data-rechner="lattung">Rechner öffnen</button></div></div>
          <div class="karte"><div class="kopf"><h3>U-Wert</h3><span class="chip">Richtwert</span></div><div class="koerper"><p style="margin:0 0 14px;color:#5f6862">Schichtaufbau eintragen, U-Wert sehen, mit GEG-Höchstwert und Förderwert vergleichen. Für das Gespräch mit dem Bauherrn.</p><button class="k haupt" data-rechner="uwert">Rechner öffnen</button></div></div></div>
          <div class="karte"><div class="kopf"><h3>In Planung</h3></div><div class="koerper" style="color:#5f6862">Wind- und Schneelast nach Standort, Aufmaß aus Fotos oder Drohnenbildern und 3D-Ansichten werden gerade geprüft. Sie erscheinen hier, sobald sie zuverlässig rechnen.</div></div>`,
    },
  });

  return { oeffne, lattung, uwert };
})();
