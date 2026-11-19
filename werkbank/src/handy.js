/* =========================================================================
   Mitarbeiter-App (Handy)
   Reiter unten: Start · Zeiten · [Erfassen] · Urlaub · Mehr
   Der Chef hat statt "Zeiten" den Reiter "Freigaben".
   Formulare laufen als Unterseite (zustand.unter), damit beim Tippen
   nichts neu gezeichnet wird.
   ========================================================================= */
const Handy = (() => {
  const zustand = { reiter: 'start', unter: null, daten: {}, woche: Datum.montag(Datum.heute()) };
  let sitzung = null;
  const BETRIEB_KEY = 'rw-app-betrieb';
  const gekoppelt = () => { try { return JSON.parse(localStorage.getItem(BETRIEB_KEY) || 'null'); } catch { return null; } };
  const koppeln = (b) => { try { b ? localStorage.setItem(BETRIEB_KEY, JSON.stringify(b)) : localStorage.removeItem(BETRIEB_KEY); } catch { /* privat */ } };

  /* ---------- Bausteine der Oberfläche ---------- */
  const status = (s) => chip(s, 'a-status');
  const zeile = ({ sym, symKlasse = '', titel, unter = '', rechts = '', a = '', id = '', pfeil = !!a }) =>
    `<${a ? 'button' : 'div'} class="a-zeile" ${a ? `data-a="${a}" data-id="${esc(id)}"` : ''}>${sym ? `<span class="sym ${symKlasse}">${Icon(sym)}</span>` : ''}<span class="text"><b>${titel}</b>${unter ? `<small>${unter}</small>` : ''}</span>${rechts ? `<span class="rechts">${rechts}</span>` : ''}${pfeil ? `<span class="pfeil">${Icon('pfeil')}</span>` : ''}</${a ? 'button' : 'div'}>`;
  const unterKopf = (titel) => `<div class="unterseite-kopf"><button data-a="zurueck" aria-label="Zurück">${Icon('zurueck')}</button><h2>${titel}</h2></div>`;
  const bsAuswahl = (c, gewaehlt = '') => `<label class="a-feld"><span>Baustelle</span><select name="bs">${c.baustellenOffen().map((b) => `<option value="${b.id}" ${b.id === gewaehlt ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}<option value="" ${!gewaehlt || !c.baustelle(gewaehlt) ? 'selected' : ''}>ohne Baustelle</option></select></label>`;

  const WETTER = ['sonnig', 'bewölkt', 'Regen', 'Wind', 'Frost', 'Schnee'];
  function baustelleKarte(c, bsId, titel) {
    const b = c.baustelle(bsId); if (!b) return '';
    const route = b.adresse ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.adresse)}` : '';
    return `<div class="a-titel">${titel}</div><div class="a-karte baustelle-karte"><div class="kopfzeile"><span class="sym firma">${Icon('haus')}</span><div><b>${esc(b.name)}</b><small>${esc(b.adresse || b.ort || '')}</small></div></div>
      ${b.notiz ? `<p class="hinweis">${esc(b.notiz)}</p>` : ''}
      <div class="knoepfe">${route ? `<a class="gross-knopf hell" href="${route}" target="_blank" rel="noopener">${Icon('karte')} Route</a>` : ''}${b.telefon ? `<a class="gross-knopf hell" aria-label="Kunde anrufen" href="tel:${esc(b.telefon.replace(/\s+/g, ''))}">${Icon('telefon')} Anrufen</a>` : ''}</div></div>`;
  }
  const naechsterArbeitstag = (d) => { let x = Datum.plus(d, 1); while (!Datum.istArbeitstag(x)) x = Datum.plus(x, 1); return x; };

  function reiterListe(c) {
    const R = c.R; const chef = c.ich.rolle === 'chef' || c.ich.rolle === 'buero';
    const r = [{ id: 'start', name: 'Start', icon: 'start' }];
    if (chef) r.push({ id: 'freigaben', name: 'Freigaben', icon: 'haken' });
    else if (R.stundenImApp()) r.push({ id: 'zeiten', name: 'Zeiten', icon: 'uhr' });
    r.push({ id: 'erfassen', name: 'Erfassen', icon: 'kamera', scan: true });
    if (R.imApp('urlaub')) r.push({ id: 'urlaub', name: 'Urlaub', icon: 'kalender' });
    r.push({ id: 'mehr', name: 'Mehr', icon: 'mehr', zahl: R.imApp('nachrichten') ? Betrieb.ungelesen(c, c.ich.id, false) : 0 });
    return r;
  }

  /* ---------- Bildschirme ---------- */
  const BILD = {};

  BILD.start = (c) => {
    const R = c.R; const ich = c.ich; const h = new Date().getHours();
    const gruss = h < 11 ? 'Moin' : h < 18 ? 'Moin' : 'Guten Abend';
    let html = `<div class="a-titel">${esc(Datum.lang(c.heute))}</div><div class="a-gruss"><h1>${gruss}, ${esc(ich.name.split(' ')[0])}</h1>${R.hat('material') && R.an('material', 'sprache') ? `<button class="sprach-rund" data-sprache aria-label="Einsprechen">${Icon('mikro')}</button>` : ''}</div>`;
    const erin = Sprache.meine(c);
    if (erin.length) html += `<div class="a-titel">Erinnerungen</div><div class="a-karte">${erin.map((e) => `<div class="a-zeile"><span class="sym">${Icon('glocke')}</span><div class="text"><b>${esc(e.text)}</b><small>${esc(Sprache.wann(c, e))}</small></div><button class="erin-haken" data-erinnerung="${e.id}" aria-label="Erledigt">${Icon('haken')}</button></div>`).join('')}</div>`;

    if (ich.rolle === 'chef' || ich.rolle === 'buero') {
      const o = c.offen(); const n = o.urlaub.length + o.stunden.length + o.belege.filter((b) => b.status === 'offen').length + o.material.length;
      const arbeiter = c.arbeiter();
      html += `<div class="a-karte">${zeile({ sym: 'haken', symKlasse: 'firma', titel: n ? `${n} Freigaben warten` : 'Keine Freigaben offen', unter: n ? [o.urlaub.length && `${o.urlaub.length} Urlaub`, o.stunden.length && `${o.stunden.length} Stunden`, o.material.length && `${o.material.length} Material`].filter(Boolean).join(' · ') : 'Alles erledigt', a: n ? 'reiter' : '', id: 'freigaben' })}</div>
        <div class="a-titel">Heute im Einsatz</div><div class="a-karte">${arbeiter.map((p) => { const l = c.laeuft(p.id); const abw = c.abwesend(p.id, c.heute);
          return zeile({ sym: 'person', titel: esc(p.name), unter: l ? `${esc(c.bsName(l.bs))} · seit ${esc(l.von)}` : abw ? (abw.typ === 'krank' ? 'Krank' : 'Urlaub') : 'nicht eingestempelt', rechts: l ? '<span class="a-status ok">Da</span>' : '' }); }).join('') || zeile({ titel: 'Noch keine Mitarbeiter' })}</div>`;
      return html;
    }

    // Stempeluhr
    if (R.stempeln()) {
      const l = c.laeuft(ich.id);
      if (l) {
        html += `<div class="a-karte stempel"><div class="status laeuft"><i></i>Eingestempelt seit ${esc(l.von)} Uhr</div>
          <div class="zeit" data-seit="${esc(l.datum)}T${esc(l.von)}">${Zahl.hhmm((Date.now() - new Date(`${l.datum}T${l.von}`).getTime()) / 60000)}</div>
          <div class="ort">${R.mitBaustelle('stunden') ? esc(c.bsName(l.bs)) : 'Arbeitszeit läuft'}</div>
          <button class="gross-knopf rot" data-a="feierabend">${Icon('stop')} Feierabend</button>
          ${R.mitBaustelle('stunden') ? `<button class="gross-knopf hell" style="margin-top:10px" data-a="unter" data-id="wechsel">Baustelle wechseln</button>` : ''}</div>`;
      } else {
        const heuteErfasst = c.stundenAm(ich.id, c.heute).reduce((s, e) => s + stundenVon(e), 0);
        html += `<div class="a-karte stempel"><div class="status"><i></i>${heuteErfasst ? `Heute schon ${Zahl.std(heuteErfasst)} Std. erfasst` : 'Nicht eingestempelt'}</div>
          <div class="zeit">${Datum.uhr(Date.now())}</div><div class="ort">${esc(c.cfg.name)}</div>
          <button class="gross-knopf firma" data-a="${R.mitBaustelle('stunden') ? 'unter' : 'einstempeln'}" data-id="einstempeln">${Icon('play')} Arbeitsbeginn</button></div>`;
      }
    } else if (R.stundenImApp()) {
      html += `<div class="a-karte stempel"><div class="status"><i></i>Stundenzettel</div><div class="ort" style="margin-top:8px">Trage deine Arbeitszeit für heute ein.</div><button class="gross-knopf firma" data-a="unter" data-id="stunden">${Icon('plus')} Stunden eintragen</button></div>`;
    }

    // Baustelle heute und Plan für den nächsten Arbeitstag
    const lauf = c.laeuft(ich.id);
    const heutePlan = c.geplant(ich.id, c.heute);
    const bsHeute = (lauf && lauf.bs) || (c.baustelle(heutePlan) ? heutePlan : '');
    if (bsHeute && R.hat('baustellen')) html += baustelleKarte(c, bsHeute, lauf ? 'Deine Baustelle' : 'Heute laut Plan');
    if (bsHeute && R.imApp('lager') && R.an('lager', 'bestaetigen')) html += Betrieb.appLagerKarte(c, bsHeute);
    if (R.imApp('partner')) html += Netz.appKarte(c, bsHeute);
    if (R.plan()) {
      const morgen = naechsterArbeitstag(c.heute); const wert = c.geplant(ich.id, morgen);
      html += `<div class="a-karte" style="margin-top:12px">${zeile({ sym: 'plan', titel: `${Datum.WT[Datum.wochentag(morgen)]}, ${Datum.kurz(morgen)}: ${esc(c.planText(wert))}`, unter: wert && c.baustelle(wert) ? esc(c.baustelle(wert).ort) : wert ? '' : 'Noch nicht eingeteilt', a: 'reiter', id: 'zeiten' })}</div>`;
    }

    // Woche
    if (R.stundenImApp()) {
      const wo = Datum.montag(c.heute); const soll = Number(ich.soll) || Number(R.p('stunden').soll);
      const tage = Array.from({ length: 5 }, (_, i) => Datum.plus(wo, i));
      const werte = tage.map((d) => c.stundenAm(ich.id, d));
      const max = Math.max(9, ...werte.map((w) => w.reduce((s, e) => s + stundenVon(e), 0)));
      const summe = werte.flat().reduce((s, e) => s + stundenVon(e), 0);
      html += `<div class="a-titel">Diese Woche</div><div class="a-karte"><div class="woche-balken">${tage.map((d, i) => { const hh = werte[i].reduce((s, e) => s + stundenVon(e), 0); const offen = werte[i].some((e) => e.status === 'offen');
        return `<div><span class="num" style="color:#15191e;font-weight:600">${hh ? Zahl.std(hh).replace(',00', '') : ''}</span><i class="${d === c.heute ? 'heute' : offen ? 'offen' : ''}" style="height:${d > c.heute ? 0 : (hh / max) * 70}%;${d > c.heute ? 'min-height:0' : ''}"></i>${Datum.WT[i]}</div>`; }).join('')}</div>
        <div class="summe-zeile"><span>Summe</span><b class="num">${Zahl.std(summe)} / ${soll} Std.</b></div></div>`;
    }

    // Neuigkeiten
    const neu = [];
    c.items.filter((i) => i.pid === ich.id && i.typ === 'urlaub' && i.entschieden && Date.now() - i.entschieden < 14 * 864e5).forEach((u) => neu.push(zeile({ sym: u.status === 'genehmigt' ? 'haken' : 'x', titel: `Urlaub ${u.status === 'genehmigt' ? 'genehmigt' : 'abgelehnt'}`, unter: `${Datum.kurz(u.von)} bis ${Datum.kurz(u.bis)}`, rechts: status(u.status) })));
    c.items.filter((i) => i.typ === 'dokument' && (i.fuer === ich.id || i.fuer === 'alle') && !i.gelesen).forEach((d) => neu.push(zeile({ sym: 'dokument', symKlasse: 'firma', titel: esc(d.titel), unter: 'Neu vom Büro', a: 'dokument', id: d.id })));
    c.items.filter((i) => i.pid === ich.id && i.typ === 'beleg' && i.status === 'abgelehnt').forEach((b) => neu.push(zeile({ sym: 'beleg', titel: `Beleg ${Zahl.eur(b.betrag)} abgelehnt`, unter: 'Bitte im Büro melden', rechts: status('abgelehnt') })));
    if (neu.length) html += `<div class="a-titel">Neuigkeiten</div><div class="a-karte">${neu.join('')}</div>`;

    // Zuletzt gesendet
    const letzte = c.items.filter((i) => i.pid === ich.id && ['beleg', 'lieferschein', 'material'].includes(i.typ)).sort((a, b) => b.erstellt - a.erstellt).slice(0, 3);
    if (letzte.length) html += `<div class="a-titel">Zuletzt gesendet</div><div class="a-karte">${letzte.map((e) => zeile({ sym: e.typ === 'beleg' ? 'beleg' : e.typ === 'material' ? 'material' : 'liefer', titel: e.typ === 'beleg' ? `${esc(e.kategorie)} ${Zahl.eur(e.betrag)}` : e.typ === 'material' ? esc(e.text) : `Lieferschein ${esc(e.lieferant)}`, unter: `${Datum.kurz(e.datum)} · ${esc(c.bsName(e.bs))}`, rechts: status(e.status) })).join('')}</div>`;
    return html;
  };

  BILD.zeiten = (c) => {
    const wo = zustand.woche; const tage = Array.from({ length: 7 }, (_, i) => Datum.plus(wo, i));
    const eig = c.items.filter((i) => i.typ === 'stunden' && i.pid === c.ich.id && i.datum >= wo && i.datum <= tage[6]);
    const summe = eig.reduce((s, e) => s + stundenVon(e), 0);
    const nachtrag = Number(c.R.p('stunden').nachtrag);
    return `<div class="unterseite-kopf" style="justify-content:space-between"><h2>Meine Zeiten</h2><span style="display:flex;gap:6px"><button class="rund-knopf" data-a="woche" data-id="-7">${Icon('zurueck')}</button><button class="rund-knopf" data-a="woche" data-id="7">${Icon('pfeil')}</button></span></div>
      <div class="a-titel">KW ${Datum.kw(wo)} · ${Datum.kurz(wo)} – ${Datum.kurz(tage[6])}</div>
      <div class="a-karte">${tage.filter((d) => Datum.istWerktag(d) || eig.some((e) => e.datum === d)).map((d) => {
        const es = eig.filter((e) => e.datum === d); const abw = c.abwesend(c.ich.id, d);
        if (!es.length) return zeile({ titel: Datum.mittel(d), unter: abw ? (abw.typ === 'krank' ? 'Krank' : 'Urlaub') : d > c.heute ? '' : 'nichts erfasst', rechts: '' });
        return es.map((e) => zeile({ titel: `${Datum.mittel(d)} · ${esc(e.von)} – ${esc(e.bis || 'läuft')}`, unter: [c.R.mitBaustelle('stunden') && c.bsName(e.bs), e.taetigkeit].filter(Boolean).map(esc).join(' · '), rechts: `${e.bis ? Zahl.std(stundenVon(e)) : ''}<small>${status(e.status)}</small>`, a: e.status === 'offen' || e.status === 'abgelehnt' ? 'eintrag' : '', id: e.id })).join('');
      }).join('')}<div class="summe-zeile"><span>Woche gesamt</span><b class="num">${Zahl.std(summe)} Std.</b></div></div>
      ${c.R.plan() ? `<div class="a-titel">Plan KW ${Datum.kw(wo)}</div><div class="a-karte">${tage.slice(0, c.R.p('wochenplan').tage === 'Mo bis Sa' ? 6 : 5).map((d) => { const w = c.geplant(c.ich.id, d); return zeile({ titel: `${Datum.WT[Datum.wochentag(d)]} ${Datum.kurz(d)}`, unter: esc(c.planText(w)), rechts: d === c.heute ? '<span class="a-status info">Heute</span>' : '' }); }).join('')}</div>` : ''}
      ${c.R.stundenImApp() ? `<button class="gross-knopf hell" style="margin-top:16px" data-a="unter" data-id="stunden">${Icon('plus')} Stunden nachtragen</button><p style="color:#6b7280;font-size:13px;text-align:center">Nachtragen bis ${nachtrag} Tage zurück möglich.</p>` : ''}`;
  };

  BILD.erfassen = (c) => {
    const R = c.R; const k = [];
    if (R.imApp('belege')) k.push(`<button class="erfassen-kachel gross" data-a="unter" data-id="beleg"><span class="sym">${Icon('kamera')}</span><span><b>Beleg scannen</b><small>Tankquittung, Baumarkt, Werkzeug</small></span></button>`);
    if (R.imApp('lieferscheine')) k.push(`<button class="erfassen-kachel" data-a="unter" data-id="lieferschein"><span class="sym">${Icon('liefer')}</span><span><b>${esc(R.name('lieferscheine').replace(/e$/, ''))}</b><small>${esc(R.hinweis('lieferscheine') || 'abfotografieren')}</small></span></button>`);
    if (R.stundenImApp()) k.push(`<button class="erfassen-kachel" data-a="unter" data-id="stunden"><span class="sym">${Icon('uhr')}</span><span><b>Stunden</b><small>nachtragen</small></span></button>`);
    if (R.imApp('urlaub')) k.push(`<button class="erfassen-kachel" data-a="unter" data-id="urlaubsantrag"><span class="sym">${Icon('kalender')}</span><span><b>Urlaub</b><small>beantragen</small></span></button>`);
    if (R.imApp('urlaub') && R.p('urlaub').krank === 'ja') k.push(`<button class="erfassen-kachel" data-a="unter" data-id="krank"><span class="sym">${Icon('krank')}</span><span><b>Krank melden</b><small>geht direkt ans Büro</small></span></button>`);
    if (R.imApp('regie')) k.push(`<button class="erfassen-kachel" data-a="unter" data-id="regie"><span class="sym">${Icon('unterschrift')}</span><span><b>${esc(R.name('regie'))}</b><small>${esc(R.hinweis('regie') || 'Zusatzarbeit, Kunde unterschreibt')}</small></span></button>`);
    if (R.imApp('bautagebuch')) k.push(`<button class="erfassen-kachel" data-a="unter" data-id="tagebuch"><span class="sym">${Icon('foto')}</span><span><b>${esc(R.name('bautagebuch'))}</b><small>${esc(R.hinweis('bautagebuch') || 'Fotos und Notiz zum Tag')}</small></span></button>`);
    if (R.imApp('material') && R.an('material', 'sprache')) k.unshift(`<button class="erfassen-kachel gross sprach-kachel" data-sprache><span class="sym">${Icon('mikro')}</span><span><b>Einsprechen</b><small>Bestellung oder Erinnerung, einfach sagen</small></span></button>`);
    if (R.imApp('rechner')) k.push(`<button class="erfassen-kachel" data-rechner="lattung"><span class="sym">${Icon('rechner')}</span><span><b>Lattung</b><small>Latten und Befestiger für das Dach</small></span></button>`, `<button class="erfassen-kachel" data-rechner="uwert"><span class="sym">${Icon('rechner')}</span><span><b>U-Wert</b><small>Dämmwert für den Bauherrn</small></span></button>`);
    if (R.imApp('material')) k.push(`<button class="erfassen-kachel" data-a="unter" data-id="material"><span class="sym">${Icon('material')}</span><span><b>${esc(R.name('material') === 'Materialbedarf' ? 'Material' : R.name('material'))}</b><small>${esc(R.hinweis('material') || 'fehlt auf der Baustelle')}</small></span></button>`);
    const lager = R.imApp('lager') && R.an('lager', 'zweiKisten') ? Betrieb.appKisten(c) : '';
    return `<div class="unterseite-kopf"><h2>Erfassen</h2></div>${lager}${k.length ? `<div class="erfassen-raster">${k.join('')}</div>` : '<div class="a-karte"><div class="leer">Für dich ist noch nichts freigeschaltet.</div></div>'}`;
  };

  BILD.urlaub = (c) => {
    const k = c.urlaubKonto(c.ich.id);
    const eig = c.items.filter((i) => (i.typ === 'urlaub' || i.typ === 'krank') && i.pid === c.ich.id).sort((a, b) => b.von.localeCompare(a.von));
    return `<div class="unterseite-kopf"><h2>Urlaub</h2></div>
      <div class="a-karte stempel"><div class="status"><i style="background:var(--firma)"></i>Resturlaub ${c.heute.slice(0, 4)}</div><div class="zeit">${k.rest}<span style="font-size:18px;color:#6b7280;font-family:var(--schrift);font-weight:400"> von ${k.anspruch} Tagen</span></div>
      <div class="ort">${k.genommen} genommen${k.beantragt ? ` · ${k.beantragt} beantragt` : ''}</div>
      <button class="gross-knopf firma" data-a="unter" data-id="urlaubsantrag">${Icon('plus')} Urlaub beantragen</button>
      ${c.R.p('urlaub').krank === 'ja' ? `<button class="gross-knopf hell" style="margin-top:10px" data-a="unter" data-id="krank">${Icon('krank')} Krank melden</button>` : ''}</div>
      <div class="a-titel">Meine Anträge</div><div class="a-karte">${eig.map((u) => zeile({ sym: u.typ === 'krank' ? 'krank' : 'kalender', titel: `${u.typ === 'krank' ? 'Krank' : esc(u.art || 'Urlaub')}: ${Datum.kurz(u.von)} – ${Datum.kurz(u.bis)}`, unter: `${Zahl.tage(Datum.werktageZwischen(u.von, u.bis), 'Arbeitstag')}${u.notiz ? ' · ' + esc(u.notiz) : ''}`, rechts: status(u.status) })).join('') || '<div class="leer">Noch keine Anträge.</div>'}</div>`;
  };

  BILD.mehr = (c) => {
    const doks = c.items.filter((i) => i.typ === 'dokument' && (i.fuer === c.ich.id || i.fuer === 'alle')).sort((a, b) => b.erstellt - a.erstellt);
    return `<div class="unterseite-kopf"><h2>Mehr</h2></div>
      <div class="a-karte">${zeile({ sym: 'person', symKlasse: 'firma', titel: esc(c.ich.name), unter: `${esc(c.ich.funktion || '')} · ${esc(c.cfg.name)}` })}</div>
      ${c.R.imApp('nachrichten') || c.R.imApp('dokumente') ? `<div class="a-karte">${c.R.imApp('nachrichten') ? (() => { const n = Betrieb.ungelesen(c, c.ich.id, false); return `<button class="a-zeile" data-app-chat><span class="sym">${Icon('angebot')}</span><span class="text"><b>Nachrichten an das Büro</b><small>Fragen, Fotos, Absprachen</small></span>${n ? `<span class="rechts"><span class="a-zahl">${n}</span></span>` : ''}<span class="pfeil">${Icon('pfeil')}</span></button>`; })() : ''}<button class="a-zeile" data-app-ablage><span class="sym">${Icon('dokument')}</span><span class="text"><b>Meine Ablage</b><small>Stundenzettel, Lohnabrechnungen, Dokumente</small></span><span class="pfeil">${Icon('pfeil')}</span></button></div>` : ''}
      ${c.R.imApp('dokumente') ? `<div class="a-titel">Meine Dokumente</div><div class="a-karte">${doks.map((d) => zeile({ sym: 'dokument', titel: esc(d.titel), unter: d.gelesen ? 'gelesen' : '<b style="color:#c23a2b">neu</b>', a: 'dokument', id: d.id })).join('') || '<div class="leer">Noch keine Dokumente.</div>'}</div>` : ''}
      ${c.R.imApp('regie') ? (() => { const offen = c.typ('regie').filter((r) => r.pid === c.ich.id && r.status === 'offen'); return offen.length ? `<div class="a-titel">Noch nicht unterschrieben</div><div class="a-karte">${offen.map((r) => zeile({ sym: 'unterschrift', titel: esc(r.text), unter: `${Datum.kurz(r.datum)} · ${esc(c.bsName(r.bs))}`, a: 'regie-nach', id: r.id })).join('')}</div>` : ''; })() : ''}
      <div class="a-titel">Konto</div><div class="a-karte">${zeile({ sym: 'abmelden', titel: 'Abmelden', unter: 'Ein anderer Mitarbeiter meldet sich an', a: 'abmelden' })}${zeile({ sym: 'x', titel: 'Betrieb trennen', unter: 'Handy von diesem Betrieb lösen', a: 'trennen' })}</div>
      <p style="text-align:center;color:#9aa1ad;font-size:12px;margin-top:24px">${LOGO.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-4px;margin-right:6px"')}Richtwerk · Mitarbeiter-App 1.0</p>`;
  };

  BILD.freigaben = (c) => {
    const o = c.offen(); const darf = c.R.darfFreigeben(c.ich.rolle);
    let html = `<div class="unterseite-kopf"><h2>Freigaben</h2></div>`;
    if (!darf) html += `<div class="hinweis-box">Freigaben macht in diesem Betrieb nur der Chef.</div>`;
    if (o.urlaub.length) html += `<div class="a-titel">Urlaub</div><div class="a-karte">${o.urlaub.map((u) => `${zeile({ sym: 'kalender', titel: `${esc(c.person(u.pid).name)}: ${Datum.kurz(u.von)} – ${Datum.kurz(u.bis)}`, unter: `${Zahl.tage(Datum.werktageZwischen(u.von, u.bis))} · ${esc(u.art || 'Urlaub')}${u.notiz ? ' · ' + esc(u.notiz) : ''}` })}${darf ? `<div style="display:flex;gap:8px;padding:0 16px 14px"><button class="gross-knopf hell" style="padding:11px;font-size:15px" data-a="entscheide" data-id="${u.id}" data-wert="abgelehnt">Ablehnen</button><button class="gross-knopf firma" style="padding:11px;font-size:15px" data-a="entscheide" data-id="${u.id}" data-wert="genehmigt">Genehmigen</button></div>` : ''}`).join('')}</div>`;
    if (o.stunden.length) {
      const proPerson = {}; o.stunden.forEach((s) => { (proPerson[s.pid] = proPerson[s.pid] || []).push(s); });
      html += `<div class="a-titel">Stunden</div><div class="a-karte">${Object.entries(proPerson).map(([pid, l]) => zeile({ sym: 'uhr', titel: esc(c.person(pid).name), unter: `${l.length} Tage · ${Zahl.std(l.reduce((s, e) => s + stundenVon(e), 0))} Std.`, rechts: darf ? `<button class="a-status ok" style="border:0;padding:8px 12px;font-size:13px" data-a="stunden-frei" data-id="${pid}">Freigeben</button>` : '' })).join('')}</div>`;
    }
    const belege = o.belege.filter((b) => b.status === 'offen');
    if (belege.length) html += `<div class="a-titel">Belege über ${Zahl.eur(c.R.p('belege').grenze)}</div><div class="a-karte">${belege.map((b) => `${zeile({ sym: 'beleg', titel: `${Zahl.eur(b.betrag)} · ${esc(b.kategorie)}`, unter: `${esc(c.person(b.pid).name)} · ${esc(b.haendler || b.notiz || '')}` })}${darf ? `<div style="display:flex;gap:8px;padding:0 16px 14px"><button class="gross-knopf hell" style="padding:11px;font-size:15px" data-a="entscheide" data-id="${b.id}" data-wert="abgelehnt">Ablehnen</button><button class="gross-knopf firma" style="padding:11px;font-size:15px" data-a="entscheide" data-id="${b.id}" data-wert="freigegeben">Freigeben</button></div>` : ''}`).join('')}</div>`;
    if (o.material.length) html += `<div class="a-titel">Material</div><div class="a-karte">${o.material.map((m) => zeile({ sym: 'material', titel: esc(m.text), unter: `${esc(c.person(m.pid).name)} · ${esc(c.bsName(m.bs))}`, rechts: `<button class="a-status info" style="border:0;padding:8px 12px;font-size:13px" data-a="entscheide" data-id="${m.id}" data-wert="bestellt">Bestellt</button>` })).join('')}</div>`;
    if (!o.urlaub.length && !o.stunden.length && !belege.length && !o.material.length) html += `<div class="hinweis-box gruen">${Icon('haken')} Alles erledigt. Nichts wartet auf dich.</div>`;
    return html;
  };

  /* ---------- Unterseiten (Formulare) ---------- */
  const UNTER = {};

  UNTER.einstempeln = (c) => { const plan = c.geplant(c.ich.id, c.heute); return `${unterKopf('Arbeitsbeginn')}<p style="color:#6b7280;margin:-6px 4px 14px">Wo arbeitest du heute?</p>
    <div class="a-karte">${[...c.baustellenOffen()].sort((a, b) => (b.id === plan) - (a.id === plan)).map((b) => zeile({ sym: 'haus', symKlasse: b.id === plan ? 'firma' : '', titel: esc(b.name), unter: esc(b.ort) + (b.id === plan ? ' · laut Plan' : ''), a: 'einstempeln', id: b.id })).join('')}${zeile({ sym: 'start', titel: 'Ohne Baustelle', unter: 'Halle, Fahrt, Sonstiges', a: 'einstempeln', id: '' })}</div>`; };
  UNTER.wechsel = (c) => `${unterKopf('Baustelle wechseln')}<p style="color:#6b7280;margin:-6px 4px 14px">Die bisherige Zeit wird abgeschlossen, ab jetzt zählt die neue Baustelle.</p>
    <div class="a-karte">${c.baustellenOffen().map((b) => zeile({ sym: 'haus', titel: esc(b.name), unter: esc(b.ort), a: 'wechseln', id: b.id })).join('')}</div>`;

  UNTER.feierabend = (c) => {
    const d = zustand.daten;
    return `${unterKopf('Feierabend')}<div class="a-karte" style="padding:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="a-feld"><span>Beginn</span><input type="time" name="von" value="${esc(d.von)}"></label><label class="a-feld"><span>Ende</span><input type="time" name="bis" value="${esc(d.bis)}"></label></div>
      <label class="a-feld"><span>Pause (Minuten)</span><input type="number" name="pause" inputmode="numeric" value="${esc(d.pause)}"></label>
      ${c.R.mitBaustelle('stunden') ? bsAuswahl(c, d.bs) : ''}
      <label class="a-feld"><span>Was hast du gemacht?</span><input name="taetigkeit" placeholder="z. B. Sparren gesetzt" value="${esc(d.taetigkeit || '')}"></label>
      <button class="gross-knopf firma" data-a="speichere-feierabend">${Icon('haken')} Zeit speichern</button></div>
      <p style="color:#6b7280;font-size:13px;text-align:center">Gerundet auf ${c.R.p('stempeln').rundung} Min. · Pause nach Regel des Betriebs vorgeschlagen</p>`;
  };

  UNTER.stunden = (c) => {
    const min = Datum.plus(c.heute, -Number(c.R.p('stunden').nachtrag));
    return `${unterKopf('Stunden eintragen')}<div class="a-karte" style="padding:16px">
      <label class="a-feld"><span>Tag</span><input type="date" name="datum" value="${c.heute}" min="${min}" max="${c.heute}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="a-feld"><span>Beginn</span><input type="time" name="von" value="07:00"></label><label class="a-feld"><span>Ende</span><input type="time" name="bis" value="16:15"></label></div>
      <label class="a-feld"><span>Pause (Minuten)</span><input type="number" name="pause" inputmode="numeric" value="45"></label>
      ${c.R.mitBaustelle('stunden') ? bsAuswahl(c, (c.baustellenOffen()[0] || {}).id) : ''}
      <label class="a-feld"><span>Tätigkeit</span><input name="taetigkeit" placeholder="z. B. Abbund"></label>
      <button class="gross-knopf firma" data-a="speichere-stunden">${Icon('haken')} Speichern</button></div>`;
  };

  UNTER.urlaubsantrag = (c) => {
    let ab = Datum.plus(c.heute, Number(c.R.p('urlaub').vorlauf));
    while (!Datum.istArbeitstag(ab)) ab = Datum.plus(ab, 1);
    return `${unterKopf('Urlaub beantragen')}<div class="a-karte" style="padding:16px">
      <div class="a-feld"><span>Art</span><div class="a-chips" data-wahl="art">${['Urlaub', 'Überstundenabbau', 'Sonderurlaub'].map((a, i) => `<button type="button" class="${i ? '' : 'an'}" data-a="wahl" data-id="${a}">${a}</button>`).join('')}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="a-feld"><span>Von</span><input type="date" name="von" min="${ab}" value="${ab}"></label><label class="a-feld"><span>Bis</span><input type="date" name="bis" min="${ab}" value="${ab}"></label></div>
      <label class="a-feld"><span>Bemerkung (optional)</span><input name="notiz"></label>
      <p id="urlaub-tage" style="color:#6b7280;margin:0 0 14px">1 Arbeitstag</p>
      <button class="gross-knopf firma" data-a="speichere-urlaub">${Icon('haken')} Antrag senden</button></div>
      ${Number(c.R.p('urlaub').vorlauf) ? `<p style="color:#6b7280;font-size:13px;text-align:center">Urlaub bitte mindestens ${c.R.p('urlaub').vorlauf} Tage vorher beantragen.</p>` : ''}`;
  };

  UNTER.krank = (c) => `${unterKopf('Krank melden')}<div class="hinweis-box">Gute Besserung! Die Meldung geht sofort an ${esc(c.cfg.name)}. Die Krankmeldung vom Arzt (AU) bitte im Büro abgeben.</div>
    <div class="a-karte" style="padding:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="a-feld"><span>Ab</span><input type="date" name="von" value="${c.heute}"></label><label class="a-feld"><span>Voraussichtlich bis</span><input type="date" name="bis" value="${c.heute}"></label></div>
    <label class="a-feld"><span>Notiz (optional)</span><input name="notiz"></label><button class="gross-knopf rot" data-a="speichere-krank">Krank melden</button></div>`;

  UNTER.material = (c) => `${unterKopf('Material anfordern')}<div class="a-karte" style="padding:16px">
    ${c.R.mitBaustelle('material') ? bsAuswahl(c, (c.baustellenOffen()[0] || {}).id) : ''}
    <label class="a-feld"><span>Was fehlt?</span><textarea name="text" placeholder="z. B. 10 Bund Dachlatten 30/50"></textarea></label>
    ${Zusatz.app(c, 'material')}
    <button class="gross-knopf firma" data-a="speichere-material">${Icon('haken')} An den Chef senden</button></div>`;

  function scanFormular(c, art) {
    const d = zustand.daten; const istBeleg = art === 'beleg';
    const flaeche = d.bild
      ? `<div class="scan-flaeche"><img src="${d.anzeige || d.bild}" alt="Foto"><div class="ecken"><i></i><i></i><i></i><i></i></div></div>
         <div class="scan-werkzeuge"><button data-a="scanmodus" data-id="0" class="${d.scan ? '' : 'an'}">Original</button><button data-a="scanmodus" data-id="1" class="${d.scan ? 'an' : ''}">Dokument (s/w)</button><button data-a="foto">${Icon('kamera')} Neu</button></div>`
      : `<button class="scan-flaeche" data-a="foto" style="border:0;width:100%"><div class="ecken"><i></i><i></i><i></i><i></i></div><div class="leerhinweis">${Icon('kamera')}<div style="color:#fff;font-weight:600;font-size:16px">Foto aufnehmen</div><div style="font-size:13px;margin-top:4px">${istBeleg ? 'Quittung flach hinlegen' : 'Lieferschein flach hinlegen'}, gut ausleuchten</div></div></button>
         <button class="gross-knopf hell" style="margin:12px 0 16px" data-a="galerie">Aus der Galerie wählen</button>`;
    const felder = istBeleg
      ? `<label class="a-feld"><span>Betrag in €</span><input class="betrag" name="betrag" inputmode="decimal" placeholder="0,00" value="${esc(d.betrag || '')}"></label>
         <div class="a-feld"><span>Kategorie</span><div class="a-chips" data-wahl="kategorie">${c.R.liste('belege', 'kategorien').map((k, i) => `<button type="button" class="${(d.kategorie || c.R.liste('belege', 'kategorien')[0]) === k ? 'an' : ''}" data-a="wahl" data-id="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
         <label class="a-feld"><span>Geschäft (optional)</span><input name="haendler" value="${esc(d.haendler || '')}"></label>`
      : `<div class="a-feld"><span>Lieferant</span><div class="a-chips" data-wahl="lieferant">${c.R.liste('lieferscheine', 'lieferanten').map((k) => `<button type="button" class="${(d.lieferant || c.R.liste('lieferscheine', 'lieferanten')[0]) === k ? 'an' : ''}" data-a="wahl" data-id="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
         <label class="a-feld"><span>Lieferschein-Nr. (optional)</span><input name="nummer" value="${esc(d.nummer || '')}"></label>`;
    return `${unterKopf(istBeleg ? 'Beleg scannen' : 'Lieferschein')}${flaeche}
      <div class="a-karte" style="padding:16px">${felder}${c.R.mitBaustelle(istBeleg ? 'belege' : 'lieferscheine') ? bsAuswahl(c, d.bs !== undefined ? d.bs : (c.laeuft(c.ich.id) || c.baustellenOffen()[0] || {}).bs || (c.baustellenOffen()[0] || {}).id) : ''}
      <label class="a-feld"><span>Notiz (optional)</span><input name="notiz" value="${esc(d.notiz || '')}"></label>
      ${Zusatz.app(c, istBeleg ? 'belege' : 'lieferscheine', d.extra)}
      <button class="gross-knopf firma" data-a="speichere-scan" data-id="${art}" ${d.bild ? '' : 'disabled'}>${Icon('upload')} Ans Büro senden</button></div>`;
  }
  UNTER.beleg = (c) => scanFormular(c, 'beleg');
  UNTER.lieferschein = (c) => scanFormular(c, 'lieferschein');

  UNTER.gesendet = (c) => `<div style="text-align:center;padding:60px 20px"><div style="width:84px;height:84px;border-radius:50%;background:var(--firma-hell);color:var(--firma);display:grid;place-items:center;margin:0 auto 20px">${Icon('haken').replace('class="ic"', 'class="ic" style="width:42px;height:42px;stroke-width:2.2"')}</div>
    <h2 style="margin:0 0 8px">${esc(zustand.daten.titel || 'Gesendet')}</h2><p style="color:#6b7280;margin:0 0 28px">${esc(zustand.daten.text || 'Ist jetzt im Büro sichtbar.')}</p>
    <button class="gross-knopf firma" data-a="fertig">Fertig</button>${zustand.daten.nochmal ? `<button class="gross-knopf hell" style="margin-top:10px" data-a="unter" data-id="${zustand.daten.nochmal}">Noch einen</button>` : ''}</div>`;

  UNTER.dokument = (c) => {
    const d = c.items.find((i) => i.id === zustand.daten.id);
    return `${unterKopf(esc(d ? d.titel : 'Dokument'))}<div class="a-karte" id="dok-anzeige" style="min-height:300px"><div class="leer">Wird geladen …</div></div>`;
  };

  UNTER.tagebuch = (c) => {
    const d = zustand.daten; const fotos = d.fotos || []; const max = Number(c.R.p('bautagebuch').fotos);
    const vorschlag = d.bs !== undefined ? d.bs : ((c.laeuft(c.ich.id) || {}).bs || (c.baustelle(c.geplant(c.ich.id, c.heute)) ? c.geplant(c.ich.id, c.heute) : (c.baustellenOffen()[0] || {}).id));
    return `${unterKopf('Bautagebuch')}<div class="a-karte" style="padding:16px">
      ${bsAuswahl(c, vorschlag)}
      <div class="a-feld"><span>Wetter</span><div class="a-chips" data-wahl="wetter">${WETTER.map((w) => `<button type="button" class="${(d.wetter || 'sonnig') === w ? 'an' : ''}" data-a="wahl" data-id="${w}">${w}</button>`).join('')}</div></div>
      <label class="a-feld"><span>Was wurde gemacht? Besonderheiten?</span><textarea name="text" placeholder="z. B. Sparren gesetzt, Holz am Ortgang morsch">${esc(d.text || '')}</textarea></label>
      <div class="a-feld"><span>Fotos (${fotos.length} von ${max})</span><div class="foto-reihe">${fotos.map((f, i) => `<span class="foto"><img src="${f}" alt="Foto ${i + 1}"><button data-a="foto-weg" data-id="${i}" aria-label="Foto entfernen">${Icon('x')}</button></span>`).join('')}
        ${fotos.length < max ? `<button class="foto neu" data-a="tb-foto" aria-label="Foto aufnehmen">${Icon('kamera')}</button>` : ''}</div></div>
      ${Zusatz.app(c, 'bautagebuch', d.extra)}
      <button class="gross-knopf firma" data-a="speichere-tagebuch">${Icon('haken')} Speichern</button></div>`;
  };

  UNTER.regie = (c) => {
    const d = zustand.daten; const nach = d.id && c.items.find((i) => i.id === d.id);
    const satz = Number(c.R.p('regie').satz);
    const kopf = nach
      ? `<div class="a-karte">${zeile({ sym: 'unterschrift', titel: esc(nach.text), unter: `${Datum.kurz(nach.datum)} · ${esc(c.bsName(nach.bs))} · ${nach.leute > 1 ? nach.leute + ' × ' : ''}${Zahl.std(nach.stunden)} Std.` })}</div>`
      : `<div class="a-karte" style="padding:16px">
        ${bsAuswahl(c, d.bs !== undefined ? d.bs : ((c.laeuft(c.ich.id) || {}).bs || (c.baustellenOffen()[0] || {}).id))}
        <label class="a-feld"><span>Was wurde zusätzlich gemacht?</span><textarea name="text" placeholder="z. B. 2 Sparren ausgetauscht, morsch">${esc(d.text || '')}</textarea></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="a-feld"><span>Leute</span><input type="number" name="leute" inputmode="numeric" min="1" max="9" value="${esc(d.leute || 1)}"></label><label class="a-feld"><span>Stunden je Person</span><input name="stunden" inputmode="decimal" placeholder="z. B. 2,5" value="${esc(d.stunden || '')}"></label></div>
        <label class="a-feld"><span>Material (optional)</span><input name="material" placeholder="z. B. KVH 80x180, 2 x 5 m" value="${esc(d.material || '')}"></label>${Zusatz.app(c, 'regie', d.extra)}</div>`;
    return `${unterKopf(nach ? 'Unterschrift einholen' : 'Regiezettel')}${kopf}
      <div class="a-titel">Bestätigung durch den Kunden</div>
      <div class="a-karte" style="padding:16px"><label class="a-feld"><span>Name des Kunden</span><input name="kunde" value="${esc(d.kunde || (nach ? '' : (c.baustelle(d.bs || (c.laeuft(c.ich.id) || {}).bs) || {}).kunde || ''))}"></label>
        <div class="a-feld"><span>Unterschrift</span><div class="unterschrift-feld"><canvas id="unterschrift" aria-label="Hier mit dem Finger unterschreiben"></canvas><span class="linie">Hier mit dem Finger unterschreiben</span><button type="button" data-a="unterschrift-weg">Löschen</button></div></div>
        <p style="color:#6b7280;font-size:13px;margin:0 0 14px">Mit der Unterschrift bestätigt der Kunde die Zusatzarbeit. Abgerechnet wird nach Aufwand${satz ? ` (${Zahl.eur(satz)} je Stunde)` : ''}.</p>
        <button class="gross-knopf firma" data-a="speichere-regie" data-id="mit">${Icon('haken')} Unterschrieben speichern</button>
        ${!nach && c.R.p('regie').ohneUnterschrift === 'ja' ? `<button class="gross-knopf hell" style="margin-top:10px" data-a="speichere-regie" data-id="ohne">Kunde nicht da, später unterschreiben</button>` : ''}</div>`;
  };

  UNTER.eintrag = (c) => {
    const e = c.items.find((i) => i.id === zustand.daten.id);
    if (!e) return unterKopf('Eintrag');
    return `${unterKopf('Eintrag')}<div class="a-karte">${zeile({ sym: 'uhr', titel: `${Datum.mittel(e.datum)} · ${esc(e.von)} – ${esc(e.bis)}`, unter: `${Zahl.std(stundenVon(e))} Std. · Pause ${e.pause} Min.`, rechts: status(e.status) })}${zeile({ sym: 'haus', titel: esc(c.bsName(e.bs)), unter: esc(e.taetigkeit || '') })}</div>
      <p style="color:#6b7280;font-size:13px;margin:12px 4px">${e.status === 'abgelehnt' ? 'Dieser Eintrag wurde abgelehnt. Bitte löschen und neu eintragen.' : 'Noch nicht freigegeben. Du kannst ihn löschen und neu eintragen.'}</p>
      <button class="gross-knopf hell" data-a="loesche-eintrag" data-id="${e.id}">${Icon('muell')} Eintrag löschen</button>`;
  };

  /* Verbindung: offline erfasste Einträge werden nachgeschickt */
  function syncStatus() {
    const n = Store.offen; const online = navigator.onLine !== false;
    if (online && !n) return '';
    return `<span class="sync ${online ? '' : 'aus'}" role="status">${Icon('wolke')}${online ? `${n} wird gesendet` : n ? `Offline · ${n} warten` : 'Offline'}</span>`;
  }
  window.addEventListener('online', () => zeichne(false));
  window.addEventListener('offline', () => zeichne(false));

  /* ---------- Gesamtbild ---------- */
  function html(c, { reiter = zustand.reiter, unter = zustand.unter } = {}) {
    const tabs = reiterListe(c); const o = c.offen();
    const nFrei = o.urlaub.length + o.stunden.length + o.belege.filter((b) => b.status === 'offen').length + o.material.length;
    const ungelesen = c.items.filter((i) => i.typ === 'dokument' && (i.fuer === c.ich.id || i.fuer === 'alle') && !i.gelesen).length;
    const inhalt = unter && UNTER[unter] ? UNTER[unter](c) : (BILD[reiter] || BILD.start)(c);
    return `<div class="ui-app" style="--firma:${esc(c.cfg.farbe)}"><div class="app-rahmen">
      <header class="a-kopf"><span class="firmenzeichen">${esc(c.cfg.kuerzel || c.kuerzel(c.cfg.name))}</span><div class="titel"><b>${esc(c.cfg.name)}</b><small>${esc(c.ich.name)}</small></div>${syncStatus()}</header>
      <main class="a-inhalt">${inhalt}</main>
      <nav class="a-tabs" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs.map((t) => `<button class="${t.scan ? 'scan' : ''} ${reiter === t.id && !unter ? 'an' : ''}" data-a="reiter" data-id="${t.id}">${t.scan ? `<span class="kreis">${Icon(t.icon)}</span>` : Icon(t.icon)}${t.name}${t.id === 'freigaben' && nFrei ? `<span class="zahl">${nFrei}</span>` : ''}${t.id === 'mehr' && (ungelesen + (t.zahl || 0)) ? `<span class="zahl">${ungelesen + (t.zahl || 0)}</span>` : ''}</button>`).join('')}</nav>
    </div></div>`;
  }

  /* =====================================================================
     Anmeldung
     ===================================================================== */
  function anmeldungBetrieb(fehler = '') {
    Wurzel().innerHTML = `<div class="ui-app"><div class="app-rahmen" style="padding:0"><div class="a-login"><div class="oben">
      <div class="marke">${LOGO}</div><h1>Mit deinem Betrieb verbinden</h1><p>Die Betriebskennung bekommst du von deinem Chef oder aus dem Büro.</p>
      <form id="f-betrieb"><label class="a-feld"><span>Betriebskennung</span><input name="kennung" autocapitalize="none" autocomplete="off" spellcheck="false" required></label>
      <div class="fehlertext">${esc(fehler)}</div><button class="gross-knopf" type="submit">Weiter</button></form></div>
      <a href="#" style="color:#9aa1ad;font-size:13px;text-align:center;text-decoration:none">Richtwerk · Bereich wählen</a></div></div></div>`;
    $('#f-betrieb').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = await findeBetrieb(new FormData(e.target).get('kennung'));
      if (!b) return anmeldungBetrieb('Diese Betriebskennung gibt es nicht.');
      koppeln({ fid: b.fid, name: b.cfg.name, kuerzel: b.cfg.kuerzel, farbe: b.cfg.farbe });
      anmeldungCode();
    });
  }

  function anmeldungCode() {
    const b = gekoppelt(); let code = '';
    const punkte = () => `<div class="pin-punkte" id="pin">${[0, 1, 2, 3].map((i) => `<i class="${i < code.length ? 'voll' : ''}"></i>`).join('')}</div>`;
    Wurzel().innerHTML = `<div class="ui-app" style="--firma:${esc(b.farbe)}"><div class="app-rahmen" style="padding:0"><div class="a-login"><div class="oben">
      <div class="firmenzeile"><span class="firmenzeichen">${esc(b.kuerzel || '')}</span><b>${esc(b.name)}</b><button data-a="anderer">Ändern</button></div>
      <h1 style="text-align:center">Zugangscode</h1><p style="text-align:center">Gib deinen persönlichen Code ein.</p>
      <div id="pin-huelle">${punkte()}</div>
      <div class="ziffernblock">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((z) => `<button class="${z === '' ? 'leer' : ''}" data-z="${z}" ${z === '' ? 'disabled' : ''} aria-label="${z === '⌫' ? 'Löschen' : z}">${z}</button>`).join('')}</div>
      </div></div></div></div>`;
    const huelle = $('#pin-huelle');
    Wurzel().querySelector('.a-login').addEventListener('click', async (e) => {
      if (e.target.closest('[data-a="anderer"]')) { koppeln(null); return anmeldungBetrieb(); }
      const t = e.target.closest('[data-z]'); if (!t) return;
      const z = t.dataset.z;
      if (z === '⌫') code = code.slice(0, -1); else if (code.length < 4) code += z;
      huelle.innerHTML = punkte();
      if (code.length === 4) {
        const cfg = await Store.ladeCfg(b.fid);
        const p = cfg && cfg.personen.find((x) => x.code === code);
        if (!p) { $('#pin').classList.add('falsch'); setTimeout(() => { code = ''; huelle.innerHTML = punkte(); }, 450); return; }
        Sitzung.setze('app', { fid: b.fid, pid: p.id });
        zustand.reiter = 'start'; zustand.unter = null; start();
      }
    });
  }

  /* =====================================================================
     Ablauf
     ===================================================================== */
  function ctx() { return kontext(Store.cfg, Store.items, sitzung && sitzung.pid); }
  let uhrTimer = null;

  function start() {
    aktiverBereich = Handy;
    document.body.classList.add('app-modus');
    sitzung = Sitzung.lies('app');
    if (!sitzung) { aktiverBereich = null; return gekoppelt() ? anmeldungCode() : anmeldungBetrieb(); }
    Store.oeffne(sitzung.fid);
    Store.setzeBenutzer(sitzung.pid);
    zeichne(true);
    clearInterval(uhrTimer);
    uhrTimer = setInterval(() => {
      if (aktiverBereich !== Handy) return;
      const z = $('.stempel .zeit[data-seit]'); if (z) z.textContent = Zahl.hhmm((Date.now() - new Date(z.dataset.seit).getTime()) / 60000);
    }, 20000);
  }

  function zeichne(erzwingen = false) {
    if (aktiverBereich !== Handy) return;
    const c = ctx();
    if (!c.cfg) { Wurzel().innerHTML = `<div class="laden" style="background:#fff;color:#6b7280"><div>Wird geladen<div class="balken"><i></i></div></div></div>`; return; }
    if (!c.ich) { Sitzung.setze('app', null); aktiverBereich = null; return anmeldungCode(); }
    if (!erzwingen && zustand.unter && !['gesendet', 'dokument', 'eintrag'].includes(zustand.unter)) return; // Formular offen
    document.documentElement.style.setProperty('--firma', c.cfg.farbe);
    const scroll = window.scrollY;
    Wurzel().innerHTML = html(c);
    if (zustand.unter === 'dokument') dokumentLaden(c);
    if (zustand.unter === 'urlaubsantrag') urlaubstageZeigen();
    if (zustand.unter === 'regie') unterschriftVorbereiten();
    window.scrollTo(0, erzwingen ? 0 : scroll);
  }

  function geheZu(unter, daten = {}) { zustand.unter = unter; zustand.daten = daten; zeichne(true); }
  function werte() { const out = {}; $$('.a-inhalt [name]').forEach((el) => { out[el.name] = el.value; }); $$('.a-inhalt [data-wahl]').forEach((g) => { const an = $('.an', g); if (an) out[g.dataset.wahl] = an.dataset.id; }); return out; }
  function gesendet(titel, text, nochmal) { geheZu('gesendet', { titel, text, nochmal }); }

  function runde(min, schritt) { return Math.round(min / schritt) * schritt; }
  function jetztHHMM(rundung) { const d = new Date(); return Zahl.hhmm(runde(d.getHours() * 60 + d.getMinutes(), rundung)); }

  function dokumentLaden(c) {
    const d = c.items.find((i) => i.id === zustand.daten.id); if (!d) return;
    if (!d.gelesen) Store.aendere(d.id, { gelesen: true });
    bildFuer(d).then((url) => {
      const box = $('#dok-anzeige'); if (!box) return;
      box.innerHTML = url && url.startsWith('data:application/pdf')
        ? `<div style="padding:16px"><a class="gross-knopf firma" href="${url}" download="${esc(d.name || 'Dokument.pdf')}" style="text-decoration:none">${Icon('download')} PDF öffnen</a></div><iframe src="${url}" style="width:100%;height:60vh;border:0"></iframe>`
        : `<img src="${url}" style="width:100%;display:block">`;
    });
  }
  function urlaubstageZeigen() {
    const f = () => { const v = $('[name=von]').value; const b = $('[name=bis]').value; const n = v && b && b >= v ? Datum.werktageZwischen(v, b) : 0; $('#urlaub-tage').textContent = n === 1 ? '1 Arbeitstag' : `${n} Arbeitstage`; };
    $$('.a-inhalt input[type=date]').forEach((i) => i.addEventListener('change', () => { if (i.name === 'von' && $('[name=bis]').value < i.value) $('[name=bis]').value = i.value; f(); }));
    f();
  }

  /* Unterschrift mit Finger oder Maus */
  let unterschriftLeer = true;
  function unterschriftVorbereiten() {
    const cv = $('#unterschrift'); if (!cv) return;
    const r = cv.getBoundingClientRect(); const f = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * f; cv.height = r.height * f;
    const g = cv.getContext('2d'); g.scale(f, f); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1d2a4a';
    unterschriftLeer = true; let zieht = false;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener('pointerdown', (e) => { zieht = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); e.preventDefault(); });
    cv.addEventListener('pointermove', (e) => { if (!zieht) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); unterschriftLeer = false; cv.parentElement.classList.add('voll'); });
    const ende = () => { zieht = false; }; cv.addEventListener('pointerup', ende); cv.addEventListener('pointercancel', ende);
  }

  function tagebuchFoto() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { Object.assign(zustand.daten, werte()); const bild = await bildVerkleinern(f, { maxKante: 1100 }); zustand.daten.fotos = [...(zustand.daten.fotos || []), bild]; zeichne(true); }
      catch (err) { meldung(err.message, 'fehler'); }
    };
    inp.click();
  }

  function fotoAufnehmen(kamera) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    if (kamera) inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        Object.assign(zustand.daten, werte());
        const bild = await bildVerkleinern(f, { maxKante: 1300 });
        const scan = await bildVerkleinern(f, { maxKante: 1300, scan: true });
        Object.assign(zustand.daten, { bild, scanBild: scan, original: bild, scan: false, anzeige: bild });
        zeichne(true);
      } catch (err) { meldung(err.message, 'fehler'); }
    };
    inp.click();
  }

  /* ---------- Aktionen ---------- */
  document.addEventListener('click', (e) => {
    if (aktiverBereich !== Handy) return;
    const el = e.target.closest('[data-a]'); if (!el || !Wurzel().contains(el)) return;
    const fn = AKTION[el.dataset.a]; if (fn) { e.preventDefault(); fn(el, ctx()); }
  });

  const AKTION = {
    reiter(el) { zustand.reiter = el.dataset.id; zustand.unter = null; zeichne(true); },
    unter(el) { geheZu(el.dataset.id); },
    zurueck() { zustand.unter = null; zeichne(true); },
    fertig() { zustand.unter = null; zustand.reiter = 'start'; zeichne(true); },
    woche(el) { zustand.woche = Datum.plus(zustand.woche, Number(el.dataset.id)); zeichne(true); },
    wahl(el) { $$('button', el.parentElement).forEach((b) => b.classList.toggle('an', b === el)); },
    abmelden() { Sitzung.setze('app', null); aktiverBereich = null; anmeldungCode(); },
    trennen() { Sitzung.setze('app', null); koppeln(null); aktiverBereich = null; anmeldungBetrieb(); },
    dokument(el) { geheZu('dokument', { id: el.dataset.id }); },
    eintrag(el) { geheZu('eintrag', { id: el.dataset.id }); },
    'loesche-eintrag'(el) {
      if (!el.dataset.sicher) { el.dataset.sicher = '1'; el.classList.add('rot'); el.textContent = 'Wirklich löschen? Nochmal tippen'; return; }
      Store.loesche(el.dataset.id); zustand.unter = null; zeichne(true); meldung('Gelöscht');
    },
    'tb-foto'() { tagebuchFoto(); },
    'foto-weg'(el) { Object.assign(zustand.daten, werte()); zustand.daten.fotos.splice(Number(el.dataset.id), 1); zeichne(true); },
    async 'speichere-tagebuch'(el, c) {
      const w = werte(); const fotos = zustand.daten.fotos || [];
      if (!(w.text || '').trim() && !fotos.length) return meldung('Bitte ein Foto oder eine Notiz.', 'fehler');
      const extra = Zusatz.lesen($('.a-inhalt')); const fehlt = Zusatz.fehlt(c, 'bautagebuch', extra); if (fehlt) return meldung(`Bitte „${fehlt}“ ausfüllen.`, 'fehler');
      el.disabled = true; el.textContent = 'Wird gespeichert …';
      try {
        const ids = []; for (const f of fotos) ids.push(await Store.speichereDatei(f, 'foto.jpg'));
        Store.neu({ typ: 'tagebuch', pid: c.ich.id, datum: c.heute, bs: w.bs || '', wetter: w.wetter || '', text: (w.text || '').trim(), fotos: ids, extra });
        gesendet('Im Bautagebuch', ids.length ? `${ids.length} ${ids.length === 1 ? 'Foto' : 'Fotos'} gespeichert. Das Büro sieht sie bei der Baustelle.` : 'Das Büro sieht den Eintrag bei der Baustelle.', 'tagebuch');
      } catch (err) { el.disabled = false; el.textContent = 'Speichern'; meldung(err.message, 'fehler'); }
    },
    'unterschrift-weg'() { const cv = $('#unterschrift'); if (cv) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv.parentElement.classList.remove('voll'); unterschriftLeer = true; } },
    'regie-nach'(el) { geheZu('regie', { id: el.dataset.id }); },
    async 'speichere-regie'(el, c) {
      const w = werte(); const mit = el.dataset.id === 'mit'; const nach = zustand.daten.id;
      if (mit && unterschriftLeer) return meldung('Bitte den Kunden unterschreiben lassen.', 'fehler');
      if (mit && !(w.kunde || '').trim()) return meldung('Bitte den Namen des Kunden eintragen.', 'fehler');
      let neu = null;
      if (!nach) {
        const stunden = Number(String(w.stunden || '').replace(',', '.'));
        if (!(w.text || '').trim()) return meldung('Was wurde zusätzlich gemacht?', 'fehler');
        if (!stunden || stunden <= 0) return meldung('Bitte die Stunden eintragen.', 'fehler');
        const extra = Zusatz.lesen($('.a-inhalt')); const fehlt = Zusatz.fehlt(c, 'regie', extra); if (fehlt) return meldung(`Bitte „${fehlt}“ ausfüllen.`, 'fehler');
        neu = { typ: 'regie', pid: c.ich.id, datum: c.heute, bs: w.bs || '', text: w.text.trim(), leute: Math.max(1, Number(w.leute) || 1), stunden, material: (w.material || '').trim(), extra };
      }
      el.disabled = true;
      try {
        let unterschrift = '';
        if (mit) unterschrift = await Store.speichereDatei($('#unterschrift').toDataURL('image/png'), 'unterschrift.png');
        const felder = { kunde: (w.kunde || '').trim(), unterschrift, status: mit ? 'unterschrieben' : 'offen', ...(mit ? { unterschriebenAm: Date.now() } : {}) };
        if (nach) Store.aendere(nach, felder); else Store.neu({ ...neu, ...felder });
        gesendet(mit ? 'Unterschrieben' : 'Gespeichert', mit ? 'Der Regiezettel liegt im Büro zur Abrechnung.' : 'Unter „Mehr“ kann der Kunde später unterschreiben.');
      } catch (err) { el.disabled = false; meldung(err.message, 'fehler'); }
    },
    foto() { fotoAufnehmen(true); },
    galerie() { fotoAufnehmen(false); },
    scanmodus(el) { Object.assign(zustand.daten, werte()); const s = el.dataset.id === '1'; Object.assign(zustand.daten, { scan: s, bild: s ? zustand.daten.scanBild : zustand.daten.original, anzeige: s ? zustand.daten.scanBild : zustand.daten.original }); zeichne(true); },

    einstempeln(el, c) {
      const bs = el.dataset.id || '';
      Store.neu({ typ: 'stunden', pid: c.ich.id, datum: c.heute, von: jetztHHMM(Number(c.R.p('stempeln').rundung)), bis: '', pause: 0, bs, taetigkeit: '', quelle: 'stempeln', status: 'laeuft' });
      zustand.unter = null; zustand.reiter = 'start'; zeichne(true);
      meldung('Eingestempelt. Gute Arbeit!');
    },
    wechseln(el, c) {
      const l = c.laeuft(c.ich.id); if (!l) return;
      const jetzt = jetztHHMM(Number(c.R.p('stempeln').rundung));
      if (jetzt > l.von) Store.aendere(l.id, { bis: jetzt, status: startStatus(c.R, 'stunden') }); else Store.loesche(l.id);
      Store.neu({ typ: 'stunden', pid: c.ich.id, datum: c.heute, von: jetzt, bis: '', pause: 0, bs: el.dataset.id, taetigkeit: '', quelle: 'stempeln', status: 'laeuft' });
      zustand.unter = null; zeichne(true); meldung('Baustelle gewechselt');
    },
    feierabend(el, c) {
      const l = c.laeuft(c.ich.id); if (!l) return;
      const p = c.R.p('stempeln'); const bis = jetztHHMM(Number(p.rundung));
      const dauer = Zahl.min(bis) - Zahl.min(l.von);
      const pause = dauer > 9 * 60 ? Number(p.pause9) : dauer > 6 * 60 ? Number(p.pause6) : 0;
      geheZu('feierabend', { id: l.id, von: l.von, bis: bis > l.von ? bis : l.von, pause, bs: l.bs });
    },
    'speichere-feierabend'(el, c) {
      const w = werte(); if (!w.bis || w.bis <= w.von) return meldung('Das Ende muss nach dem Beginn liegen.', 'fehler');
      Store.aendere(zustand.daten.id, { von: w.von, bis: w.bis, pause: Number(w.pause) || 0, bs: w.bs !== undefined ? w.bs : zustand.daten.bs, taetigkeit: w.taetigkeit, status: startStatus(c.R, 'stunden') });
      gesendet('Feierabend!', `${Zahl.std((Zahl.min(w.bis) - Zahl.min(w.von) - (Number(w.pause) || 0)) / 60)} Stunden gespeichert.`);
    },
    'speichere-stunden'(el, c) {
      const w = werte(); if (!w.bis || w.bis <= w.von) return meldung('Das Ende muss nach dem Beginn liegen.', 'fehler');
      if (w.datum < Datum.plus(c.heute, -Number(c.R.p('stunden').nachtrag))) return meldung('So weit zurück darfst du nicht nachtragen. Bitte im Büro melden.', 'fehler');
      const std = (Zahl.min(w.bis) - Zahl.min(w.von) - (Number(w.pause) || 0)) / 60;
      Store.neu({ typ: 'stunden', pid: c.ich.id, datum: w.datum, von: w.von, bis: w.bis, pause: Number(w.pause) || 0, bs: w.bs || '', taetigkeit: w.taetigkeit, quelle: 'app', status: startStatus(c.R, 'stunden') });
      gesendet('Gespeichert', std > Number(c.R.p('stunden').maxTag) ? `${Zahl.std(std)} Stunden. Das ist ein langer Tag, das Büro sieht einen Hinweis.` : `${Zahl.std(std)} Stunden eingetragen.`, 'stunden');
    },
    'speichere-urlaub'(el, c) {
      const w = werte(); if (!w.von || !w.bis || w.bis < w.von) return meldung('Bitte Zeitraum prüfen.', 'fehler');
      if (!Datum.werktageZwischen(w.von, w.bis)) return meldung('In diesem Zeitraum liegt kein Arbeitstag.', 'fehler');
      Store.neu({ typ: 'urlaub', pid: c.ich.id, von: w.von, bis: w.bis, art: w.art || 'Urlaub', notiz: w.notiz, status: startStatus(c.R, 'urlaub') });
      gesendet(c.R.freigabe('urlaub') ? 'Antrag gesendet' : 'Eingetragen', c.R.freigabe('urlaub') ? 'Du bekommst Bescheid, sobald er entschieden ist.' : 'Dein Urlaub ist eingetragen.');
    },
    'speichere-krank'(el, c) {
      const w = werte(); Store.neu({ typ: 'krank', pid: c.ich.id, von: w.von, bis: w.bis < w.von ? w.von : w.bis, notiz: w.notiz, status: 'gemeldet', au: false });
      const l = c.laeuft(c.ich.id); if (l) Store.loesche(l.id);
      gesendet('Gute Besserung', 'Das Büro weiß Bescheid.');
    },
    'speichere-material'(el, c) {
      const w = werte(); if (!w.text || !w.text.trim()) return meldung('Was fehlt denn?', 'fehler');
      const extra = Zusatz.lesen($('.a-inhalt')); const fehlt = Zusatz.fehlt(c, 'material', extra); if (fehlt) return meldung(`Bitte „${fehlt}“ ausfüllen.`, 'fehler');
      Store.neu({ typ: 'material', pid: c.ich.id, datum: c.heute, bs: w.bs || '', text: w.text.trim(), extra, status: 'offen' });
      gesendet('Gesendet', 'Der Chef sieht deine Anforderung.', 'material');
    },
    async 'speichere-scan'(el, c) {
      const art = el.dataset.id; const w = werte(); const d = zustand.daten;
      if (!d.bild) return;
      const extra = Zusatz.lesen($('.a-inhalt')); const fehlt = Zusatz.fehlt(c, art === 'beleg' ? 'belege' : 'lieferscheine', extra);
      if (fehlt) return meldung(`Bitte „${fehlt}“ ausfüllen.`, 'fehler');
      let betrag = 0;
      if (art === 'beleg') { betrag = Number(String(w.betrag || '').replace(/\./g, '').replace(',', '.')); if (!betrag || betrag <= 0) return meldung('Bitte den Betrag eingeben.', 'fehler'); }
      el.disabled = true; el.innerHTML = 'Wird gesendet …';
      try {
        const datei = await Store.speichereDatei(d.bild, `${art}.jpg`);
        if (art === 'beleg') {
          Store.neu({ typ: 'beleg', pid: c.ich.id, datum: c.heute, betrag, kategorie: w.kategorie, haendler: w.haendler, bs: w.bs || '', notiz: w.notiz, datei, extra, status: startStatus(c.R, 'beleg', { betrag }) });
          gesendet('Beleg gesendet', `${Zahl.eur(betrag)} · ${w.kategorie}. Den Zettel kannst du wegwerfen, wenn der Chef es sagt.`, 'beleg');
        } else {
          Store.neu({ typ: 'lieferschein', pid: c.ich.id, datum: c.heute, lieferant: w.lieferant, nummer: w.nummer, bs: w.bs || '', notiz: w.notiz, datei, extra, status: 'neu' });
          gesendet('Lieferschein gesendet', 'Liegt jetzt beim Auftrag im Büro.', 'lieferschein');
        }
      } catch (err) { el.disabled = false; el.textContent = 'Ans Büro senden'; meldung(err.message, 'fehler'); }
    },
    entscheide(el, c) {
      const e = c.items.find((i) => i.id === el.dataset.id); const wert = el.dataset.wert;
      Store.aendere(el.dataset.id, { status: wert, ...(e && e.typ === 'urlaub' ? { entschieden: Date.now() } : {}) });
      meldung(wert === 'abgelehnt' ? 'Abgelehnt' : 'Erledigt');
    },
    'stunden-frei'(el, c) { c.offen().stunden.filter((s) => s.pid === el.dataset.id).forEach((s) => Store.aendere(s.id, { status: 'freigegeben', freigabeVon: c.ich.id })); meldung('Stunden freigegeben'); },
  };

  return { start, neuZeichnen: () => zeichne(false), html, BILD };
})();
