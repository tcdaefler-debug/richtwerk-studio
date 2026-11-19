/* =========================================================================
   Entwickler-Tool (Richtwerk Studio)
   Links: Betriebe + Bausteine · Mitte: Baukasten-Fläche · Rechts: Prüfer
   Bausteine ziehen, Ausgang (rechter Punkt) auf Eingang (linker Punkt)
   ziehen = verbinden. Klick auf eine Linie = trennen.
   ========================================================================= */
const Studio = (() => {
  const KN_B = 200; const KN_H = 60;
  const zustand = { reiter: 'baukasten', fid: null, gewaehlt: null, ansicht: { x: 40, y: 40, z: 0.85 }, vorschau: 'app', liste: [], aktion: null };

  /* ---------- Anmeldung ---------- */
  function anmeldung(fehler = '') {
    aktiverBereich = null;
    Wurzel().innerHTML = `<div class="studio-login"><form class="formular" id="f-studio" autocomplete="off">
      <div class="marke" style="color:#fff;margin-bottom:22px">${LOGO}Richtwerk <small style="color:#6f7a8d;border-color:#2a3140">Studio</small></div>
      <h2>Entwicklerzugang</h2><p class="hinweis">Nur für Richtwerk. Kunden sehen diesen Bereich nicht.</p>
      <label class="feld"><span>Kennung</span><input name="kennung" autocapitalize="none" spellcheck="false"></label>
      <label class="feld"><span>Code</span><input name="code" type="password" class="code" inputmode="numeric"></label>
      <div class="fehlertext">${esc(fehler)}</div><button class="knopf-voll" type="submit">Öffnen</button>
      <a class="zurueck" href="#">${Icon('zurueck')} Bereich wählen</a></form></div>`;
    $('#f-studio').addEventListener('submit', (e) => {
      e.preventDefault(); const w = Object.fromEntries(new FormData(e.target));
      if (w.kennung.trim().toLowerCase() !== ENTWICKLER.kennung || w.code.trim() !== ENTWICKLER.code) return anmeldung('Kennung oder Code stimmt nicht.');
      Sitzung.setze('studio', { ok: true }); start();
    });
  }

  async function start() {
    if (!Sitzung.lies('studio')) return anmeldung();
    aktiverBereich = Studio;
    const meta = await Store.betriebe();
    zustand.liste = (meta && meta.liste) || [];
    if (!zustand.fid || !zustand.liste.some((b) => b.id === zustand.fid)) zustand.fid = (zustand.liste[0] || {}).id;
    if (zustand.fid) Store.oeffne(zustand.fid);
    zeichne(true);
  }

  /* ---------- Hilfen ---------- */
  const cfg = () => Store.cfg;
  const bk = () => cfg().baukasten;
  const knoten = (typ) => bk().knoten.find((k) => k.typ === typ);
  let speichernTimer = null;
  function speichere(sofort = false) {
    clearTimeout(speichernTimer);
    const los = () => { Store.speichereCfg(cfg()).then(() => standZeigen('gespeichert')).catch((e) => meldung(e.message, 'fehler')); };
    standZeigen('speichert …');
    if (sofort) los(); else speichernTimer = setTimeout(los, 400);
  }
  function standZeigen(t) { const s = $('.speicherstand'); if (s) s.textContent = t; }
  function aendereBaukasten(fn) {
    const neu = JSON.parse(JSON.stringify(cfg())); fn(neu.baukasten, neu);
    Store.speichereCfg(neu).then(() => standZeigen('gespeichert'));
    standZeigen('speichert …');
  }
  const darfVerbinden = (von, zu) => von !== zu && BAUSTEINE[zu] && BAUSTEINE[zu].ein.includes(von);

  /* ---------- Zeichnen ---------- */
  function zeichne(voll = false) {
    if (aktiverBereich !== Studio) return;
    if (zustand.aktion) return; // während Ziehen nicht neu zeichnen
    const c = cfg();
    if (!c) { Wurzel().innerHTML = `<div class="laden"><div>Studio wird geladen<div class="balken"><i></i></div></div></div>`; return; }
    if (!voll && $('.ui-studio') && zustand.reiter === 'baukasten') { flaecheZeichnen(); seiteZeichnen(); if (!$('.s-pruef').contains(document.activeElement)) pruefZeichnen(); return; }
    if (!voll && $('.ui-studio') && document.activeElement && $('.s-inhalt-seite') && $('.s-inhalt-seite').contains(document.activeElement)) return;
    Wurzel().innerHTML = `<div class="ui-studio">
      <header class="s-kopf"><div class="marke">${LOGO}Richtwerk <small>Studio</small></div>
        <nav class="reiter">${[['baukasten', 'Baukasten'], ['team', 'Betrieb & Zugänge'], ['betriebe', 'Alle Betriebe']].map(([k, t]) => `<button class="${zustand.reiter === k ? 'an' : ''}" data-s="reiter" data-id="${k}">${t}</button>`).join('')}</nav>
        <span class="luecke"></span><span class="speicherstand">${Store.modus === 'cloud' ? 'live' : 'lokal'}</span>
        <button class="sk" data-s="kunde" data-id="buero">Büro dieses Betriebs öffnen</button>
        <button class="sk" data-s="kunde" data-id="app">App öffnen</button>
        <button class="sk" data-s="abmelden">${Icon('abmelden')}</button></header>
      ${zustand.reiter === 'baukasten' ? `<aside class="s-seite"></aside><section class="s-flaeche" id="flaeche"><div class="studio-schmal">Das Entwickler-Tool ist für einen großen Bildschirm gebaut. Auf dem Handy nur ansehen.</div><div class="s-welt" id="welt"></div>
        <div class="s-werkzeug"><button data-s="zoom" data-id="-1">−</button><span id="zoomwert">${Math.round(zustand.ansicht.z * 100)}%</span><button data-s="zoom" data-id="1">+</button><button data-s="einpassen">Einpassen</button></div>
        <div class="s-tipp">Baustein aus der Liste ziehen<br>Rechten Punkt auf linken Punkt ziehen = verbinden<br>Linie anklicken = trennen</div></section><aside class="s-pruef"></aside>` : `<aside class="s-seite"></aside><main class="s-inhalt-seite">${zustand.reiter === 'team' ? teamSeite() : betriebeSeite()}</main>`}
    </div>`;
    document.documentElement.style.setProperty('--firma', c.farbe);
    seiteZeichnen();
    if (zustand.reiter === 'baukasten') { flaecheZeichnen(); pruefZeichnen(); flaecheVorbereiten(); }
  }

  function seiteZeichnen() {
    const s = $('.s-seite'); if (!s) return;
    const benutzt = new Set(bk().knoten.map((k) => k.typ));
    const gruppen = Object.entries(GRUPPEN).map(([g, info]) => {
      const steine = Object.entries(BAUSTEINE).filter(([, b]) => b.gruppe === g);
      return `<div class="pgruppe"><i style="background:${info.farbe}"></i>${info.name}</div>${steine.map(([typ, b]) => `<button class="p-baustein ${benutzt.has(typ) ? 'benutzt' : ''}" style="--g:${info.farbe}" data-palette="${typ}" title="${esc(b.kurz)}">${Icon(b.icon)}${esc(b.name)}</button>`).join('')}`;
    }).join('');
    s.innerHTML = `<div class="s-abschnitt">Betriebe</div>${zustand.liste.map((b) => `<button class="s-betrieb ${b.id === zustand.fid ? 'an' : ''}" data-s="betrieb" data-id="${b.id}"><span class="firmenzeichen" style="background:${b.id === zustand.fid ? esc(cfg().farbe) : '#3a4252'}">${esc((b.id === zustand.fid ? cfg().kuerzel : '') || b.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span><span>${esc(b.name)}<small>${esc(b.kennung)}</small></span></button>`).join('')}
      ${zustand.reiter === 'baukasten' ? `<div class="s-abschnitt">Bausteine</div><div class="palette">${gruppen}</div>` : ''}`;
  }

  function flaecheZeichnen() {
    const welt = $('#welt'); if (!welt) return;
    const a = zustand.ansicht;
    welt.style.transform = `translate(${a.x}px, ${a.y}px) scale(${a.z})`;
    const z = $('#zoomwert'); if (z) z.textContent = Math.round(a.z * 100) + '%';
    const R = regeln(cfg());
    const kn = bk().knoten;
    const pos = (typ) => kn.find((k) => k.typ === typ);
    const kanten = bk().kanten.filter((k) => pos(k.von) && pos(k.zu)).map((k) => {
      const a1 = pos(k.von); const b1 = pos(k.zu);
      const x1 = a1.x + KN_B; const y1 = a1.y + KN_H / 2; const x2 = b1.x; const y2 = b1.y + KN_H / 2;
      const dx = Math.max(50, Math.abs(x2 - x1) / 2);
      const d = `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      const aktiv = zustand.gewaehlt && (k.von === zustand.gewaehlt || k.zu === zustand.gewaehlt);
      return `<path class="treffer" d="${d}" data-kante="${k.von}>${k.zu}"/><path d="${d}" class="${aktiv ? 'aktiv' : ''}"/>`;
    }).join('');
    const info = (k) => {
      const B = BAUSTEINE[k.typ]; if (B.gruppe === 'geplant') return 'in Entwicklung';
      const p = R.p(k.typ); const def = B.p;
      if (k.typ === 'angebote' || k.typ === 'rechnungen') return `${(Store.items || []).filter((i) => i.typ === (k.typ === 'angebote' ? 'angebot' : 'rechnung')).length} im Betrieb · ${(ABLAEUFE[k.typ] || []).length} Schritte`;
      const teile = Object.entries(def).filter(([, d]) => d.typ === 'zahl').slice(0, 2).map(([n, d]) => `${String(p[n]).replace('.', ',')} ${d.einheit}`);
      if (k.typ === 'app') return `${cfg().personen.length} Zugänge`;
      if (k.typ === 'baustellen') return `${c_offen()} laufend`;
      if (k.typ === 'freigabe') return p.wer;
      if (k.typ === 'export') return p.format;
      return teile.join(' · ') || B.kurz;
    };
    const c_offen = () => (cfg().baustellen || []).filter((b) => b.status !== 'fertig').length;
    welt.innerHTML = `<svg class="kanten" width="1" height="1">${kanten}<path id="vorlaeufig" class="vorlaeufig" d=""/></svg>
      ${kn.filter((k) => BAUSTEINE[k.typ]).map((k) => { const B = BAUSTEINE[k.typ]; const g = GRUPPEN[B.gruppe];
        return `<div class="knoten ${zustand.gewaehlt === k.typ ? 'an' : ''} ${B.gruppe === 'geplant' ? 'geplant' : ''}" style="left:${k.x}px;top:${k.y}px;height:${KN_H}px;--g:${g.farbe}" data-knoten="${k.typ}">
          ${B.ein.length ? `<span class="port ein" data-port="ein" data-typ="${k.typ}"></span>` : ''}
          <div class="k-kopf">${Icon(B.icon)}${esc(k.name || B.name)}</div><div class="k-info">${esc(info(k))}</div>
          ${B.gruppe !== 'geplant' && Object.values(BAUSTEINE).some((x) => x.ein.includes(k.typ)) ? `<span class="port aus" data-port="aus" data-typ="${k.typ}"></span>` : ''}</div>`; }).join('')}`;
  }

  function pruefZeichnen() {
    const p = $('.s-pruef'); if (!p) return;
    const c = cfg(); const typ = zustand.gewaehlt; const B = typ && BAUSTEINE[typ];
    if (!B || !knoten(typ)) {
      const aktiv = bk().knoten.filter((k) => BAUSTEINE[k.typ] && BAUSTEINE[k.typ].gruppe !== 'geplant');
      p.innerHTML = `<div class="block"><div class="s-titel">Betrieb</div><h3 style="--g:${esc(c.farbe)}"><span class="firmenzeichen" style="width:26px;height:26px;font-size:10px">${esc(c.kuerzel)}</span>${esc(c.name)}</h3><div class="klein">${esc(c.zusatz || '')}${c.ort ? ' · ' + esc(c.ort) : ''}</div></div>
        <div class="block"><div class="s-titel">Aufbau</div><ul class="wirkung">
          <li>${aktiv.length} Bausteine aktiv, ${bk().kanten.length} Verbindungen</li><li>${c.personen.length} Personen mit Zugang</li><li>${(c.baustellen || []).length} Baustellen</li></ul></div>
        <div class="block"><div class="s-titel">So geht's</div><ul class="wirkung"><li>Einen Baustein anklicken: Werte einstellen und Vorschau sehen.</li><li>Neue Bausteine links aus der Liste auf die Fläche ziehen.</li><li>Vom rechten Punkt eines Bausteins zum linken Punkt eines anderen ziehen. Erlaubte Ziele leuchten blau.</li><li>Jede Änderung ist sofort beim Kunden sichtbar.</li></ul></div>
        <div class="s-vorschau">${vorschauRahmen()}</div>`;
      vorschauFuellen();
      return;
    }
    const g = GRUPPEN[B.gruppe]; const werte = regeln(c).p(typ);
    const params = Object.entries(B.p).map(([name, d]) => {
      const w = werte[name];
      if (d.typ === 'wahl') return `<div class="s-param"><label>${esc(d.name)}</label><div class="wert"><select data-param="${name}">${d.optionen.map((o) => `<option ${o === w ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div></div>`;
      if (d.typ === 'langtext') return '';
      if (d.typ === 'schalter') return `<div class="s-param"><label>${esc(d.name)}</label><div class="wert"><select data-param="${name}">${['ja', 'nein'].map((o) => `<option ${o === w ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>`;
      if (d.typ === 'text') return `<div class="s-param text"><label>${esc(d.name)}</label><div class="wert"><input data-param="${name}" value="${esc(w)}"></div></div>`;
      return `<div class="s-param"><label>${esc(d.name)}</label><div class="wert"><input type="number" data-param="${name}" value="${esc(w)}" min="${d.min}" max="${d.max}" step="${d.min % 1 ? 0.1 : 1}"><em>${esc(d.einheit)}</em></div></div>`;
    }).join('');
    const kn = knoten(typ);
    const anpassung = [kn.name && 'eigener Name', (kn.felder || []).length && `${kn.felder.length} eigene Felder`, Object.values(B.p).some((x) => x.typ === 'langtext') && 'Texte'].filter(Boolean);
    p.innerHTML = `<div class="block" style="--g:${g.farbe}"><div class="s-titel">${esc(g.name)}</div><h3>${Icon(B.icon)}${esc(kn.name || B.name)}</h3><div class="klein">${esc(B.kurz)}</div>
        <button class="s-knopf orange" style="margin-top:12px;width:100%;justify-content:center" data-s="oeffnen">${Icon('stift')} Baustein öffnen${anpassung.length ? ` · ${esc(anpassung.join(', '))}` : ''}</button>
        <div class="problem"><b>Problem im Betrieb</b>${esc(B.wofuer)}</div></div>
      ${params ? `<div class="block"><div class="s-titel">Werte für ${esc(c.name)}</div>${params}</div>` : ''}
      <div class="block"><div class="s-titel">Wirkung</div><ul class="wirkung">${wirkungen(c, typ).map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
      <div class="s-vorschau">${vorschauRahmen()}</div>
      <div class="block" style="border-bottom:0"><button class="s-knopf gefahr" data-s="entfernen">${Icon('muell')} Baustein entfernen</button></div>`;
    vorschauFuellen();
  }

  /* ---------- Vorschau ----------
     Pro Baustein: welche Büro-Seite und welcher App-Bildschirm ihn zeigt. */
  const VORSCHAU = {
    app: { app: 'start' }, stempeln: { app: 'start' }, stunden: { buero: 'stunden', app: 'zeiten' }, urlaub: { buero: 'urlaub', app: 'urlaub' },
    belege: { buero: 'belege', app: 'u:beleg' }, lieferscheine: { buero: 'lieferscheine', app: 'u:lieferschein' }, material: { buero: 'material', app: 'u:material' },
    tagelohn: { buero: 'tagelohn' }, freigabe: { buero: 'uebersicht', app: 'freigaben' }, export: { buero: 'steuer' }, dokumente: { buero: 'steuer', app: 'mehr' },
    baustellen: { buero: 'baustellen' }, angebote: { buero: 'angebote' }, rechnungen: { buero: 'rechnungen' }, bautagebuch: { buero: 'akte', app: 'u:tagebuch' }, regie: { buero: 'akte', app: 'u:regie' }, wochenplan: { buero: 'plan', app: 'zeiten' }, tafel: { buero: 'tafel' },
  };
  const OHNE_AUSWAHL = { buero: 'uebersicht', app: 'start' };
  function vorschauZiel(typ) { return typ ? (VORSCHAU[typ] || null) : OHNE_AUSWAHL; }
  function vorschauRahmen() {
    const v = vorschauZiel(zustand.gewaehlt);
    if (!v) return `<div class="vorschau-rahmen"><div class="vr-kopf">Vorschau</div><div class="vorschau-leer">Dieser Baustein ist noch in Entwicklung und hat keine Oberfläche.</div></div>`;
    const modus = v[zustand.vorschau] ? zustand.vorschau : (v.app ? 'app' : 'buero');
    const knopf = (m, t) => (v[m] ? `<button class="${modus === m ? 'an' : ''}" data-s="vmodus" data-id="${m}">${t}</button>` : '');
    return `<div class="vorschau-rahmen"><div class="vr-kopf"><span>Live-Vorschau</span><span class="segment">${knopf('buero', 'Büro')}${knopf('app', 'App')}</span><button class="s-knopf" style="padding:2px 8px;font-size:10.5px" data-s="vgross">Groß</button></div><div class="vorschau-buehne" id="buehne" data-modus="${modus}"></div></div>`;
  }
  function vorschauHtml(modus, typ) {
    const c0 = cfg(); const items = Store.items; const v = vorschauZiel(typ) || OHNE_AUSWAHL;
    if (modus === 'buero') {
      const chef = c0.personen.find((p) => p.rolle === 'chef') || c0.personen[0];
      const c = kontext(c0, items, chef && chef.id);
      return { breite: 980, html: `<div class="ui-buero" style="display:block;min-height:0;--firma:${esc(c0.farbe)}"><main class="b-inhalt">${Buero.html(v.buero, c)}</main></div>` };
    }
    const p = typ === 'freigabe' ? c0.personen.find((x) => x.rolle === 'chef') : (c0.personen.find((x) => x.rolle === 'geselle') || c0.personen[0]);
    if (!p) return { breite: 390, html: '<div class="vorschau-leer">Noch keine Personen angelegt.</div>' };
    const c = kontext(c0, items, p.id);
    const opt = v.app.startsWith('u:') ? { reiter: 'erfassen', unter: v.app.slice(2) } : { reiter: v.app, unter: null };
    return { breite: 390, html: Handy.html(c, opt) };
  }
  function vorschauFuellen() {
    const b = $('#buehne'); if (!b) return;
    const { breite, html } = vorschauHtml(b.dataset.modus, zustand.gewaehlt);
    const skal = (b.clientWidth || 340) / breite;
    b.innerHTML = `<div class="skal" style="width:${breite}px;transform:scale(${skal})">${html}</div>`;
    bilderNachladen(b, Store.items);
  }

  /* ---------- Fläche: Ziehen, Verbinden, Verschieben ---------- */
  function weltPunkt(e) {
    const r = $('#flaeche').getBoundingClientRect(); const a = zustand.ansicht;
    return { x: (e.clientX - r.left - a.x) / a.z, y: (e.clientY - r.top - a.y) / a.z };
  }
  function flaecheVorbereiten() {
    const fl = $('#flaeche');
    fl.addEventListener('wheel', (e) => {
      e.preventDefault(); const r = fl.getBoundingClientRect(); const a = zustand.ansicht;
      const z2 = Math.min(1.6, Math.max(0.35, a.z * (e.deltaY < 0 ? 1.1 : 0.9)));
      const mx = e.clientX - r.left; const my = e.clientY - r.top;
      a.x = mx - ((mx - a.x) / a.z) * z2; a.y = my - ((my - a.y) / a.z) * z2; a.z = z2; flaecheZeichnen();
    }, { passive: false });
    fl.addEventListener('pointerdown', (e) => {
      const port = e.target.closest('.port.aus');
      const kn = e.target.closest('[data-knoten]');
      const kante = e.target.closest('[data-kante]');
      if (kante) {
        const [von, zu] = kante.dataset.kante.split('>');
        aendereBaukasten((b) => { b.kanten = b.kanten.filter((k) => !(k.von === von && k.zu === zu)); });
        meldung(`Verbindung ${BAUSTEINE[von].name} → ${BAUSTEINE[zu].name} getrennt`);
        return;
      }
      if (port) {
        e.stopPropagation(); const typ = port.dataset.typ;
        zustand.aktion = { art: 'verbinden', von: typ };
        $$('.port.ein').forEach((p) => { if (darfVerbinden(typ, p.dataset.typ)) p.classList.add('kann'); });
        fl.setPointerCapture(e.pointerId); return;
      }
      if (e.target.closest('.s-werkzeug, .studio-schmal')) return;
      if (kn) {
        const typ = kn.dataset.knoten; const k = knoten(typ); const pt = weltPunkt(e);
        zustand.aktion = { art: 'schieben', typ, dx: pt.x - k.x, dy: pt.y - k.y, bewegt: false, el: kn };
        fl.setPointerCapture(e.pointerId); return;
      }
      zustand.aktion = { art: 'pan', sx: e.clientX, sy: e.clientY, ox: zustand.ansicht.x, oy: zustand.ansicht.y, bewegt: false };
      fl.classList.add('zieht'); fl.setPointerCapture(e.pointerId);
    });
    fl.addEventListener('pointermove', (e) => {
      const a = zustand.aktion; if (!a) return;
      if (a.art === 'pan') { a.bewegt = a.bewegt || Math.abs(e.clientX - a.sx) + Math.abs(e.clientY - a.sy) > 3; zustand.ansicht.x = a.ox + e.clientX - a.sx; zustand.ansicht.y = a.oy + e.clientY - a.sy; $('#welt').style.transform = `translate(${zustand.ansicht.x}px, ${zustand.ansicht.y}px) scale(${zustand.ansicht.z})`; }
      if (a.art === 'schieben') {
        const pt = weltPunkt(e); const k = knoten(a.typ);
        const nx = Math.round((pt.x - a.dx) / 10) * 10; const ny = Math.round((pt.y - a.dy) / 10) * 10;
        if (nx !== k.x || ny !== k.y) { a.bewegt = true; a.x = nx; a.y = ny; a.el.style.left = nx + 'px'; a.el.style.top = ny + 'px'; kantenLive(a.typ, nx, ny); }
      }
      if (a.art === 'verbinden') {
        const k = knoten(a.von); const pt = weltPunkt(e);
        const x1 = k.x + KN_B; const y1 = k.y + KN_H / 2; const dx = Math.max(50, Math.abs(pt.x - x1) / 2);
        $('#vorlaeufig').setAttribute('d', `M${x1} ${y1} C${x1 + dx} ${y1}, ${pt.x - dx} ${pt.y}, ${pt.x} ${pt.y}`);
        $$('.port.ziel').forEach((p) => p.classList.remove('ziel'));
        const ziel = zielUnter(e); if (ziel && darfVerbinden(a.von, ziel)) { const p = $(`.port.ein[data-typ="${ziel}"]`); p && p.classList.add('ziel'); }
      }
    });
    const ende = (e) => {
      const a = zustand.aktion; if (!a) return; zustand.aktion = null; fl.classList.remove('zieht');
      if (a.art === 'pan' && !a.bewegt) { zustand.gewaehlt = null; zeichne(); }
      if (a.art === 'schieben') {
        if (a.bewegt) aendereBaukasten((b) => { const k = b.knoten.find((x) => x.typ === a.typ); k.x = a.x; k.y = a.y; });
        else { zustand.gewaehlt = a.typ; zeichne(); }
      }
      if (a.art === 'verbinden') {
        const ziel = zielUnter(e);
        if (ziel && darfVerbinden(a.von, ziel)) {
          if (!bk().kanten.some((k) => k.von === a.von && k.zu === ziel)) {
            aendereBaukasten((b) => { b.kanten.push({ von: a.von, zu: ziel }); });
            meldung(`${BAUSTEINE[a.von].name} → ${BAUSTEINE[ziel].name} verbunden`);
          }
          zustand.gewaehlt = ziel;
        } else if (ziel && ziel !== a.von) meldung(`${BAUSTEINE[a.von].name} passt nicht in ${BAUSTEINE[ziel].name}`, 'fehler');
        zeichne();
      }
    };
    fl.addEventListener('pointerup', ende);
    fl.addEventListener('pointercancel', () => { zustand.aktion = null; zeichne(); });
  }
  document.addEventListener('dblclick', (e) => {
    if (aktiverBereich !== Studio) return;
    const kn = e.target.closest('#welt [data-knoten]'); if (kn) bausteinFenster(kn.dataset.knoten);
  });
  function zielUnter(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const k = el && el.closest('[data-knoten]'); return k ? k.dataset.knoten : null;
  }
  function kantenLive(typ, x, y) {
    // während des Verschiebens nur die Linien neu berechnen
    const kn = bk().knoten.map((k) => (k.typ === typ ? { ...k, x, y } : k));
    const pos = (t) => kn.find((k) => k.typ === t);
    const pfade = $$('#welt svg path:not(#vorlaeufig)');
    let i = 0;
    for (const k of bk().kanten) {
      const a1 = pos(k.von); const b1 = pos(k.zu); if (!a1 || !b1) continue;
      const x1 = a1.x + KN_B; const y1 = a1.y + KN_H / 2; const x2 = b1.x; const y2 = b1.y + KN_H / 2; const dx = Math.max(50, Math.abs(x2 - x1) / 2);
      const d = `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      if (pfade[i]) pfade[i].setAttribute('d', d); if (pfade[i + 1]) pfade[i + 1].setAttribute('d', d); i += 2;
    }
  }

  /* Baustein aus der Liste ziehen */
  document.addEventListener('pointerdown', (e) => {
    if (aktiverBereich !== Studio) return;
    const p = e.target.closest('[data-palette]'); if (!p || p.classList.contains('benutzt')) return;
    e.preventDefault();
    const typ = p.dataset.palette; const B = BAUSTEINE[typ]; const g = GRUPPEN[B.gruppe];
    const geist = document.createElement('div'); geist.className = 'knoten'; geist.style.cssText = `position:fixed;z-index:200;pointer-events:none;left:${e.clientX - 40}px;top:${e.clientY - 20}px;height:${KN_H}px;--g:${g.farbe};opacity:.9;font-family:var(--schrift);color:#dfe3ea;font-size:13px`;
    geist.innerHTML = `<div class="k-kopf">${Icon(B.icon)}${esc(B.name)}</div><div class="k-info">loslassen zum Einsetzen</div>`;
    let bewegt = false; const sx = e.clientX; const sy = e.clientY;
    const zieh = (ev) => { if (!bewegt && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) { bewegt = true; document.body.appendChild(geist); } geist.style.left = ev.clientX - 40 + 'px'; geist.style.top = ev.clientY - 20 + 'px'; };
    const los = (ev) => {
      document.removeEventListener('pointermove', zieh); document.removeEventListener('pointerup', los); geist.remove();
      const fl = $('#flaeche'); if (!fl) return;
      const r = fl.getBoundingClientRect();
      let x; let y;
      if (bewegt && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) { const pt = weltPunkt(ev); x = pt.x - 40; y = pt.y - 20; }
      else if (!bewegt) { const maxY = Math.max(0, ...bk().knoten.map((k) => k.y)); x = 330; y = maxY + 95; }
      else return;
      aendereBaukasten((b) => { b.knoten.push({ id: 'k_' + typ, typ, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10, p: {} }); });
      zustand.gewaehlt = typ; meldung(`${B.name} eingesetzt. Jetzt verbinden.`);
    };
    document.addEventListener('pointermove', zieh); document.addEventListener('pointerup', los);
  });

  /* ---------- Seiten: Betrieb & Zugänge, Alle Betriebe ---------- */
  function teamSeite() {
    const c = cfg();
    return `<h2>${esc(c.name)}</h2><p>Stammdaten und Zugänge dieses Betriebs. Die Codes gibt Richtwerk bei der Einrichtung an die Mitarbeiter.</p>
      <div class="s-karten s-formular"><div class="s-karte"><b>Betrieb</b>
        <label class="feld"><span>Name</span><input data-cfg="name" value="${esc(c.name)}"></label>
        <label class="feld"><span>Betriebskennung (für die Anmeldung)</span><input data-cfg="kennung" value="${esc(c.kennung)}" class="mono"></label>
        <div class="reihe"><label class="feld"><span>Kürzel</span><input data-cfg="kuerzel" maxlength="2" value="${esc(c.kuerzel)}"></label><label class="feld"><span>Farbe</span><input type="color" data-cfg="farbe" value="${esc(c.farbe)}" style="height:40px;padding:2px"></label></div>
        <label class="feld"><span>Zusatz</span><input data-cfg="zusatz" value="${esc(c.zusatz)}"></label><label class="feld"><span>Ort</span><input data-cfg="ort" value="${esc(c.ort)}"></label>
        <label class="feld"><span>Paket</span><select data-cfg="paket">${['Start', 'Standard', 'Plus'].map((p) => `<option ${c.paket === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
      <div class="s-karte"><b>Notizen zum Kunden</b><p>Nur hier im Studio sichtbar.</p><textarea data-cfg="notizen" style="width:100%;min-height:220px;background:#0f1218;border:1px solid #2c3441;color:#fff;border-radius:4px;padding:10px">${esc(c.notizen || '')}</textarea></div></div>
      <table class="s-tabelle"><thead><tr><th>Name</th><th>Funktion</th><th>Rolle</th><th>Code</th><th>Std./Woche</th><th>Urlaub</th><th></th></tr></thead><tbody>
      ${c.personen.map((p, i) => `<tr><td><input data-person="${i}" data-feld="name" value="${esc(p.name)}"></td><td><input data-person="${i}" data-feld="funktion" value="${esc(p.funktion || '')}"></td>
        <td><select data-person="${i}" data-feld="rolle">${Object.entries(Buero.ROLLEN).map(([k, t]) => `<option value="${k}" ${p.rolle === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input class="code" data-person="${i}" data-feld="code" value="${esc(p.code)}" maxlength="4"></td><td><input type="number" data-person="${i}" data-feld="soll" value="${esc(p.soll)}" style="width:70px"></td><td><input type="number" data-person="${i}" data-feld="urlaub" value="${esc(p.urlaub)}" style="width:70px"></td>
        <td><button class="s-knopf gefahr" data-s="person-weg" data-id="${i}">${Icon('muell')}</button></td></tr>`).join('')}
      </tbody></table><p style="margin-top:12px"><button class="s-knopf orange" data-s="person-neu">${Icon('plus')} Person hinzufügen</button></p>`;
  }
  function betriebeSeite() {
    return `<h2>Alle Betriebe</h2><p>Jeder Betrieb hat seinen eigenen Aufbau, eigene Daten und eigene Zugänge.</p>
      <div class="s-karten">${zustand.liste.map((b) => `<div class="s-karte"><b>${esc(b.name)}</b><p>Kennung <span class="mono">${esc(b.kennung)}</span>${b.art === 'muster' ? ' · Vorführbetrieb mit Musterdaten' : b.art === 'leer' ? ' · leerer Betrieb zum Einrichten' : ''}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="s-knopf" data-s="betrieb" data-id="${b.id}">Öffnen</button>
        ${b.art === 'muster' ? `<button class="s-knopf" data-s="zuruecksetzen" data-id="${b.id}">Musterdaten neu laden</button>` : `<button class="s-knopf" data-s="leeren" data-id="${b.id}">Zurücksetzen</button>`}
        ${b.art ? '' : `<button class="s-knopf gefahr" data-s="loeschen" data-id="${b.id}">${Icon('muell')}</button>`}</div></div>`).join('')}
      <div class="s-karte s-formular"><b>Neuen Betrieb anlegen</b><p>Startet leer mit Inhaber-Zugang (Code 1001) und der Mitarbeiter-App.</p>
        <label class="feld"><span>Name</span><input id="nb-name" placeholder="z. B. Dachdeckerei Muster"></label><label class="feld"><span>Kennung</span><input id="nb-kennung" class="mono" placeholder="muster"></label>
        <button class="s-knopf orange" data-s="betrieb-neu">${Icon('plus')} Anlegen</button></div></div>
      <p style="color:#6f7a8d">Musterdaten liegen immer um das heutige Datum herum. Vor einer Vorführung einmal „Musterdaten neu laden“.</p>`;
  }

  /* ---------- Aktionen ---------- */
  document.addEventListener('click', async (e) => {
    if (aktiverBereich !== Studio) return;
    const el = e.target.closest('[data-s]'); if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.s) {
      case 'reiter': zustand.reiter = id; zeichne(true); break;
      case 'betrieb': zustand.fid = id; zustand.gewaehlt = null; Store.oeffne(id); zustand.reiter = zustand.reiter === 'betriebe' ? 'baukasten' : zustand.reiter; zeichne(true); break;
      case 'abmelden': Sitzung.setze('studio', null); anmeldung(); break;
      case 'zoom': { const a = zustand.ansicht; a.z = Math.min(1.6, Math.max(0.35, a.z + Number(id) * 0.1)); flaecheZeichnen(); break; }
      case 'einpassen': einpassen(); break;
      case 'vmodus': zustand.vorschau = id; pruefZeichnen(); break;
      case 'vgross': vorschauGross(); break;
      case 'oeffnen': bausteinFenster(zustand.gewaehlt); break;
      case 'entfernen': {
        const typ = zustand.gewaehlt; if (typ === 'app') { meldung('Die Mitarbeiter-App ist der Start jedes Betriebs.', 'fehler'); break; }
        aendereBaukasten((b) => { b.knoten = b.knoten.filter((k) => k.typ !== typ); b.kanten = b.kanten.filter((k) => k.von !== typ && k.zu !== typ); });
        zustand.gewaehlt = null; meldung(`${BAUSTEINE[typ].name} entfernt`); break;
      }
      case 'kunde': {
        const c = cfg(); const chef = c.personen.find((p) => p.rolle === 'chef');
        const ma = c.personen.find((p) => p.rolle === 'geselle') || c.personen.find((p) => p.rolle !== 'chef' && p.rolle !== 'buero') || chef;
        if (id === 'buero' && chef) Sitzung.setze('buero', { fid: zustand.fid, pid: chef.id });
        if (id === 'app' && ma) { Sitzung.setze('app', { fid: zustand.fid, pid: ma.id }); try { localStorage.setItem('rw-app-betrieb', JSON.stringify({ fid: zustand.fid, name: c.name, kuerzel: c.kuerzel, farbe: c.farbe })); } catch { /* */ } }
        window.open(location.href.split('#')[0] + '#' + id, '_blank');
        break;
      }
      case 'person-neu': { const c = JSON.parse(JSON.stringify(cfg())); let code; do { code = String(2000 + Math.floor(Math.random() * 7999)); } while (c.personen.some((p) => p.code === code)); c.personen.push({ id: Store.uid('p'), name: 'Neue Person', funktion: 'Geselle', rolle: 'geselle', code, soll: 40, urlaub: 30 }); await Store.speichereCfg(c); zeichne(true); break; }
      case 'person-weg': { const c = JSON.parse(JSON.stringify(cfg())); if (c.personen.length <= 1) { meldung('Mindestens eine Person muss bleiben.', 'fehler'); break; } c.personen.splice(Number(id), 1); await Store.speichereCfg(c); zeichne(true); break; }
      case 'zuruecksetzen': case 'leeren': {
        if (!confirmZweimal(el)) break;
        el.textContent = 'Wird geladen …';
        if (id === 'ahlers' || id === 'leer') await Muster.zuruecksetzen(id);
        else { const alt = await Store.ladeCfg(id); await Store.ersetzeBetrieb(id, { ...Muster.leerCfg(), id, kennung: alt.kennung, name: alt.name, angelegt: Date.now() }, []); }
        meldung('Fertig. Alle offenen Fenster zeigen jetzt die neuen Daten.'); zeichne(true); break;
      }
      case 'loeschen': {
        if (!confirmZweimal(el)) break;
        zustand.liste = zustand.liste.filter((b) => b.id !== id); await Store.setzeBetriebe(zustand.liste); await Store.ersetzeBetrieb(id, { geloescht: true, personen: [], baukasten: leererBaukasten() }, []);
        if (zustand.fid === id) { zustand.fid = zustand.liste[0].id; Store.oeffne(zustand.fid); }
        zeichne(true); break;
      }
      case 'betrieb-neu': {
        const name = $('#nb-name').value.trim(); const kennung = $('#nb-kennung').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!name || !kennung) { meldung('Bitte Name und Kennung eingeben.', 'fehler'); break; }
        if (zustand.liste.some((b) => b.kennung === kennung) || kennung === ENTWICKLER.kennung) { meldung('Diese Kennung ist schon vergeben.', 'fehler'); break; }
        const fid = Store.uid('b');
        await Store.ersetzeBetrieb(fid, { ...Muster.leerCfg(), id: fid, kennung, name, kuerzel: name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase(), zusatz: '' }, []);
        zustand.liste = [...zustand.liste, { id: fid, kennung, name }]; await Store.setzeBetriebe(zustand.liste);
        zustand.fid = fid; Store.oeffne(fid); zustand.reiter = 'baukasten'; meldung(`${name} angelegt. Anmeldung: ${kennung} / 1001`); zeichne(true); break;
      }
      default:
    }
  });
  function confirmZweimal(el) {
    if (el.dataset.sicher) return true;
    el.dataset.sicher = '1'; const alt = el.innerHTML; el.innerHTML = 'Wirklich? Nochmal klicken';
    setTimeout(() => { if (el.isConnected) { delete el.dataset.sicher; el.innerHTML = alt; } }, 3000);
    return false;
  }
  // Werte in Bausteinen und Betriebsdaten
  document.addEventListener('change', async (e) => {
    if (aktiverBereich !== Studio) return;
    const el = e.target;
    if (el.dataset.param) {
      const typ = zustand.gewaehlt; const d = BAUSTEINE[typ].p[el.dataset.param];
      let w = el.value; if (d.typ === 'zahl') { w = Number(w); if (Number.isNaN(w)) return; w = Math.min(d.max, Math.max(d.min, w)); el.value = w; }
      aendereBaukasten((b) => { const k = b.knoten.find((x) => x.typ === typ); k.p = { ...(k.p || {}), [el.dataset.param]: w }; });
      setTimeout(() => { flaecheZeichnen(); pruefZeichnen(); }, 30);
    }
    if (el.dataset.cfg) {
      const c = JSON.parse(JSON.stringify(cfg()));
      if (el.dataset.cfg === 'kennung') { const k = el.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!k || zustand.liste.some((b) => b.kennung === k && b.id !== zustand.fid)) { meldung('Kennung ungültig oder vergeben.', 'fehler'); el.value = c.kennung; return; } c.kennung = k; zustand.liste = zustand.liste.map((b) => (b.id === zustand.fid ? { ...b, kennung: k } : b)); await Store.setzeBetriebe(zustand.liste); }
      else c[el.dataset.cfg] = el.value;
      if (el.dataset.cfg === 'name') { zustand.liste = zustand.liste.map((b) => (b.id === zustand.fid ? { ...b, name: el.value } : b)); await Store.setzeBetriebe(zustand.liste); }
      await Store.speichereCfg(c); standZeigen('gespeichert'); seiteZeichnen();
    }
    if (el.dataset.person !== undefined) {
      const c = JSON.parse(JSON.stringify(cfg())); const p = c.personen[Number(el.dataset.person)]; const f = el.dataset.feld;
      if (f === 'code') { const code = el.value.replace(/\D/g, '').slice(0, 4); if (code.length !== 4 || c.personen.some((x, i) => x.code === code && i !== Number(el.dataset.person))) { meldung('Code muss 4 Ziffern haben und eindeutig sein.', 'fehler'); el.value = p.code; return; } p.code = code; }
      else p[f] = f === 'soll' || f === 'urlaub' ? Number(el.value) : el.value;
      await Store.speichereCfg(c); standZeigen('gespeichert');
    }
  });

  /* ---------- Baustein öffnen: Werte, Texte, Ablauf, eigene Felder ---------- */
  function bausteinFenster(typ, reiter = 'werte') {
    const B = BAUSTEINE[typ]; const k = knoten(typ); if (!B || !k) return;
    const R = regeln(cfg()); const werte = R.p(typ);
    const felder = JSON.parse(JSON.stringify(k.felder || []));
    const hatAblauf = !!ABLAEUFE[typ]; const hatFelder = MIT_FELDERN.includes(typ);
    const tabs = [['werte', 'Werte'], ['kunde', 'Beim Kunden'], ...(hatAblauf ? [['ablauf', 'Ablauf']] : []), ...(hatFelder ? [['felder', 'Eigene Felder']] : [])];
    const param = ([name, d]) => {
      const w = werte[name];
      if (d.typ === 'langtext') return `<label class="feld"><span>${esc(d.name)}</span><textarea data-bp="${name}" rows="${name === 'agb' || name === 'katalog' ? 8 : 3}" class="${name === 'katalog' ? 'mono' : ''}">${esc(w)}</textarea></label>`;
      if (d.typ === 'wahl' || d.typ === 'schalter') return `<label class="feld"><span>${esc(d.name)}</span><select data-bp="${name}">${(d.optionen || ['ja', 'nein']).map((o) => `<option ${o === w ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
      if (d.typ === 'text') return `<label class="feld"><span>${esc(d.name)}</span><input data-bp="${name}" value="${esc(w)}"></label>`;
      return `<label class="feld"><span>${esc(d.name)} (${esc(d.einheit)}, ${d.min} bis ${d.max})</span><input type="number" data-bp="${name}" value="${esc(w)}" min="${d.min}" max="${d.max}" step="${d.min % 1 ? 0.1 : 1}"></label>`;
    };
    const feldZeile = (f, i) => `<tr data-feld="${i}"><td><input class="f-name" value="${esc(f.name)}" placeholder="z. B. Kostenstelle" aria-label="Feldname"></td>
      <td><select class="f-typ" aria-label="Art">${[['text', 'Text'], ['zahl', 'Zahl'], ['wahl', 'Auswahl'], ['janein', 'Ja/Nein']].map(([v, t]) => `<option value="${v}" ${f.typ === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input class="f-opt" value="${esc(f.optionen || '')}" placeholder="nur bei Auswahl: A, B, C" aria-label="Auswahlmöglichkeiten"></td>
      <td style="text-align:center"><input type="checkbox" class="f-pflicht" ${f.pflicht ? 'checked' : ''} aria-label="Pflichtfeld"></td>
      <td><button class="k klein" data-f="feld-weg" data-id="${i}" aria-label="Feld entfernen">${Icon('x')}</button></td></tr>`;
    const inhalt = {
      werte: Object.keys(B.p).length ? `<div class="bf-raster">${Object.entries(B.p).filter(([, d]) => d.typ !== 'langtext').map(param).join('')}</div>${Object.entries(B.p).filter(([, d]) => d.typ === 'langtext').map(param).join('')}` : '<p class="hinweis-zeile">Dieser Baustein hat keine einstellbaren Werte.</p>',
      kunde: `<p class="hinweis-zeile">So heißt der Baustein im Büro und in der App dieses Betriebs. Leer lassen für den Standard.</p>
        <label class="feld"><span>Name beim Kunden</span><input data-k="name" value="${esc(k.name || '')}" placeholder="${esc(B.name)}"></label>
        <label class="feld"><span>Kurzer Hinweis in der App</span><input data-k="hinweis" value="${esc(k.hinweis || '')}" placeholder="z. B. Nur für Arbeiten über 1 Stunde"></label>`,
      ablauf: hatAblauf ? `<ol class="bf-ablauf">${ABLAEUFE[typ].map((st) => { const an = !st.schalter || werte[st.schalter] === 'ja';
        return `<li class="${an ? '' : 'aus'}"><div><b>${esc(st.name)}</b><small>${esc(st.text)}</small></div>${st.schalter ? `<label class="schalter"><input type="checkbox" data-schalter="${st.schalter}" ${an ? 'checked' : ''}><span>${an ? 'an' : 'aus'}</span></label>` : '<span class="fest">immer</span>'}</li>`; }).join('')}</ol>` : '',
      felder: hatFelder ? `<p class="hinweis-zeile">Eigene Felder erscheinen beim Erfassen ${['angebote', 'rechnungen'].includes(typ) ? 'im Büro' : 'in der App'} und in der Ansicht im Büro. Mit * sind Pflichtfelder.</p>
        <table class="t bf-felder"><thead><tr><th>Name</th><th>Art</th><th>Auswahl</th><th>Pflicht</th><th></th></tr></thead><tbody id="bf-felder">${felder.map(feldZeile).join('')}</tbody></table>
        <button class="k klein" data-f="feld-neu" style="margin-top:10px">${Icon('plus')} Feld hinzufügen</button>` : '',
    };
    const hg = Fenster.oeffne({
      titel: `${Icon(B.icon)} ${esc(k.name || B.name)}`, breit: true, bereich: 'ui-buero-fenster bf',
      inhalt: `<nav class="bf-reiter">${tabs.map(([t, n]) => `<button class="${t === reiter ? 'an' : ''}" data-f="reiter" data-id="${t}">${n}</button>`).join('')}</nav>${tabs.map(([t]) => `<section data-tab="${t}" ${t === reiter ? '' : 'hidden'}>${inhalt[t]}</section>`).join('')}`,
      fuss: `<span class="bf-fuer">für ${esc(cfg().name)}</span><button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Übernehmen</button>`,
      aktionen: {
        reiter: (b) => { $$('.bf-reiter button', hg).forEach((x) => x.classList.toggle('an', x === b)); $$('[data-tab]', hg).forEach((sec) => { sec.hidden = sec.dataset.tab !== b.dataset.id; }); },
        'feld-neu': () => { lesen(); felder.push({ id: Store.uid('x'), name: '', typ: 'text', optionen: '', pflicht: false }); $('#bf-felder', hg).innerHTML = felder.map(feldZeile).join(''); $$('.f-name', hg).pop().focus(); },
        'feld-weg': (b) => { lesen(); felder.splice(Number(b.dataset.id), 1); $('#bf-felder', hg).innerHTML = felder.map(feldZeile).join(''); },
        ok: () => {
          lesen();
          const p = {}; $$('[data-bp]', hg).forEach((el) => { const d = B.p[el.dataset.bp]; let w = el.value; if (d.typ === 'zahl') { w = Math.min(d.max, Math.max(d.min, Number(w) || d.wert)); } p[el.dataset.bp] = w; });
          $$('[data-schalter]', hg).forEach((el) => { p[el.dataset.schalter] = el.checked ? 'ja' : 'nein'; });
          const name = ($('[data-k=name]', hg).value || '').trim(); const hinweis = ($('[data-k=hinweis]', hg).value || '').trim();
          const fertig = felder.filter((f) => f.name.trim()).map((f) => ({ ...f, name: f.name.trim() }));
          aendereBaukasten((b) => { const x = b.knoten.find((y) => y.typ === typ); x.p = { ...(x.p || {}), ...p }; x.name = name || undefined; x.hinweis = hinweis || undefined; x.felder = fertig.length ? fertig : undefined; if (!x.name) delete x.name; if (!x.hinweis) delete x.hinweis; if (!x.felder) delete x.felder; });
          Fenster.schliesse(); meldung(`${name || B.name} übernommen. Büro und App zeigen es sofort.`);
          setTimeout(() => { flaecheZeichnen(); pruefZeichnen(); }, 40);
        },
      },
    });
    hg.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-schalter]'); if (!cb) return;
      cb.nextElementSibling.textContent = cb.checked ? 'an' : 'aus'; cb.closest('li').classList.toggle('aus', !cb.checked);
      const sel = $(`[data-bp="${cb.dataset.schalter}"]`, hg); if (sel) sel.value = cb.checked ? 'ja' : 'nein';
    });
    function lesen() {
      $$('#bf-felder tr[data-feld]', hg).forEach((tr) => { const f = felder[Number(tr.dataset.feld)]; if (!f) return; f.name = $('.f-name', tr).value; f.typ = $('.f-typ', tr).value; f.optionen = $('.f-opt', tr).value; f.pflicht = $('.f-pflicht', tr).checked; });
    }
  }

  function einpassen() {
    const fl = $('#flaeche'); if (!fl) return; const kn = bk().knoten; if (!kn.length) return;
    const minX = Math.min(...kn.map((k) => k.x)); const minY = Math.min(...kn.map((k) => k.y));
    const maxX = Math.max(...kn.map((k) => k.x + KN_B)); const maxY = Math.max(...kn.map((k) => k.y + KN_H));
    const z = Math.min(1.2, Math.max(0.35, Math.min((fl.clientWidth - 80) / (maxX - minX), (fl.clientHeight - 80) / (maxY - minY))));
    zustand.ansicht = { z, x: (fl.clientWidth - (maxX - minX) * z) / 2 - minX * z, y: (fl.clientHeight - (maxY - minY) * z) / 2 - minY * z };
    flaecheZeichnen();
  }
  function vorschauGross() {
    const b = $('#buehne'); if (!b) return;
    const { breite, html } = vorschauHtml(b.dataset.modus, zustand.gewaehlt);
    const hg = Fenster.oeffne({ titel: `Vorschau: ${zustand.gewaehlt ? esc(BAUSTEINE[zustand.gewaehlt].name) : 'Übersicht'}`, breit: true, inhalt: `<div class="vorschau-buehne" style="height:70vh;overflow:auto;pointer-events:auto"><div style="width:${breite}px;margin:auto">${html}</div></div>` });
    hg.querySelector('.fenster').style.maxWidth = (breite + 60) + 'px';
    bilderNachladen(hg, Store.items);
  }

  let ersteAnsicht = true;
  return {
    start,
    neuZeichnen() { zeichne(false); if (ersteAnsicht && $('#flaeche')) { ersteAnsicht = false; einpassen(); } },
  };
})();
