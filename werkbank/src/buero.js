/* =========================================================================
   Betriebszentrale (Büro am Computer)
   Seiten werden als HTML-Text erzeugt (html(seite, kontext)), damit das
   Entwickler-Tool dieselben Seiten als Vorschau zeigen kann.
   ========================================================================= */
const Buero = (() => {
  const zustand = { seite: 'uebersicht', woche: Datum.montag(Datum.heute()), monat: Datum.heute().slice(0, 7), filter: {}, navOffen: false, akte: null, stundenAnsicht: 'woche', planWoche: Datum.montag(Datum.heute()) };
  const kompakt = () => window.innerWidth < 820;
  let warKompakt = null;
  window.addEventListener('resize', () => { if (aktiverBereich === Buero && kompakt() !== warKompakt) zeichne(); });

  const NAV = [
    { id: 'uebersicht', name: 'Übersicht', icon: 'start', gruppe: 'Betrieb' },
    { id: 'plan', name: 'Wochenplan', icon: 'plan', braucht: 'wochenplan', gruppe: 'Betrieb' },
    { id: 'stunden', name: 'Stunden', icon: 'uhr', braucht: 'stunden', gruppe: 'Betrieb', zahl: (o) => o.stunden.length },
    { id: 'urlaub', name: 'Urlaub & Krank', icon: 'kalender', braucht: 'urlaub', gruppe: 'Betrieb', zahl: (o) => o.urlaub.length },
    { id: 'belege', name: 'Belege', icon: 'beleg', braucht: 'belege', gruppe: 'Unterlagen', zahl: (o) => o.belege.length },
    { id: 'lieferscheine', name: 'Lieferscheine', icon: 'liefer', braucht: 'lieferscheine', gruppe: 'Unterlagen', zahl: (o) => o.lieferscheine.length },
    { id: 'material', name: 'Materialbedarf', icon: 'material', braucht: 'material', gruppe: 'Unterlagen', zahl: (o) => o.material.length },
    { id: 'tagelohn', name: 'Tagelöhner', icon: 'helfer', braucht: 'tagelohn', gruppe: 'Unterlagen', zahl: (o) => o.tagelohn.length },
    { id: 'steuer', name: 'Steuerbüro', icon: 'paket', braucht: ['export', 'dokumente'], gruppe: 'Unterlagen' },
    { id: 'baustellen', name: 'Baustellen', icon: 'haus', braucht: 'baustellen', gruppe: 'Stammdaten', zahl: (o) => o.regie.filter((r) => r.status === 'offen').length },
    { id: 'team', name: 'Team & Zugänge', icon: 'team', gruppe: 'Stammdaten' },
    { id: 'einstellungen', name: 'Einstellungen', icon: 'zahnrad', gruppe: 'Stammdaten', nurChef: true },
  ];
  /* Erweiterungen aus anderen Dateien (z. B. Angebote & Rechnungen) */
  const EXTRA = { aufgaben: [], einstellungen: [], akte: [] };
  function erweitern({ nav = [], seiten = {}, aktionen = {}, aufgaben, einstellungen, akte }) {
    if (akte) EXTRA.akte.push(akte);
    if (einstellungen) { if (einstellungen.vorne) EXTRA.einstellungen.unshift(einstellungen); else EXTRA.einstellungen.push(einstellungen); }
    nav.forEach((n) => { let i = -1; NAV.forEach((x, j) => { if (x.gruppe === n.gruppe) i = j; }); if (i < 0) i = NAV.findIndex((x) => x.id === 'baustellen') - 1; NAV.splice(i + 1, 0, n); });
    Object.assign(SEITEN, seiten); Object.assign(AKTION, aktionen);
    if (aufgaben) EXTRA.aufgaben.push(aufgaben);
  }
  const sichtbar = (n, c) => {
    if (n.nurChef && c.ich && c.ich.rolle !== 'chef') return false;
    if (!n.braucht) return true;
    return [].concat(n.braucht).some((t) => c.R.hat(t));
  };

  /* ---------- Helfer für Tabellen ---------- */
  const personZelle = (c, p, unter = '') => `<div class="person"><span class="ava">${esc(c.kuerzel(p.name))}</span><div>${esc(p.name)}${unter ? `<small>${esc(unter)}</small>` : ''}</div></div>`;
  const seitenkopf = (titel, unter, rechts = '') => `<div class="seitenkopf"><div><h1>${titel}</h1>${unter ? `<p>${unter}</p>` : ''}</div><div class="rechts">${rechts}</div></div>`;
  const leer = (text) => `<div class="leer">${text}</div>`;
  const verlauf = (c, e) => {
    const v = (e && e.verlauf) || []; if (!v.length) return '';
    const l = v[v.length - 1]; const d = new Date(l.wann);
    return `<p class="verlauf">Zuletzt geändert ${l.wer === 'kunde' ? 'vom Kunden (online) ' : l.wer ? 'von ' + esc(c.person(l.wer).name) + ' ' : ''}am ${Datum.kurz(Datum.iso(d))} um ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr</p>`;
  };
  const bsOptionen = (c, gewaehlt, mitLeer = true) => (mitLeer ? `<option value="">ohne Baustelle</option>` : '') + c.baustellenOffen().map((b) => `<option value="${b.id}" ${b.id === gewaehlt ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const personOptionen = (c, gewaehlt, liste = c.arbeiter()) => liste.map((p) => `<option value="${p.id}" ${p.id === gewaehlt ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  /* =====================================================================
     Seiten
     ===================================================================== */
  const SEITEN = {};

  SEITEN.uebersicht = (c) => {
    const o = c.offen();
    const arbeiter = c.arbeiter();
    const imEinsatz = arbeiter.filter((p) => c.laeuft(p.id));
    const wo = Datum.montag(c.heute);
    const stdWoche = arbeiter.reduce((s, p) => s + c.stundenSumme(p.id, wo, Datum.plus(wo, 6)), 0);
    const monat = c.heute.slice(0, 7);
    const belegeMonat = c.typ('beleg').filter((b) => b.datum.startsWith(monat));
    const stunde = new Date().getHours();
    const gruss = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend';
    const zuPruefen = o.stunden.length + o.urlaub.length + o.belege.length + o.lieferscheine.length + o.material.length + o.tagelohn.length;

    // Heute auf den Baustellen
    const gruppen = {};
    for (const p of arbeiter) {
      const l = c.laeuft(p.id); const abw = c.abwesend(p.id, c.heute);
      const schluessel = l ? (l.bs || '_ohne') : abw ? '_abw' : '_nicht';
      (gruppen[schluessel] = gruppen[schluessel] || []).push({ p, l, abw });
    }
    const gruppeHtml = Object.entries(gruppen).sort(([a], [b]) => (a.startsWith('_') ? 1 : 0) - (b.startsWith('_') ? 1 : 0)).map(([k, liste]) => {
      const titel = k === '_abw' ? 'Abwesend' : k === '_nicht' ? 'Noch nicht gestempelt' : k === '_ohne' ? 'Ohne Baustelle' : c.bsName(k);
      const ort = !k.startsWith('_') && c.baustelle(k) ? c.baustelle(k).ort : '';
      return `<div class="liste-zeile" style="align-items:flex-start"><div class="text"><b>${esc(titel)}</b>${ort ? `<small>${esc(ort)}</small>` : ''}</div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:220px">${liste.map(({ p, l, abw }) => `<div class="person"><span class="ava">${esc(c.kuerzel(p.name))}</span><div>${esc(p.name)}<small>${l ? 'seit ' + esc(l.von) + ' Uhr' : abw ? (abw.typ === 'krank' ? 'krank gemeldet' : esc(abw.art || 'Urlaub')) : Datum.istWerktag(c.heute) ? '–' : 'Wochenende'}</small></div></div>`).join('')}</div></div>`;
    }).join('');

    // Zu erledigen
    const aufgaben = [];
    o.urlaub.forEach((u) => {
      const p = c.person(u.pid);
      aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${esc(p.name)}: ${esc(u.art || 'Urlaub')}</b><small>${Datum.kurz(u.von)} bis ${Datum.kurz(u.bis)} · ${Zahl.tage(Datum.werktageZwischen(u.von, u.bis), 'Arbeitstag')}${u.notiz ? ' · ' + esc(u.notiz) : ''}</small></div>
        <div class="aktionen"><button class="k klein ok" data-a="urlaub-ja" data-id="${u.id}">Genehmigen</button><button class="k klein nein" data-a="urlaub-nein" data-id="${u.id}">Ablehnen</button></div></div>`);
    });
    if (o.stunden.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${o.stunden.length} Stundeneinträge freigeben</b><small>${[...new Set(o.stunden.map((s) => c.person(s.pid).name.split(' ')[0]))].join(', ')}</small></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="stunden">Ansehen</button></div></div>`);
    if (o.belege.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${o.belege.length} Belege prüfen</b><small>zusammen ${Zahl.eur(o.belege.reduce((s, b) => s + Number(b.betrag || 0), 0))}</small></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="belege">Ansehen</button></div></div>`);
    if (o.lieferscheine.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${o.lieferscheine.length} neue Lieferscheine</b><small>${[...new Set(o.lieferscheine.map((l) => l.lieferant))].join(', ')}</small></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="lieferscheine">Ansehen</button></div></div>`);
    if (c.R.hat('stunden')) {
      const fehlt = [];
      for (let d = Datum.montag(c.heute); d < c.heute; d = Datum.plus(d, 1)) {
        if (!Datum.istArbeitstag(d)) continue;
        for (const p of arbeiter) if (!c.stundenAm(p.id, d).length && !c.abwesend(p.id, d)) fehlt.push(`${p.name.split(' ')[0]} (${Datum.WT[Datum.wochentag(d)]})`);
      }
      if (fehlt.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>Stunden fehlen</b><small>${esc(fehlt.join(', '))}</small></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="stunden">Ansehen</button></div></div>`);
    }
    const regieOffen = o.regie.filter((r) => r.status === 'unterschrieben');
    if (regieOffen.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${regieOffen.length} Regiezettel abrechnen</b><small>zusammen ${Zahl.eur(regieOffen.reduce((s, r) => s + regieBetrag(c, r), 0))} · unterschrieben vom Kunden</small></div><div class="aktionen"><button class="k klein" data-a="regie" data-id="${regieOffen[0].id}">Ansehen</button></div></div>`);
    EXTRA.aufgaben.forEach((fn) => fn(c).forEach((t) => aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${esc(t.titel)}</b><small>${esc(t.unter)}</small></div><div class="aktionen">${t.erinnerung ? `<button class="k klein ok" data-erinnerung="${t.erinnerung}">${Icon('haken')} Erledigt</button>` : `<button class="k klein" data-a="${t.a}" data-id="${t.id}">Ansehen</button>`}</div></div>`)));
    if (o.material.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${o.material.length} Materialwünsche</b><small>${esc(o.material.map((m) => m.text).join(' · ').slice(0, 90))}</small></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="material">Ansehen</button></div></div>`);
    if (o.tagelohn.length) aufgaben.push(`<div class="liste-zeile"><div class="text"><b>${o.tagelohn.length} Tagelohn-Einsätze freigeben</b></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="tagelohn">Ansehen</button></div></div>`);
    if (c.R.hat('export')) {
      const stich = Number(c.R.p('export').stichtag); const tag = Number(c.heute.slice(8, 10));
      if (tag <= stich + 2) {
        const vm = Datum.plus(c.heute.slice(0, 8) + '01', -1).slice(0, 7);
        aufgaben.push(`<div class="liste-zeile"><div class="text"><b>Paket ${esc(Datum.monatName(vm))} an das Steuerbüro</b><small>fällig bis ${stich}. ${esc(Datum.monatName(c.heute.slice(0, 7)).split(' ')[0])}</small></div><div class="aktionen"><button class="k klein" data-a="gehe" data-id="steuer">Öffnen</button></div></div>`);
      }
    }

    return seitenkopf(`${gruss}${c.ich ? ', ' + esc(c.ich.name.split(' ')[0]) : ''}`, esc(Datum.lang(c.heute)))
      + `<div class="kacheln">
        <div class="kachel"><div class="titel">Heute im Einsatz</div><div class="wert">${imEinsatz.length}<small> / ${arbeiter.length}</small></div><div class="fuss">eingestempelt</div></div>
        <button class="kachel ${zuPruefen ? 'achtung' : ''}" data-a="gehe" data-id="${o.urlaub.length ? 'urlaub' : o.stunden.length ? 'stunden' : 'belege'}"><div class="titel">Wartet auf Sie</div><div class="wert">${zuPruefen}</div><div class="fuss">Freigaben und neue Unterlagen</div></button>
        ${c.R.hat('stunden') ? `<button class="kachel" data-a="gehe" data-id="stunden"><div class="titel">Stunden KW ${Datum.kw(c.heute)}</div><div class="wert">${Zahl.std(stdWoche)}</div><div class="fuss">alle Mitarbeiter zusammen</div></button>` : ''}
        ${c.R.hat('belege') ? `<button class="kachel" data-a="gehe" data-id="belege"><div class="titel">Belege ${esc(Datum.monatName(monat).split(' ')[0])}</div><div class="wert">${Zahl.eur(belegeMonat.reduce((s, b) => s + Number(b.betrag || 0), 0))}</div><div class="fuss">${belegeMonat.length} Belege</div></button>` : ''}
      </div>
      <div class="zwei">
        <div class="karte"><div class="kopf"><h3>Heute auf den Baustellen</h3></div>${arbeiter.length ? gruppeHtml : leer('Noch keine Mitarbeiter angelegt. Unter „Team & Zugänge“ hinzufügen.')}</div>
        <div class="karte"><div class="kopf"><h3>Zu erledigen</h3></div>${aufgaben.join('') || leer('Alles erledigt.')}</div>
      </div>`;
  };

  const regieStunden = (r) => Number(r.stunden || 0) * Number(r.leute || 1);
  const regieBetrag = (c, r) => regieStunden(r) * Number(c.R.p('regie').satz || 0);
  const ansichtWahl = () => `<span class="segment"><button class="${zustand.stundenAnsicht === 'woche' ? 'an' : ''}" data-a="stunden-ansicht" data-id="woche">Woche</button><button class="${zustand.stundenAnsicht === 'monat' ? 'an' : ''}" data-a="stunden-ansicht" data-id="monat">Monat</button></span>`;

  SEITEN.stunden = (c) => {
    if (zustand.stundenAnsicht === 'monat') return stundenMonat(c);
    const wo = zustand.woche; const tage = Array.from({ length: 7 }, (_, i) => Datum.plus(wo, i));
    const mitWE = c.typ('stunden').some((s) => s.datum >= tage[5] && s.datum <= tage[6]);
    const spalten = mitWE ? tage : tage.slice(0, 5);
    const soll = Number(c.R.p('stunden').soll);
    const offeneWoche = c.typ('stunden').filter((s) => s.datum >= wo && s.datum <= tage[6] && s.status === 'offen');
    const zeilen = c.arbeiter().map((p) => {
      let summe = 0;
      const zellen = spalten.map((d) => {
        const eintr = c.stundenAm(p.id, d); const h = eintr.reduce((s, e) => s + stundenVon(e), 0); summe += h;
        const abw = c.abwesend(p.id, d);
        let klasse = 'leer'; let text = '–';
        if (eintr.some((e) => e.status === 'laeuft')) { klasse = 'laeuft'; text = 'ab ' + eintr.find((e) => e.status === 'laeuft').von; }
        else if (eintr.length) { klasse = eintr.some((e) => e.status === 'offen') ? 'offen' : ''; text = Zahl.std(h); if (eintr.some((e) => e.taetigkeit === 'Berufsschule')) text += ' BS'; }
        else if (abw) { klasse = 'abw'; text = abw.typ === 'krank' ? 'Krank' : 'Urlaub'; }
        else if (d > c.heute) text = '';
        return `<td class="zelle-std ${klasse}" data-a="tag" data-pid="${p.id}" data-datum="${d}" title="${esc(p.name)}, ${Datum.mittel(d)}">${text}</td>`;
      }).join('');
      const pSoll = Number(p.soll) || soll; const diff = summe - pSoll;
      const offen = c.typ('stunden').filter((s) => s.pid === p.id && s.datum >= wo && s.datum <= tage[6] && s.status === 'offen').length;
      return `<tr><td>${personZelle(c, p, p.funktion)}</td>${zellen}<td class="r num"><b>${Zahl.std(summe)}</b></td><td class="r num" style="color:${diff < 0 ? '#8a6a2a' : '#2e7d4f'}">${diff >= 0 ? '+' : ''}${Zahl.std(diff)}</td><td>${offen ? chip('offen') : summe ? chip('freigegeben') : ''}</td></tr>`;
    }).join('');
    const kopf = spalten.map((d) => `<th class="zelle-std" style="cursor:default${d === c.heute ? ';color:var(--firma)' : ''}">${Datum.WT[Datum.wochentag(d)]} ${Datum.kurz(d)}</th>`).join('');
    return seitenkopf('Stunden', `Kalenderwoche ${Datum.kw(wo)} · Soll ${soll} Std. pro Woche${c.R.freigabe('stunden') ? ' · Freigabe durch ' + (c.R.p('freigabe').wer === 'Chef' ? 'den Chef' : 'Chef oder Büro') : ''}`,
      `${ansichtWahl()}<span class="wochenwahl"><button class="k klein" data-a="woche" data-id="-7" aria-label="Vorige Woche">${Icon('zurueck')}</button><b>${Datum.kurz(wo)} – ${Datum.kurz(tage[6])}${tage[6].slice(0, 4)}</b><button class="k klein" data-a="woche" data-id="7" aria-label="Nächste Woche">${Icon('pfeil')}</button></span>
       <button class="k" data-a="woche" data-id="0">Diese Woche</button>
       <button class="k" data-a="stunden-neu">${Icon('plus')} Eintrag</button>
       ${c.R.freigabe('stunden') && c.R.darfFreigeben(c.ich && c.ich.rolle) ? `<button class="k haupt" data-a="woche-frei" ${offeneWoche.length ? '' : 'disabled'}>${Icon('haken')} Woche freigeben${offeneWoche.length ? ` (${offeneWoche.length})` : ''}</button>` : ''}`)
      + `<div class="karte"><div class="tabelle-huelle"><table class="t"><thead><tr><th>Mitarbeiter</th>${kopf}<th class="r">Summe</th><th class="r">± Soll</th><th>Status</th></tr></thead><tbody>${zeilen || `<tr><td colspan="10">${leer('Keine Mitarbeiter mit Wochenstunden.')}</td></tr>`}</tbody></table></div>
        <div class="legende"><span><i style="background:var(--warn)"></i>zu prüfen</span><span><i style="background:var(--info)"></i>gerade eingestempelt</span><span>BS = Berufsschule</span><span>Klick auf ein Feld: Tag ansehen und ändern</span></div></div>`;
  };

  function stundenMonat(c) {
    const ym = zustand.monat;
    const zeilen = c.arbeiter().map((p) => {
      const n = c.monatsnachweis(p.id, ym); const konto = c.konto(p.id, ym);
      const farbe = (x) => (x < 0 ? '#8a6a2a' : '#2e7d4f');
      return `<tr class="klickbar" data-a="nachweis" data-id="${p.id}"><td>${personZelle(c, p, p.funktion)}</td><td class="r num">${Zahl.std(n.soll)}</td><td class="r num">${Zahl.std(n.ist)}</td><td class="r num">${n.urlaub || ''}</td><td class="r num">${n.krank || ''}</td>
        <td class="r num" style="color:${farbe(n.diff)}">${n.diff >= 0 ? '+' : ''}${Zahl.std(n.diff)}</td><td class="r num" style="color:${farbe(konto)}"><b>${konto >= 0 ? '+' : ''}${Zahl.std(konto)}</b></td><td class="r"><button class="k klein" data-a="nachweis" data-id="${p.id}">${Icon('drucken')} Nachweis</button></td></tr>`;
    }).join('');
    return seitenkopf('Stunden', `${esc(Datum.monatName(ym))} · Soll ohne Feiertage, Urlaub und Krankheit werden gutgeschrieben`,
      `${ansichtWahl()}<span class="wochenwahl"><button class="k klein" data-a="monat" data-id="-1" aria-label="Voriger Monat">${Icon('zurueck')}</button><b>${esc(Datum.monatName(ym))}</b><button class="k klein" data-a="monat" data-id="1" aria-label="Nächster Monat">${Icon('pfeil')}</button></span>`)
      + `<div class="karte"><div class="tabelle-huelle"><table class="t"><thead><tr><th>Mitarbeiter</th><th class="r">Soll</th><th class="r">Ist</th><th class="r">Urlaub</th><th class="r">Krank</th><th class="r">± Monat</th><th class="r">Überstundenkonto</th><th></th></tr></thead><tbody>${zeilen || `<tr><td colspan="8">${leer('Keine Mitarbeiter mit Wochenstunden.')}</td></tr>`}</tbody></table></div>
        <div class="legende"><span>Urlaub und Krank in Arbeitstagen</span><span>Überstundenkonto: alle Monate dieses Jahres bis einschließlich ${esc(Datum.monatName(ym).split(' ')[0])}</span></div></div>`;
  }

  /* ---------- Wochenplan ---------- */
  const PLAN_TAGE = (c) => (c.R.p('wochenplan').tage === 'Mo bis Sa' ? 6 : 5);
  SEITEN.plan = (c) => {
    const mo = zustand.planWoche; const n = PLAN_TAGE(c);
    const tage = Array.from({ length: n }, (_, i) => Datum.plus(mo, i));
    const w = c.planWoche(mo);
    const kurz = (b) => b.name.replace(/^(Neubau|Dachsanierung|Carport|Gaube)\s+/, '');
    const zeilen = c.arbeiter().map((p) => `<tr><td>${personZelle(c, p, p.funktion)}</td>${tage.map((d, t) => {
      const abw = c.abwesend(p.id, d);
      if (abw) return `<td><span class="chip ${abw.typ === 'krank' ? 'bad' : 'warn'}">${abw.typ === 'krank' ? 'Krank' : esc(abw.art || 'Urlaub')}</span></td>`;
      if (Datum.feiertag(d)) return `<td><span class="chip">${esc(Datum.feiertag(d))}</span></td>`;
      const wert = (w && w.zellen && w.zellen[p.id] && w.zellen[p.id][t]) || '';
      return `<td><select class="plan-wahl ${wert ? 'gesetzt' : ''}" data-a="plan-zelle" data-pid="${p.id}" data-tag="${t}" aria-label="${esc(p.name)}, ${Datum.WT[t]}">
        <option value="">–</option>${c.baustellenOffen().map((b) => `<option value="${b.id}" ${wert === b.id ? 'selected' : ''}>${esc(kurz(b))}</option>`).join('')}<option value="S" ${wert === 'S' ? 'selected' : ''}>Berufsschule</option></select></td>`;
    }).join('')}</tr>`).join('');
    const proBaustelle = c.baustellenOffen().map((b) => {
      const zellen = tage.map((d, t) => { const leute = c.arbeiter().filter((p) => !c.abwesend(p.id, d) && w && w.zellen && w.zellen[p.id] && w.zellen[p.id][t] === b.id); return `<td>${leute.map((p) => esc(p.name.split(' ')[0])).join(', ') || '<span style="color:#a3aaa5">–</span>'}</td>`; });
      return `<tr><td><b>${esc(b.name)}</b><small style="display:block;color:#7a827c">${esc(b.ort)}</small></td>${zellen.join('')}</tr>`;
    }).join('');
    const kopf = tage.map((d) => `<th${d === c.heute ? ' style="color:var(--firma)"' : ''}>${Datum.WT[Datum.wochentag(d)]} ${Datum.kurz(d)}</th>`).join('');
    return seitenkopf('Wochenplan', `KW ${Datum.kw(mo)} · Die Mitarbeiter sehen ihren Plan in der App, sobald er hier eingetragen ist`,
      `<span class="wochenwahl"><button class="k klein" data-a="planwoche" data-id="-7" aria-label="Vorige Woche">${Icon('zurueck')}</button><b>${Datum.kurz(mo)} – ${Datum.kurz(tage[n - 1])}${tage[n - 1].slice(0, 4)}</b><button class="k klein" data-a="planwoche" data-id="7" aria-label="Nächste Woche">${Icon('pfeil')}</button></span>
       <button class="k" data-a="plan-vorwoche">Vorwoche übernehmen</button><button class="k" data-a="plan-ics">${Icon('kalender')} Kalenderdatei</button><button class="k" data-a="drucken" data-id="plan">${Icon('drucken')} Drucken</button>`)
      + `<div class="karte" id="druck-plan"><div class="kopf"><h3>Wer ist wo</h3></div><div class="tabelle-huelle"><table class="t plan"><thead><tr><th>Mitarbeiter</th>${kopf}</tr></thead><tbody>${zeilen || `<tr><td colspan="7">${leer('Noch keine Mitarbeiter.')}</td></tr>`}</tbody></table></div></div>
      <div class="karte"><div class="kopf"><h3>Nach Baustelle</h3></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Baustelle</th>${kopf}</tr></thead><tbody>${proBaustelle || `<tr><td colspan="7">${leer('Keine laufenden Baustellen.')}</td></tr>`}</tbody></table></div></div>`;
  };

  SEITEN.urlaub = (c) => {
    const jahr = Number(c.heute.slice(0, 4));
    const antraege = c.typ('urlaub').filter((u) => u.status === 'beantragt').sort((a, b) => a.von.localeCompare(b.von));
    const darf = c.R.darfFreigeben(c.ich && c.ich.rolle) || !c.R.freigabe('urlaub');
    const ym = zustand.monat; const [j, m] = ym.split('-').map(Number);
    const tageImMonat = new Date(j, m, 0).getDate();
    const tage = Array.from({ length: tageImMonat }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
    const kal = `<div class="kalender-urlaub" style="grid-template-columns: 170px repeat(${tageImMonat}, minmax(22px, 1fr))">
      <div class="name kopfz">Mitarbeiter</div>${tage.map((d) => `<div class="zk kopfz ${Datum.istArbeitstag(d) ? '' : 'we'}" title="${esc(Datum.feiertag(d) || '')}">${Number(d.slice(8))}</div>`).join('')}
      ${c.personen.map((p) => `<div class="name">${esc(p.name)}</div>${tage.map((d) => {
        const a = c.abwesend(p.id, d); let k = Datum.istArbeitstag(d) ? '' : 'we';
        if (a && Datum.istArbeitstag(d)) k = a.typ === 'krank' ? 'k' : a.status === 'beantragt' ? 'ub' : 'u';
        return `<div class="zk ${k} ${d === c.heute ? 'heute' : ''}" title="${a ? esc((a.typ === 'krank' ? 'Krank' : a.art || 'Urlaub') + ' ' + (STATUS_TEXT[a.status] || [''])[0]) : ''}"></div>`;
      }).join('')}`).join('')}</div>`;
    const konten = c.personen.map((p) => {
      const k = c.urlaubKonto(p.id, jahr); const anteil = Math.min(100, (k.genommen / k.anspruch) * 100);
      return `<tr><td>${personZelle(c, p)}</td><td class="r num">${k.anspruch}</td><td class="r num">${k.genommen}</td><td class="r num">${k.beantragt || ''}</td><td class="r num"><b>${k.rest}</b></td><td style="width:140px"><div class="balken-urlaub"><i style="width:${anteil}%"></i></div></td></tr>`;
    }).join('');
    const krank = c.typ('krank').sort((a, b) => b.von.localeCompare(a.von)).slice(0, 6);
    return seitenkopf('Urlaub & Krank', `Urlaubsjahr ${jahr} · ${c.R.p('urlaub').tage} Tage Anspruch${Number(c.R.p('urlaub').vorlauf) ? ` · Anträge mindestens ${c.R.p('urlaub').vorlauf} Tage vorher` : ''}`,
      `<button class="k" data-a="abwesenheit-neu">${Icon('plus')} Abwesenheit eintragen</button>`)
      + `<div class="karte"><div class="kopf"><h3>Offene Anträge</h3><span class="chip ${antraege.length ? 'warn' : ''}">${antraege.length}</span></div>
        ${antraege.map((u) => { const p = c.person(u.pid); const k = c.urlaubKonto(u.pid, jahr); const n = Datum.werktageZwischen(u.von, u.bis);
          const ueberschneidung = c.typ('urlaub').filter((x) => x.id !== u.id && x.status !== 'abgelehnt' && x.von <= u.bis && x.bis >= u.von).map((x) => c.person(x.pid).name.split(' ')[0]);
          return `<div class="liste-zeile">${personZelle(c, p)}<div class="text"><b>${esc(u.art || 'Urlaub')}: ${Datum.mittel(u.von)} bis ${Datum.mittel(u.bis)}</b><small>${Zahl.tage(n, 'Arbeitstag')} · danach noch ${k.rest - (u.art === 'Überstundenabbau' ? 0 : n)} Tage Rest${ueberschneidung.length ? ' · gleichzeitig weg: ' + esc(ueberschneidung.join(', ')) : ''}${u.notiz ? ' · „' + esc(u.notiz) + '“' : ''}</small></div>
          <div class="aktionen">${darf ? `<button class="k klein ok" data-a="urlaub-ja" data-id="${u.id}">${Icon('haken')} Genehmigen</button><button class="k klein nein" data-a="urlaub-nein" data-id="${u.id}">Ablehnen</button>` : '<span class="chip warn">wartet auf Chef</span>'}</div></div>`; }).join('') || leer('Keine offenen Anträge.')}</div>
      <div class="karte"><div class="kopf"><h3>Kalender</h3><div class="rechts"><button class="k klein" data-a="monat" data-id="-1">${Icon('zurueck')}</button><b style="min-width:130px;text-align:center">${esc(Datum.monatName(ym))}</b><button class="k klein" data-a="monat" data-id="1">${Icon('pfeil')}</button></div></div>
        <div class="tabelle-huelle">${kal}</div>
        <div class="legende"><span><i style="background:color-mix(in srgb, var(--firma) 70%, white)"></i>Urlaub genehmigt</span><span><i style="background:#f3dfb5"></i>beantragt</span><span><i style="background:#e9d6d2"></i>krank</span></div></div>
      <div class="zwei">
        <div class="karte"><div class="kopf"><h3>Urlaubskonto ${jahr}</h3></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Mitarbeiter</th><th class="r">Anspruch</th><th class="r">Genommen</th><th class="r">Beantragt</th><th class="r">Rest</th><th></th></tr></thead><tbody>${konten}</tbody></table></div></div>
        <div class="karte"><div class="kopf"><h3>Krankmeldungen</h3></div>${krank.map((k) => `<div class="liste-zeile">${personZelle(c, c.person(k.pid))}<div class="text"><b>${Datum.kurz(k.von)}${k.bis !== k.von ? ' – ' + Datum.kurz(k.bis) : ''}</b><small>${Zahl.tage(Datum.werktageZwischen(k.von, k.bis))}${k.notiz ? ' · ' + esc(k.notiz) : ''}</small></div><span class="chip ${k.au ? 'ok' : 'warn'}">${k.au ? 'AU liegt vor' : 'AU fehlt'}</span>${!k.au ? `<button class="k klein" data-a="au" data-id="${k.id}">AU erhalten</button>` : ''}</div>`).join('') || leer('Keine Krankmeldungen.')}</div>
      </div>`;
  };

  SEITEN.belege = (c) => {
    const f = zustand.filter.belege || 'alle';
    let liste = c.typ('beleg').sort((a, b) => b.datum.localeCompare(a.datum) || b.erstellt - a.erstellt);
    if (f === 'pruefen') liste = liste.filter((b) => b.status === 'offen' || b.status === 'neu');
    if (f === 'erledigt') liste = liste.filter((b) => b.status === 'geprueft' || b.status === 'freigegeben');
    const summe = liste.reduce((s, b) => s + Number(b.betrag || 0), 0);
    return seitenkopf('Belege', `Fotos von Quittungen aus der App${c.R.freigabe('belege') ? ` · Belege ab ${Zahl.eur(c.R.p('belege').grenze)} brauchen eine Freigabe` : ''}`,
      `<span class="segment">${[['alle', 'Alle'], ['pruefen', 'Zu prüfen'], ['erledigt', 'Erledigt']].map(([k, t]) => `<button class="${f === k ? 'an' : ''}" data-a="filter" data-feld="belege" data-id="${k}">${t}</button>`).join('')}</span>
       <button class="k" data-a="hochladen" data-id="beleg">${Icon('upload')} Beleg hochladen</button>`)
      + `<div class="karte"><div class="kopf"><h3>${liste.length} Belege</h3><div class="rechts"><b class="num">${Zahl.eur(summe)}</b></div></div>
        ${liste.length ? `<div class="raster-belege">${liste.map((b) => `<button class="beleg-karte" data-a="beleg" data-id="${b.id}"><img data-eintrag="${b.id}" alt=""><div class="angaben"><b class="num">${Zahl.eur(b.betrag)}</b><small>${esc(b.kategorie)} · ${esc(b.haendler || b.notiz || '')}</small><small>${Datum.kurz(b.datum)} · ${esc(c.person(b.pid).name)}</small><div style="margin-top:6px">${chip(b.status)}</div></div></button>`).join('')}</div>` : leer('Keine Belege in dieser Auswahl.')}</div>`;
  };

  SEITEN.lieferscheine = (c) => {
    const bs = zustand.filter.lieferscheine || '';
    const liste = c.typ('lieferschein').filter((l) => !bs || l.bs === bs).sort((a, b) => b.datum.localeCompare(a.datum));
    return seitenkopf('Lieferscheine', 'Abfotografiert auf der Baustelle, sortiert nach Auftrag',
      `<select class="k" data-a="filter-bs" style="padding:7px 10px"><option value="">Alle Baustellen</option>${bsOptionen(c, bs, false)}</select>
       <button class="k" data-a="hochladen" data-id="lieferschein">${Icon('upload')} Lieferschein hochladen</button>`)
      + `<div class="karte"><div class="tabelle-huelle"><table class="t"><thead><tr><th></th><th>Datum</th><th>Lieferant</th><th>Nummer</th><th>Baustelle</th><th>Angenommen von</th><th>Status</th></tr></thead><tbody>
        ${liste.map((l) => `<tr class="klickbar" data-a="lieferschein" data-id="${l.id}"><td style="width:60px"><img class="daumen" data-eintrag="${l.id}" alt=""></td><td class="num">${Datum.kurz(l.datum)}</td><td><b>${esc(l.lieferant)}</b>${l.positionen ? `<small style="display:block;color:#7a827c">${esc(l.positionen.slice(0, 2).join(', '))}${l.positionen.length > 2 ? ' …' : ''}</small>` : ''}</td><td class="mono">${esc(l.nummer || '–')}</td><td>${esc(c.bsName(l.bs))}</td><td>${esc(c.person(l.pid).name)}</td><td>${chip(l.status)}</td></tr>`).join('') || `<tr><td colspan="7">${leer('Keine Lieferscheine.')}</td></tr>`}
      </tbody></table></div></div>`;
  };

  SEITEN.material = (c) => {
    const offen = c.typ('material').filter((m) => m.status !== 'erledigt').sort((a, b) => b.datum.localeCompare(a.datum));
    const erledigt = c.typ('material').filter((m) => m.status === 'erledigt').sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 10);
    const haendler = c.R.p('material').haendler;
    const liste = Sprache.lieferantenListe(c);
    const gruppen = {}; offen.forEach((m) => { const l = m.lieferant || haendler; (gruppen[l] = gruppen[l] || []).push(m); });
    const zeilenText = (ms) => ms.flatMap((m) => (m.positionen && m.positionen.length ? m.positionen.map((p) => `- ${String(p.menge).replace('.', ',')} ${p.einheit} ${p.text}`) : [`- ${m.text}`]).map((z) => `${z}${m.bs ? ` (Baustelle ${c.bsName(m.bs)}, ${(c.baustelle(m.bs) || {}).adresse || ''})` : ''}`)).join('\n');
    const mail = (l, ms) => { const h = liste.find((x) => x.name === l) || {}; return `mailto:${encodeURIComponent(h.email || '')}?subject=${encodeURIComponent('Bestellung ' + (c.cfg.name || ''))}&body=${encodeURIComponent(`Guten Tag,\n\nwir bestellen:\n${zeilenText(ms)}\n\nBitte kurz bestätigen mit Liefertermin.\n\nViele Grüße\n${c.ich ? c.ich.name : ''}\n${c.cfg.name}${c.cfg.telefon ? '\nTel. ' + c.cfg.telefon : ''}`)}`; };
    const gruppeHtml = ([l, ms]) => { const h = liste.find((x) => x.name === l) || {};
      return `<div class="karte bestell-gruppe"><div class="kopf"><h3>${esc(l)}</h3><span class="chip warn">${ms.length}</span><div class="rechts">${h.telefon ? `<a class="k klein" href="tel:${esc(h.telefon.replace(/\s+/g, ''))}">${Icon('telefon')} ${esc(h.telefon)}</a>` : ''}<a class="k klein" href="${mail(l, ms)}">${Icon('angebot')} Als E-Mail</a><button class="k klein" data-a="material-alle" data-id="${esc(l)}">Alle bestellt</button></div></div>${ms.map(zeile).join('')}</div>`; };
    const zeile = (m) => `<div class="liste-zeile"><div class="text"><b>${m.positionen && m.positionen.length ? m.positionen.map((p) => `${String(p.menge).replace('.', ',')} ${esc(p.einheit)} ${esc(p.text)}`).join('<br>') : esc(m.text)}</b><small>${m.quelle === 'sprache' ? `${Icon('mikro')} eingesprochen · ` : m.quelle === 'rechner' ? 'aus dem Rechner · ' : ''}${esc(c.bsName(m.bs))} · ${esc(c.person(m.pid).name)} · ${Datum.kurz(m.datum)}</small></div>${chip(m.status)}
      <div class="aktionen">${m.status === 'offen' ? `<button class="k klein" data-a="material" data-id="${m.id}" data-wert="bestellt">Bestellt</button>` : ''}${m.status !== 'erledigt' ? `<button class="k klein ok" data-a="material" data-id="${m.id}" data-wert="erledigt">${Icon('haken')} Erledigt</button>` : ''}</div></div>`;
    return seitenkopf(esc(c.R.name('material')), 'Was auf den Baustellen fehlt, sortiert nach Händler. Anrufen oder als E-Mail schicken.', c.R.an('material', 'sprache') ? `<button class="k haupt" data-sprache>${Icon('mikro')} Einsprechen</button>` : '')
      + (offen.length ? Object.entries(gruppen).map(gruppeHtml).join('') : `<div class="karte"><div class="kopf"><h3>Offen</h3></div>${leer('Nichts offen.')}</div>`) + `
        <div class="karte"><div class="kopf"><h3>Zuletzt erledigt</h3></div>${erledigt.map(zeile).join('') || leer('Noch nichts.')}</div>`;
  };

  SEITEN.tagelohn = (c) => {
    const jahr = c.heute.slice(0, 4);
    const einsaetze = c.typ('tagelohn').sort((a, b) => b.datum.localeCompare(a.datum));
    const grenze = Number(c.R.p('tagelohn').grenzeTage);
    const tl = (c.cfg.tageloehner || []).map((t) => {
      const eig = einsaetze.filter((e) => e.tid === t.id && e.datum.startsWith(jahr));
      const tage = new Set(eig.map((e) => e.datum)).size;
      const offen = eig.filter((e) => !e.bezahlt).reduce((s, e) => s + e.stunden * e.satz, 0);
      return `<tr class="klickbar" data-a="tageloehner" data-id="${t.id}"><td>${personZelle(c, t, t.notiz)}</td><td class="r num">${Zahl.eur(t.satz)}</td><td class="r num">${tage}${tage >= grenze ? ' <span class="chip warn">Grenze</span>' : ''}</td><td class="r num">${Zahl.eur(eig.reduce((s, e) => s + e.stunden * e.satz, 0))}</td><td class="r num">${offen ? `<b>${Zahl.eur(offen)}</b>` : '–'}</td></tr>`;
    }).join('');
    return seitenkopf('Tagelöhner', `Aushilfen mit Stundennachweis · Standardsatz ${Zahl.eur(c.R.p('tagelohn').satz)} · Hinweis ab ${grenze} Einsatztagen im Jahr`,
      `<button class="k" data-a="tageloehner-neu">${Icon('plus')} Aushilfe anlegen</button><button class="k haupt" data-a="einsatz-neu" ${(c.cfg.tageloehner || []).length ? '' : 'disabled'}>${Icon('plus')} Einsatz erfassen</button>`)
      + `<div class="karte"><div class="kopf"><h3>Aushilfen</h3></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Name</th><th class="r">Satz</th><th class="r">Tage ${jahr}</th><th class="r">Summe ${jahr}</th><th class="r">Noch zu zahlen</th></tr></thead><tbody>${tl || `<tr><td colspan="5">${leer('Noch keine Aushilfen angelegt.')}</td></tr>`}</tbody></table></div></div>
        <div class="karte"><div class="kopf"><h3>Einsätze</h3></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Datum</th><th>Aushilfe</th><th>Baustelle</th><th>Tätigkeit</th><th class="r">Std.</th><th class="r">Betrag</th><th>Status</th><th>Bezahlt</th><th></th></tr></thead><tbody>
        ${einsaetze.map((e) => `<tr><td class="num">${Datum.kurz(e.datum)}</td><td>${esc(c.tageloehner(e.tid).name)}</td><td>${esc(c.bsName(e.bs))}</td><td>${esc(e.taetigkeit || '')}</td><td class="r num">${Zahl.std(e.stunden)}</td><td class="r num">${Zahl.eur(e.stunden * e.satz)}</td>
          <td>${e.status === 'offen' ? `<button class="k klein ok" data-a="einsatz-frei" data-id="${e.id}">Freigeben</button>` : chip(e.status)}</td>
          <td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-a="bezahlt" data-id="${e.id}" ${e.bezahlt ? 'checked' : ''}> ${e.bezahlt ? 'bar bezahlt' : 'offen'}</label></td>
          <td><button class="k klein" data-a="quittung" data-id="${e.id}">Quittung</button></td></tr>`).join('') || `<tr><td colspan="9">${leer('Noch keine Einsätze.')}</td></tr>`}
        </tbody></table></div></div>`;
  };

  /* Einträge eines Monats, die ins Steuerbüro-Paket gehören */
  function paketInhalt(c, ym) {
    const imMonat = (e) => (e.datum || '').startsWith(ym);
    const R = c.R;
    const pruefStd = R.verb('stunden', 'freigabe') && R.verb('freigabe', 'export') && !R.verb('stunden', 'export');
    const std = R.imExport('stunden') ? c.typ('stunden').filter(imMonat).filter((e) => e.status !== 'laeuft') : [];
    const stdOk = pruefStd ? std.filter((e) => e.status === 'freigegeben') : std;
    const bel = R.imExport('belege') ? c.typ('beleg').filter(imMonat) : [];
    const belOk = bel.filter((b) => b.status !== 'offen' && b.status !== 'abgelehnt');
    const ls = R.imExport('lieferscheine') ? c.typ('lieferschein').filter(imMonat) : [];
    const tl = R.imExport('tagelohn') ? c.typ('tagelohn').filter(imMonat) : [];
    const tlOk = tl.filter((e) => e.status !== 'offen');
    return { std, stdOk, bel, belOk, ls, tl, tlOk };
  }

  SEITEN.steuer = (c) => {
    const ym = zustand.monat; const R = c.R;
    const p = R.p('export');
    const inh = paketInhalt(c, ym);
    const punkt = (ok, titel, unter) => `<li><span class="marke-p ${ok ? 'ok' : 'warn'}">${Icon(ok ? 'haken' : 'glocke')}</span><div><b>${titel}</b><small>${unter}</small></div></li>`;
    const liste = [];
    if (R.imExport('stunden')) {
      const fehlt = inh.std.length - inh.stdOk.length;
      const pers = new Set(inh.stdOk.map((e) => e.pid)).size;
      liste.push(punkt(!fehlt, `Stunden: ${inh.stdOk.length} Einträge, ${pers} Mitarbeiter, ${Zahl.std(inh.stdOk.reduce((s, e) => s + stundenVon(e), 0))} Std.`, fehlt ? `${fehlt} Einträge sind noch nicht freigegeben und fehlen im Paket.` : `Format: ${esc(p.format)}`));
    }
    if (R.imExport('belege')) {
      const fehlt = inh.bel.length - inh.belOk.length;
      liste.push(punkt(!fehlt, `Belege: ${inh.belOk.length} Stück, ${Zahl.eur(inh.belOk.reduce((s, b) => s + Number(b.betrag || 0), 0))}`, fehlt ? `${fehlt} ${fehlt === 1 ? 'Beleg wartet' : 'Belege warten'} noch auf Freigabe.` : 'mit Fotos, benannt nach Datum und Kategorie'));
    }
    if (R.imExport('lieferscheine')) liste.push(punkt(true, `Lieferscheine: ${inh.ls.length} Stück`, 'mit Fotos, sortiert nach Baustelle'));
    if (R.imExport('tagelohn')) {
      const fehlt = inh.tl.length - inh.tlOk.length;
      liste.push(punkt(!fehlt, `Tagelohn: ${inh.tlOk.length} Einsätze, ${Zahl.eur(inh.tlOk.reduce((s, e) => s + e.stunden * e.satz, 0))}`, fehlt ? `${fehlt} ${fehlt === 1 ? 'Einsatz' : 'Einsätze'} noch nicht freigegeben.` : 'mit Name, Datum, Stunden und Satz'));
    }
    if (R.imExport('rechnungen')) {
      const rn = Uebergabe.gestellte(c, (r) => (r.datum || '').startsWith(ym));
      liste.push(punkt(true, `Ausgangsrechnungen: ${rn.length} Stück`, 'Liste als CSV und je Rechnung die E-Rechnung (XRechnung)'));
    }
    const doks = c.typ('dokument').sort((a, b) => b.erstellt - a.erstellt);
    const exportKarte = R.hat('export') ? `<div class="karte"><div class="kopf"><h3>Monatspaket für ${esc(p.empfaenger)}</h3><div class="rechts"><button class="k klein" data-a="monat" data-id="-1">${Icon('zurueck')}</button><b style="min-width:130px;text-align:center">${esc(Datum.monatName(ym))}</b><button class="k klein" data-a="monat" data-id="1">${Icon('pfeil')}</button></div></div>
        <ul class="pruefliste">${liste.join('') || `<li>${leer('Im Baukasten ist noch nichts an das Steuerbüro-Paket angeschlossen.')}</li>`}</ul>
        <div class="legende" style="justify-content:space-between;align-items:center"><span>Abgabe bis zum ${p.stichtag}. des Folgemonats</span><button class="k haupt" data-a="paket" ${liste.length ? '' : 'disabled'}>${Icon('download')} Paket herunterladen (ZIP)</button></div></div>` : '';
    const dokKarte = R.hat('dokumente') ? `<div class="karte"><div class="kopf"><h3>Vom Steuerbüro erhalten</h3><div class="rechts"><span class="chip">Lohnabrechnungen erscheinen in der App des Mitarbeiters</span></div></div>
        <div class="koerper"><div class="ablage" id="ablage-dok">${Icon('upload')}<div style="margin-top:6px"><b>PDF oder Foto hier ablegen</b> oder <button class="k klein" data-a="dok-hochladen">Datei auswählen</button></div><small style="color:#7a827c">Danach Mitarbeiter zuordnen. Jeder sieht nur seine eigenen Dokumente.</small></div></div>
        <div class="tabelle-huelle"><table class="t"><thead><tr><th>Dokument</th><th>Für</th><th>Hochgeladen</th><th>In der App</th><th></th></tr></thead><tbody>
        ${doks.map((d) => `<tr><td>${Icon('dokument')} ${esc(d.titel)}</td><td>${d.fuer === 'alle' ? 'Alle' : esc(c.person(d.fuer).name)}</td><td class="num">${Datum.kurz(d.datum || Datum.iso(d.erstellt))}</td><td>${d.gelesen ? '<span class="chip ok">Gelesen</span>' : '<span class="chip">Ungelesen</span>'}</td><td><button class="k klein" data-a="dok-ansehen" data-id="${d.id}">Ansehen</button></td></tr>`).join('') || `<tr><td colspan="5">${leer('Noch keine Dokumente.')}</td></tr>`}</tbody></table></div></div>` : '';
    return seitenkopf('Steuerbüro', 'Unterlagen sammeln und abgeben, Lohnabrechnungen verteilen') + exportKarte + dokKarte;
  };

  SEITEN.baustellen = (c) => {
    const liste = (c.cfg.baustellen || []);
    return seitenkopf('Baustellen', 'Aufträge, auf die Stunden, Belege und Lieferscheine gebucht werden', `<button class="k haupt" data-a="baustelle-neu">${Icon('plus')} Baustelle anlegen</button>`)
      + `<div class="karte"><div class="tabelle-huelle"><table class="t"><thead><tr><th>Baustelle</th><th>Ort</th><th>Arbeiten</th><th class="r">Stunden</th><th class="r">Belege</th><th class="r">Lieferscheine</th><th>Status</th></tr></thead><tbody>
      ${liste.map((b) => { const std = c.typ('stunden').filter((s) => s.bs === b.id).reduce((s, e) => s + stundenVon(e), 0) + c.typ('tagelohn').filter((s) => s.bs === b.id).reduce((s, e) => s + Number(e.stunden), 0);
        const regie = c.typ('regie').filter((r) => r.bs === b.id && r.status !== 'abgerechnet').length;
        return `<tr class="klickbar" data-a="akte" data-id="${b.id}"><td><b>${esc(b.name)}</b>${b.kunde ? `<small style="display:block;color:#7a827c">${esc(b.kunde)}</small>` : ''}${regie ? ` <span class="chip warn">${regie} Regie</span>` : ''}</td><td>${esc(b.ort)}</td><td>${esc(b.arbeit || '')}</td><td class="r num">${Zahl.std(std)}</td><td class="r num">${Zahl.eur(c.typ('beleg').filter((x) => x.bs === b.id).reduce((s, x) => s + Number(x.betrag || 0), 0))}</td><td class="r num">${c.typ('lieferschein').filter((x) => x.bs === b.id).length}</td><td>${b.status === 'fertig' ? '<span class="chip">Fertig</span>' : b.status === 'geplant' ? '<span class="chip info">Geplant</span>' : '<span class="chip ok">Laufend</span>'}</td></tr>`; }).join('') || `<tr><td colspan="7">${leer('Noch keine Baustellen.')}</td></tr>`}
      </tbody></table></div></div>`;
  };

  /* ---------- Baustellenakte ---------- */
  const WETTER = { sonnig: 'Sonnig', 'bewölkt': 'Bewölkt', Regen: 'Regen', Wind: 'Sturm/Wind', Frost: 'Frost', Schnee: 'Schnee' };
  SEITEN.akte = (c) => {
    const b = c.baustelle(zustand.akte) || (zustand.akte ? null : c.baustellenOffen()[0]);
    if (!b) return seitenkopf('Baustelle', '') + leer('Diese Baustelle gibt es nicht mehr.');
    const stunden = c.typ('stunden').filter((s) => s.bs === b.id && s.bis);
    const tl = c.typ('tagelohn').filter((s) => s.bs === b.id);
    const std = stunden.reduce((s, e) => s + stundenVon(e), 0) + tl.reduce((s, e) => s + Number(e.stunden), 0);
    const belege = c.typ('beleg').filter((x) => x.bs === b.id);
    const ls = c.typ('lieferschein').filter((x) => x.bs === b.id).sort((x, y) => y.datum.localeCompare(x.datum));
    const regie = c.typ('regie').filter((x) => x.bs === b.id).sort((x, y) => y.datum.localeCompare(x.datum));
    const tagebuch = c.typ('tagebuch').filter((x) => x.bs === b.id).sort((x, y) => y.datum.localeCompare(x.datum));
    const proPerson = {}; stunden.forEach((s) => { proPerson[s.pid] = (proPerson[s.pid] || 0) + stundenVon(s); });
    const maps = b.adresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.adresse)}` : '';
    const regieOffen = regie.filter((r) => r.status !== 'abgerechnet');
    return seitenkopf(esc(b.name), `${esc(b.arbeit || '')}${b.status === 'fertig' ? ' · abgeschlossen' : ''}`,
      `<button class="k" data-a="gehe" data-id="baustellen">${Icon('zurueck')} Alle Baustellen</button><button class="k" data-a="baustelle" data-id="${b.id}">${Icon('stift')} Bearbeiten</button>${c.R.hat('bautagebuch') ? `<button class="k haupt" data-a="tagebuch-neu" data-id="${b.id}">${Icon('plus')} Tagebuch-Eintrag</button>` : ''}`)
      + `<div class="kacheln">
        <div class="kachel"><div class="titel">Stunden</div><div class="wert">${Zahl.std(std)}</div><div class="fuss">${tl.length ? 'inkl. Aushilfen' : 'gestempelt und eingetragen'}</div></div>
        <div class="kachel"><div class="titel">Belege</div><div class="wert">${Zahl.eur(belege.reduce((s, x) => s + Number(x.betrag || 0), 0))}</div><div class="fuss">${belege.length} Belege</div></div>
        <div class="kachel"><div class="titel">Lieferscheine</div><div class="wert">${ls.length}</div><div class="fuss">${ls.length ? 'zuletzt ' + Datum.kurz(ls[0].datum) : 'noch keine'}</div></div>
        ${c.R.hat('regie') ? `<div class="kachel ${regieOffen.length ? 'achtung' : ''}"><div class="titel">Regie offen</div><div class="wert">${Zahl.eur(regieOffen.reduce((s, r) => s + regieBetrag(c, r), 0))}</div><div class="fuss">${regieOffen.length} Zettel noch nicht abgerechnet</div></div>` : ''}
      </div>
      <div class="zwei">
        <div class="karte"><div class="kopf"><h3>Kunde und Ort</h3></div><dl class="daten koerper">
          <dt>Kunde</dt><dd>${esc(b.kunde || '–')}</dd>
          <dt>Telefon</dt><dd>${b.telefon ? `<a href="tel:${esc(b.telefon.replace(/\s+/g, ''))}">${esc(b.telefon)}</a>` : '–'}</dd>
          <dt>Adresse</dt><dd>${b.adresse ? `${esc(b.adresse)} · <a href="${maps}" target="_blank" rel="noopener">Route</a>` : esc(b.ort || '–')}</dd>
          <dt>Hinweise</dt><dd>${esc(b.notiz || '–')}</dd></dl></div>
        <div class="karte"><div class="kopf"><h3>Stunden nach Mitarbeiter</h3></div>${Object.keys(proPerson).length ? Object.entries(proPerson).sort((x, y) => y[1] - x[1]).map(([pid, h]) => `<div class="liste-zeile">${personZelle(c, c.person(pid))}<span class="num" style="margin-left:auto"><b>${Zahl.std(h)}</b> Std.</span></div>`).join('') : leer('Noch keine Stunden auf dieser Baustelle.')}
          ${tl.length ? `<div class="liste-zeile"><div class="text"><b>Aushilfen</b></div><span class="num" style="margin-left:auto"><b>${Zahl.std(tl.reduce((s, e) => s + Number(e.stunden), 0))}</b> Std.</span></div>` : ''}</div>
      </div>
      ${c.R.hat('regie') ? `<div class="karte"><div class="kopf"><h3>Regiezettel (Zusatzarbeiten)</h3><span class="legende" style="padding:0;border:0">Stundensatz ${Zahl.eur(c.R.p('regie').satz)}</span></div>
        ${regie.length ? `<div class="tabelle-huelle"><table class="t"><thead><tr><th>Datum</th><th>Arbeit</th><th class="r">Stunden</th><th class="r">Betrag</th><th>Kunde</th><th>Status</th></tr></thead><tbody>${regie.map((r) => `<tr class="klickbar" data-a="regie" data-id="${r.id}"><td>${Datum.kurz(r.datum)}</td><td>${esc(r.text)}</td><td class="r num">${r.leute > 1 ? `${r.leute} × ${Zahl.std(r.stunden)}` : Zahl.std(r.stunden)}</td><td class="r num">${Zahl.eur(regieBetrag(c, r))}</td><td>${esc(r.kunde || '–')}</td><td>${r.status === 'offen' ? '<span class="chip warn">Ohne Unterschrift</span>' : chip(r.status)}</td></tr>`).join('')}</tbody></table></div>` : leer('Noch keine Zusatzarbeiten. Die Gesellen schreiben sie in der App auf, der Kunde unterschreibt auf dem Handy.')}</div>` : ''}
      ${c.R.hat('bautagebuch') ? `<div class="karte"><div class="kopf"><h3>Bautagebuch</h3>${tagebuch.length ? `<button class="k klein" data-a="drucken" data-id="tagebuch">${Icon('drucken')} Drucken</button>` : ''}</div>
        <div id="druck-tagebuch">${tagebuch.length ? tagebuch.map((t) => `<div class="tagebuch-eintrag"><div class="wann"><b>${esc(Datum.mittel(t.datum))}</b><small>${esc(WETTER[t.wetter] || t.wetter || '')}</small><small>${esc(c.person(t.pid).name)}</small></div>
          <div class="was"><p>${esc(t.text)}</p>${Zusatz.anzeige(c, 'bautagebuch', t.extra) ? `<dl class="daten" style="margin-bottom:10px">${Zusatz.anzeige(c, 'bautagebuch', t.extra)}</dl>` : ''}${(t.fotos || []).length ? `<div class="fotos">${t.fotos.map((f) => `<button class="foto" data-a="foto" data-id="${esc(f)}" aria-label="Foto vergrößern"><img data-datei="${esc(f)}" alt="Foto vom ${esc(Datum.kurz(t.datum))}"></button>`).join('')}</div>` : ''}</div></div>`).join('') : leer('Noch keine Einträge. Fotos und Notizen kommen aus der App oder werden hier ergänzt.')}</div></div>` : ''}
      <div class="karte"><div class="kopf"><h3>Lieferscheine und Belege</h3></div>
        ${[...ls.map((x) => ({ ...x, art: 'Lieferschein' })), ...belege.map((x) => ({ ...x, art: 'Beleg' }))].sort((x, y) => y.datum.localeCompare(x.datum)).map((x) => `<button class="liste-zeile klickbar" data-a="${x.typ}" data-id="${x.id}" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;border-top:0">${Icon(x.typ === 'beleg' ? 'beleg' : 'liefer')}<div class="text"><b>${x.typ === 'beleg' ? `${Zahl.eur(x.betrag)} · ${esc(x.haendler || x.kategorie)}` : `${esc(x.lieferant)} ${esc(x.nummer || '')}`}</b><small>${Datum.kurz(x.datum)} · ${esc(c.person(x.pid).name)}</small></div>${chip(x.status)}</button>`).join('') || leer('Noch nichts gebucht.')}</div>`;
  };

  const akteBasis = SEITEN.akte;
  SEITEN.akte = (c) => { const b = c.baustelle(zustand.akte) || (zustand.akte ? null : c.baustellenOffen()[0]); return akteBasis(c) + (b ? EXTRA.akte.map((fn) => fn(c, b)).join('') : ''); };
  const ROLLEN = { chef: 'Inhaber / Chef', buero: 'Büro', geselle: 'Geselle', azubi: 'Auszubildender', helfer: 'Bauhelfer' };
  SEITEN.team = (c) => {
    const istChef = c.ich && c.ich.rolle === 'chef';
    return seitenkopf('Team & Zugänge', `Betriebskennung: <b class="mono">${esc(c.cfg.kennung)}</b> · Jeder meldet sich mit seinem eigenen Code an`, istChef ? `<button class="k haupt" data-a="person-neu">${Icon('plus')} Mitarbeiter anlegen</button>` : '')
      + `<div class="karte"><div class="tabelle-huelle"><table class="t"><thead><tr><th>Name</th><th>Rolle</th><th>Zugang</th><th class="r">Std./Woche</th><th class="r">Urlaub</th><th></th></tr></thead><tbody>
      ${c.personen.map((p) => `<tr><td>${personZelle(c, p, p.funktion)}</td><td>${esc(ROLLEN[p.rolle] || p.rolle)}</td><td>${['chef', 'buero'].includes(p.rolle) ? 'Büro + App' : 'Mitarbeiter-App'}</td><td class="r num">${p.soll || '–'}</td><td class="r num">${p.urlaub || ''}</td>
        <td class="r">${istChef ? `<button class="k klein" data-a="zugang" data-id="${p.id}">Zugang zeigen</button> <button class="k klein" data-a="person" data-id="${p.id}">${Icon('stift')}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  };

  const FARBEN = ['#2f5e4e', '#1f4e79', '#7a2e2e', '#5b4636', '#3a4a63', '#6b5b16', '#2b2b2b', '#8a4b13'];
  SEITEN.einstellungen = (c) => {
    const aktiv = c.cfg.baukasten.knoten.map((k) => k.typ).filter((t) => BAUSTEINE[t] && BAUSTEINE[t].gruppe !== 'geplant');
    const geplant = Object.entries(BAUSTEINE).filter(([, b]) => b.gruppe === 'geplant');
    return seitenkopf('Einstellungen', 'Angaben zum Betrieb und Ihr Funktionsumfang') + EXTRA.einstellungen.map((fn) => fn(c)).join('')
      + `<div class="zwei"><div class="karte"><div class="kopf"><h3>Betrieb</h3></div><form class="koerper" id="f-einst">
        <div class="einstellungen-raster">
          <label class="feld"><span>Name</span><input name="name" value="${esc(c.cfg.name)}"></label>
          <label class="feld"><span>Kürzel (2 Buchstaben)</span><input name="kuerzel" maxlength="2" value="${esc(c.cfg.kuerzel)}"></label>
          <label class="feld"><span>Zusatz</span><input name="zusatz" value="${esc(c.cfg.zusatz)}"></label>
          <label class="feld"><span>Inhaber</span><input name="inhaber" value="${esc(c.cfg.inhaber || '')}"></label>
          <label class="feld"><span>Straße</span><input name="strasse" value="${esc(c.cfg.strasse || '')}"></label>
          <label class="feld"><span>PLZ</span><input name="plz" inputmode="numeric" maxlength="5" value="${esc(c.cfg.plz || '')}"></label>
          <label class="feld"><span>Ort</span><input name="ort" value="${esc(c.cfg.ort)}"></label>
          <label class="feld"><span>Telefon</span><input name="telefon" type="tel" value="${esc(c.cfg.telefon || '')}"></label>
          <label class="feld"><span>E-Mail</span><input name="email" type="email" value="${esc(c.cfg.email || '')}"></label>
          <label class="feld"><span>Steuernummer</span><input name="steuernr" value="${esc(c.cfg.steuernr || '')}"></label>
          <label class="feld"><span>USt-IdNr.</span><input name="ustid" value="${esc(c.cfg.ustid || '')}"></label>
          <label class="feld"><span>Bank</span><input name="bank" value="${esc(c.cfg.bank || '')}"></label>
          <label class="feld"><span>IBAN</span><input name="iban" value="${esc(c.cfg.iban || '')}"></label>
        </div>
        <p style="color:#6a726c;font-size:13px;margin:0 0 14px">Anschrift, Steuernummer und Bankverbindung stehen auf Angeboten und Rechnungen.</p>
        <div class="feld"><span>Firmenfarbe</span><div class="farbwahl">${FARBEN.map((f) => `<button type="button" style="background:${f}" class="${c.cfg.farbe === f ? 'an' : ''}" data-a="farbe" data-id="${f}" aria-label="Farbe ${f}"></button>`).join('')}</div></div>
        <button class="k haupt" type="submit">Speichern</button></form></div>
        <div class="karte"><div class="kopf"><h3>Weitere Bausteine</h3><span class="chip info">Paket ${esc(c.cfg.paket || 'Start')}</span></div>
          ${Object.entries(BAUSTEINE).filter(([t, b]) => b.gruppe !== 'geplant' && !c.cfg.baukasten.knoten.some((k) => k.typ === t)).map(([, b]) => `<div class="liste-zeile" style="opacity:.75">${Icon(b.icon)}<div class="text"><b>${esc(b.name)}</b><small>${esc(b.kurz)}</small></div><span class="chip">Auf Anfrage</span></div>`).join('')}
          ${geplant.map(([, b]) => `<div class="liste-zeile" style="opacity:.6">${Icon(b.icon)}<div class="text"><b>${esc(b.name)}</b><small>${esc(b.kurz)}</small></div><span class="chip">Auf Anfrage</span></div>`).join('')}
          <div class="legende">Weitere Funktionen richtet Richtwerk für Sie ein.</div></div></div>
        <div class="karte"><div class="kopf"><h3>Ihre Daten</h3></div><div class="koerper" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:240px;color:#5f6862">Alle Daten gehören Ihrem Betrieb. Sie können sie jederzeit vollständig herunterladen.</span><button class="k" data-a="datenexport">${Icon('download')} Alle Daten herunterladen</button></div></div>`;
  };

  /* Vollständiges HTML einer Seite (auch für die Vorschau im Studio) */
  function html(seite, c) {
    return (SEITEN[seite] || SEITEN.uebersicht)(c);
  }

  function rahmen(c) {
    const o = c.offen();
    let gruppe = '';
    const nav = NAV.filter((n) => sichtbar(n, c)).map((n) => {
      const kopf = n.gruppe !== gruppe ? `<div class="gruppe">${n.gruppe}</div>` : ''; gruppe = n.gruppe;
      const z = n.zahl ? n.zahl(o, c) : 0;
      const name = typeof n.braucht === 'string' && c.R.hat(n.braucht) && c.R.name(n.braucht) !== BAUSTEINE[n.braucht].name ? esc(c.R.name(n.braucht)) : n.name;
      return `${kopf}<button class="${zustand.seite === n.id ? 'aktiv' : ''}" data-a="gehe" data-id="${n.id}" ${zustand.seite === n.id ? 'aria-current="page"' : ''}>${Icon(n.icon)}${name}${z ? `<span class="zahl">${z}</span>` : ''}</button>`;
    }).join('');
    return `<div class="ui-buero ${kompakt() ? 'kompakt' : ''} ${zustand.navOffen ? 'nav-offen' : ''}" style="--firma:${esc(c.cfg.farbe)}">
      <header class="b-kopf">
        <button class="flach menueknopf" data-a="nav" aria-label="Menü">${Icon('menue')}</button>
        <span class="firmenzeichen">${esc(c.cfg.kuerzel || c.kuerzel(c.cfg.name))}</span>
        <div class="firma">${esc(c.cfg.name)}<small>Betriebszentrale</small></div>
        <span class="luecke"></span>
        <div class="suche nur-breit" role="search"><span class="sym">${Icon('suche')}</span><input id="b-suche" type="search" placeholder="Suchen: Baustelle, Kunde, Beleg …" aria-label="Suchen" autocomplete="off"><div class="treffer" id="b-treffer" hidden></div></div>
        ${c.R.hat('material') && c.R.an('material', 'sprache') ? `<button class="flach sprach-kopf" data-sprache title="Bestellung oder Erinnerung einsprechen">${Icon('mikro')}<span class="nur-breit">Einsprechen</span></button>` : ''}
        <div class="wer">${esc(c.ich.name)}<small>${esc(c.ich.funktion || ROLLEN[c.ich.rolle])}</small></div>
        <span class="rund">${esc(c.kuerzel(c.ich.name))}</span>
        <button class="flach" data-a="abmelden" title="Abmelden">${Icon('abmelden')}<span class="nur-breit">Abmelden</span></button>
      </header>
      <nav class="b-nav">${nav}<div class="unten"><a href="#" style="color:inherit">Bereich wechseln</a></div></nav>
      <main class="b-inhalt" id="b-inhalt">${html(zustand.seite, c)}</main>
    </div>`;
  }

  /* =====================================================================
     Ablauf
     ===================================================================== */
  let sitzung = null;
  function ctx() { return kontext(Store.cfg, Store.items, sitzung && sitzung.pid); }

  function start() {
    sitzung = Sitzung.lies('buero');
    if (!sitzung) { aktiverBereich = null; return bueroAnmeldung(); }
    aktiverBereich = Buero;
    Store.oeffne(sitzung.fid);
    Store.setzeBenutzer(sitzung.pid);
    zeichne();
  }
  function zeichne() {
    if (aktiverBereich !== Buero) return;
    const c = ctx();
    if (!c.cfg) { Wurzel().innerHTML = `<div class="laden"><div>Betrieb wird geladen<div class="balken"><i></i></div></div></div>`; return; }
    if (!c.ich || !['chef', 'buero'].includes(c.ich.rolle)) { Sitzung.setze('buero', null); return bueroAnmeldung('Ihr Zugang wurde geändert. Bitte neu anmelden.'); }
    const scroll = window.scrollY;
    const aktivesFeld = document.activeElement && document.activeElement.closest && document.activeElement.closest('#b-inhalt form, .suche');
    if (aktivesFeld) return; // nicht beim Tippen neu zeichnen
    warKompakt = kompakt();
    Wurzel().innerHTML = rahmen(c);
    bilderNachladen(Wurzel(), c.items);
    ablageVorbereiten(c);
    window.scrollTo(0, scroll);
  }

  /* ---------- Suche ---------- */
  function suchen(c, q) {
    const t = q.trim().toLowerCase(); if (t.length < 2) return [];
    const passt = (...felder) => felder.some((f) => String(f || '').toLowerCase().includes(t));
    const out = [];
    (c.cfg.baustellen || []).forEach((b) => { if (passt(b.name, b.ort, b.kunde, b.adresse, b.arbeit)) out.push({ a: 'akte', id: b.id, art: 'Baustelle', titel: b.name, unter: [b.kunde, b.ort].filter(Boolean).join(' · ') }); });
    c.personen.forEach((p) => { if (passt(p.name, p.funktion)) out.push({ a: 'gehe', id: 'team', art: 'Mitarbeiter', titel: p.name, unter: p.funktion }); });
    c.items.forEach((i) => {
      if (i.typ === 'beleg' && passt(i.haendler, i.notiz, i.kategorie, Zahl.eur(i.betrag))) out.push({ a: 'beleg', id: i.id, art: 'Beleg', titel: `${Zahl.eur(i.betrag)} · ${i.haendler || i.kategorie}`, unter: `${Datum.kurz(i.datum)} · ${c.person(i.pid).name}` });
      if (i.typ === 'lieferschein' && passt(i.lieferant, i.nummer, i.notiz, ...(i.positionen || []))) out.push({ a: 'lieferschein', id: i.id, art: 'Lieferschein', titel: `${i.lieferant} ${i.nummer || ''}`, unter: `${Datum.kurz(i.datum)} · ${c.bsName(i.bs)}` });
      if (i.typ === 'regie' && passt(i.text, i.kunde, i.material)) out.push({ a: 'regie', id: i.id, art: 'Regiezettel', titel: i.text, unter: `${Datum.kurz(i.datum)} · ${c.bsName(i.bs)}` });
      if (i.typ === 'tagebuch' && passt(i.text)) out.push({ a: 'akte', id: i.bs, art: 'Bautagebuch', titel: i.text, unter: `${Datum.kurz(i.datum)} · ${c.bsName(i.bs)}` });
    });
    return out.slice(0, 9);
  }
  document.addEventListener('input', (e) => {
    if (aktiverBereich !== Buero || e.target.id !== 'b-suche') return;
    const box = $('#b-treffer'); const liste = suchen(ctx(), e.target.value);
    box.hidden = !e.target.value.trim();
    box.innerHTML = liste.length ? liste.map((r) => `<button data-a="${r.a}" data-id="${esc(r.id)}"><small>${esc(r.art)}</small><b>${esc(r.titel)}</b><span>${esc(r.unter || '')}</span></button>`).join('') : '<div class="nichts">Nichts gefunden</div>';
  });
  document.addEventListener('click', (e) => {
    if (aktiverBereich !== Buero) return;
    const box = $('#b-treffer'); if (!box || box.hidden) return;
    if (e.target.closest('#b-treffer [data-a]')) { const inp = $('#b-suche'); if (inp) { inp.value = ''; inp.blur(); } box.hidden = true; return; }
    if (!e.target.closest('.suche')) box.hidden = true;
  }, true);

  /* ---------- Aktionen ---------- */
  document.addEventListener('click', (e) => {
    if (aktiverBereich !== Buero) return;
    const el = e.target.closest('[data-a]'); if (!el || !Wurzel().contains(el)) return;
    if (el.tagName === 'SELECT' || el.type === 'checkbox') return;
    const fn = AKTION[el.dataset.a]; if (fn) { e.preventDefault(); fn(el, ctx()); }
  });
  document.addEventListener('change', (e) => {
    if (aktiverBereich !== Buero) return;
    const el = e.target.closest('[data-a]'); if (!el || !Wurzel().contains(el)) return;
    if (el.dataset.a === 'filter-bs') { zustand.filter.lieferscheine = el.value; zeichne(); }
    if (el.dataset.a === 'bezahlt') Store.aendere(el.dataset.id, { bezahlt: el.checked });
    if (el.dataset.a === 'plan-zelle') planSetzen(ctx(), el.dataset.pid, el.dataset.tag, el.value);
  });
  document.addEventListener('submit', (e) => {
    if (aktiverBereich !== Buero || e.target.id !== 'f-einst') return;
    e.preventDefault();
    const w = Object.fromEntries(new FormData(e.target));
    const felder = ['zusatz', 'ort', 'inhaber', 'strasse', 'plz', 'telefon', 'email', 'steuernr', 'ustid', 'bank', 'iban'];
    Store.speichereCfg({ ...Store.cfg, name: w.name.trim() || Store.cfg.name, kuerzel: w.kuerzel.trim().toUpperCase(), ...Object.fromEntries(felder.map((k) => [k, (w[k] || '').trim()])) });
    document.activeElement.blur(); meldung('Gespeichert');
    setTimeout(zeichne, 50);
  });

  const AKTION = {
    gehe(el) { zustand.seite = el.dataset.id; zustand.navOffen = false; zeichne(); window.scrollTo(0, 0); },
    nav() { zustand.navOffen = !zustand.navOffen; zeichne(); },
    abmelden() { Sitzung.setze('buero', null); aktiverBereich = null; bueroAnmeldung(); },
    woche(el) { const d = Number(el.dataset.id); zustand.woche = d ? Datum.plus(zustand.woche, d) : Datum.montag(Datum.heute()); zeichne(); },
    monat(el) { const [j, m] = zustand.monat.split('-').map(Number); const d = new Date(j, m - 1 + Number(el.dataset.id), 1); zustand.monat = Datum.iso(d).slice(0, 7); zeichne(); },
    filter(el) { zustand.filter[el.dataset.feld] = el.dataset.id; zeichne(); },
    akte(el) { zustand.akte = el.dataset.id; zustand.seite = 'akte'; zeichne(); window.scrollTo(0, 0); },
    'stunden-ansicht'(el) { zustand.stundenAnsicht = el.dataset.id; zeichne(); },
    nachweis(el, c) { nachweisFenster(c, el.dataset.id); },
    planwoche(el) { zustand.planWoche = Datum.plus(zustand.planWoche, Number(el.dataset.id)); zeichne(); },
    'material-alle'(el, c) { c.typ('material').filter((m) => m.status === 'offen' && (m.lieferant || c.R.p('material').haendler) === el.dataset.id).forEach((m) => Store.aendere(m.id, { status: 'bestellt' })); meldung('Als bestellt markiert'); },
    'plan-ics'(el, c) { speichern(`Wochenplan_KW${Datum.kw(zustand.planWoche)}.ics`, new Blob([Uebergabe.planIcs(c, zustand.planWoche)], { type: 'text/calendar' })); meldung('Kalenderdatei gespeichert. Sie lässt sich in Outlook, Google- oder Apple-Kalender öffnen.'); },
    'plan-vorwoche'(el, c) {
      const alt = c.planWoche(Datum.plus(zustand.planWoche, -7));
      if (!alt) return meldung('In der Vorwoche ist nichts geplant.', 'fehler');
      planSpeichern(c, zustand.planWoche, JSON.parse(JSON.stringify(alt.zellen || {})));
      meldung('Plan der Vorwoche übernommen');
    },
    drucken(el) { const z = $('#druck-' + el.dataset.id); if (z) drucken(z.innerHTML); },
    regie(el, c) { regieFenster(c, el.dataset.id); },
    'tagebuch-neu'(el, c) { tagebuchFenster(c, el.dataset.id); },
    foto(el) { dateiUrl(el.dataset.id).then((url) => url && Fenster.oeffne({ titel: 'Foto', breit: true, inhalt: `<img src="${url}" alt="Foto" style="width:100%;display:block;border-radius:4px">` })); },
    'urlaub-ja'(el) { Store.aendere(el.dataset.id, { status: 'genehmigt', entschieden: Date.now() }); meldung('Urlaub genehmigt. Der Mitarbeiter sieht es sofort in der App.'); },
    'urlaub-nein'(el) { Store.aendere(el.dataset.id, { status: 'abgelehnt', entschieden: Date.now() }); meldung('Antrag abgelehnt.'); },
    au(el) { Store.aendere(el.dataset.id, { au: true }); },
    'woche-frei'(el, c) {
      const ende = Datum.plus(zustand.woche, 6);
      const ids = c.typ('stunden').filter((s) => s.datum >= zustand.woche && s.datum <= ende && s.status === 'offen').map((s) => s.id);
      ids.forEach((id) => Store.aendere(id, { status: 'freigegeben', freigabeVon: c.ich.id }));
      meldung(`${ids.length} Einträge freigegeben`);
    },
    tag(el, c) { tagFenster(c, el.dataset.pid, el.dataset.datum); },
    'stunden-neu'(el, c) { stundenFenster(c, { pid: c.arbeiter()[0] && c.arbeiter()[0].id, datum: Datum.heute(), von: '07:00', bis: '16:15', pause: 45 }); },
    'abwesenheit-neu'(el, c) { abwesenheitFenster(c); },
    beleg(el, c) { unterlageFenster(c, el.dataset.id); },
    lieferschein(el, c) { unterlageFenster(c, el.dataset.id); },
    hochladen(el, c) { hochladenFenster(c, el.dataset.id); },
    material(el) { Store.aendere(el.dataset.id, { status: el.dataset.wert }); },
    'tageloehner-neu'(el, c) { tageloehnerFenster(c); },
    tageloehner(el, c) { tageloehnerFenster(c, el.dataset.id); },
    'einsatz-neu'(el, c) { einsatzFenster(c); },
    'einsatz-frei'(el) { Store.aendere(el.dataset.id, { status: 'freigegeben' }); },
    quittung(el, c) { quittungFenster(c, el.dataset.id); },
    paket(el, c) { paketHerunterladen(c, el); },
    'dok-hochladen'(el, c) { dateiWaehlen('application/pdf,image/*', (f) => dokumentFenster(c, f)); },
    'dok-ansehen'(el, c) { const d = c.items.find((i) => i.id === el.dataset.id); dateiAnsehen(d); },
    'baustelle-neu'(el, c) { baustelleFenster(c); },
    baustelle(el, c) { baustelleFenster(c, el.dataset.id); },
    'person-neu'(el, c) { personFenster(c); },
    person(el, c) { personFenster(c, el.dataset.id); },
    zugang(el, c) { zugangFenster(c, el.dataset.id); },
    farbe(el) { Store.speichereCfg({ ...Store.cfg, farbe: el.dataset.id }); },
    datenexport(el, c) { const daten = { betrieb: c.cfg, eintraege: c.items, exportiert: new Date().toISOString() }; speichern(`${c.cfg.kennung}-daten-${Datum.heute()}.json`, JSON.stringify(daten, null, 2)); },
  };

  /* ---------- Fenster ---------- */
  function tagFenster(c, pid, datum) {
    const p = c.person(pid); const eintr = c.stundenAm(pid, datum);
    const darf = c.R.darfFreigeben(c.ich.rolle);
    Fenster.oeffne({
      titel: `${esc(p.name)} · ${esc(Datum.lang(datum))}`, bereich: 'ui-buero-fenster',
      inhalt: (eintr.length ? `<table class="t"><thead><tr><th>Zeit</th><th>Baustelle</th><th>Tätigkeit</th><th class="r">Std.</th><th>Status</th><th></th></tr></thead><tbody>${eintr.map((e) => `<tr><td class="num">${esc(e.von)} – ${esc(e.bis || 'läuft')}${e.pause ? `<small style="display:block;color:#7a827c">Pause ${e.pause} Min.</small>` : ''}</td><td>${esc(c.bsName(e.bs))}</td><td>${esc(e.taetigkeit || '')}</td><td class="r num">${e.bis ? Zahl.std(stundenVon(e)) : ''}</td><td>${chip(e.status)}</td><td class="r" style="white-space:nowrap">${e.status === 'offen' && darf ? `<button class="k klein ok" data-f="frei" data-id="${e.id}">Freigeben</button> ` : ''}<button class="k klein" data-f="bearbeiten" data-id="${e.id}">${Icon('stift')}</button></td></tr>`).join('')}</tbody></table>` : leer('An diesem Tag ist nichts erfasst.'))
        + eintr.map((e) => verlauf(c, e)).filter(Boolean).slice(-1).join('')
        + (c.abwesend(pid, datum) ? `<p class="chip warn" style="margin-top:12px">${c.abwesend(pid, datum).typ === 'krank' ? 'Krank gemeldet' : 'Urlaub'}</p>` : ''),
      fuss: `<button class="k" data-f="neu">${Icon('plus')} Eintrag hinzufügen</button><button class="k" data-f="zu">Schließen</button>`,
      aktionen: {
        frei: (b) => { Store.aendere(b.dataset.id, { status: 'freigegeben', freigabeVon: c.ich.id }); Fenster.schliesse(); },
        bearbeiten: (b) => stundenFenster(c, c.items.find((i) => i.id === b.dataset.id)),
        neu: () => stundenFenster(c, { pid, datum, von: '07:00', bis: '16:15', pause: 45 }),
      },
    });
  }

  function stundenFenster(c, e) {
    const neu = !e.id;
    const hg = Fenster.oeffne({
      titel: neu ? 'Stunden eintragen' : 'Stunden ändern',
      inhalt: `<label class="feld"><span>Mitarbeiter</span><select name="pid">${personOptionen(c, e.pid)}</select></label>
        <div class="reihe"><label class="feld"><span>Datum</span><input type="date" name="datum" value="${esc(e.datum)}"></label>
        <label class="feld"><span>Beginn</span><input type="time" name="von" value="${esc(e.von)}"></label>
        <label class="feld"><span>Ende</span><input type="time" name="bis" value="${esc(e.bis)}"></label>
        <label class="feld"><span>Pause (Min.)</span><input type="number" name="pause" min="0" step="5" value="${esc(e.pause || 0)}"></label></div>
        ${c.R.mitBaustelle('stunden') ? `<label class="feld"><span>Baustelle</span><select name="bs">${bsOptionen(c, e.bs)}</select></label>` : ''}
        <label class="feld"><span>Tätigkeit</span><input name="taetigkeit" value="${esc(e.taetigkeit || '')}" placeholder="z. B. Dachstuhl richten"></label>`,
      fuss: `${neu ? '' : `<button class="k nein" data-f="loeschen" style="margin-right:auto">${Icon('muell')} Löschen</button>`}<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="speichern">Speichern</button>`,
      aktionen: {
        speichern: () => {
          const w = Fenster.werte(hg);
          if (!w.von || !w.bis || w.bis <= w.von) return meldung('Bitte Beginn und Ende prüfen.', 'fehler');
          const daten = { typ: 'stunden', pid: w.pid, datum: w.datum, von: w.von, bis: w.bis, pause: Number(w.pause) || 0, bs: w.bs || '', taetigkeit: w.taetigkeit, quelle: 'buero' };
          if (neu) Store.neu({ ...daten, status: 'freigegeben' }); else Store.aendere(e.id, { ...daten, status: e.status === 'laeuft' ? 'freigegeben' : e.status, geaendertVon: c.ich.id });
          Fenster.schliesse(); meldung('Gespeichert');
        },
        loeschen: () => { Store.loesche(e.id); Fenster.schliesse(); meldung('Eintrag gelöscht'); },
      },
    });
  }

  function abwesenheitFenster(c) {
    const hg = Fenster.oeffne({
      titel: 'Abwesenheit eintragen',
      inhalt: `<label class="feld"><span>Mitarbeiter</span><select name="pid">${personOptionen(c, null, c.personen)}</select></label>
        <label class="feld"><span>Art</span><select name="art"><option>Urlaub</option><option>Überstundenabbau</option><option>Sonderurlaub</option><option value="krank">Krank</option></select></label>
        <div class="reihe"><label class="feld"><span>Von</span><input type="date" name="von" value="${Datum.heute()}"></label><label class="feld"><span>Bis</span><input type="date" name="bis" value="${Datum.heute()}"></label></div>
        <label class="feld"><span>Notiz</span><input name="notiz"></label>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Eintragen</button>`,
      aktionen: { ok: () => {
        const w = Fenster.werte(hg); if (w.bis < w.von) return meldung('Das Ende liegt vor dem Beginn.', 'fehler');
        if (w.art === 'krank') Store.neu({ typ: 'krank', pid: w.pid, von: w.von, bis: w.bis, notiz: w.notiz, status: 'gemeldet', au: false });
        else Store.neu({ typ: 'urlaub', pid: w.pid, von: w.von, bis: w.bis, art: w.art, notiz: w.notiz, status: 'genehmigt' });
        Fenster.schliesse(); meldung('Eingetragen');
      } },
    });
  }

  function unterlageFenster(c, id) {
    const e = c.items.find((i) => i.id === id); if (!e) return;
    const istBeleg = e.typ === 'beleg'; const darf = c.R.darfFreigeben(c.ich.rolle);
    const kategorien = c.R.liste('belege', 'kategorien');
    const hg = Fenster.oeffne({
      titel: istBeleg ? `Beleg ${Zahl.eur(e.betrag)}` : `Lieferschein ${esc(e.lieferant)}`, breit: true,
      inhalt: `<div class="vorschau-bild"><div id="vb-bild"><img alt="Foto" id="vb-img"></div><div>
        ${istBeleg ? `<div class="reihe"><label class="feld"><span>Betrag (€)</span><input name="betrag" type="number" step="0.01" value="${esc(e.betrag)}"></label><label class="feld"><span>Kategorie</span><select name="kategorie">${kategorien.map((k) => `<option ${k === e.kategorie ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label></div>
          <label class="feld"><span>Geschäft</span><input name="haendler" value="${esc(e.haendler || '')}"></label>`
        : `<div class="reihe"><label class="feld"><span>Lieferant</span><input name="lieferant" value="${esc(e.lieferant)}"></label><label class="feld"><span>Lieferschein-Nr.</span><input name="nummer" value="${esc(e.nummer || '')}"></label></div>`}
        ${c.R.hat('baustellen') ? `<label class="feld"><span>Baustelle</span><select name="bs">${bsOptionen(c, e.bs)}</select></label>` : ''}
        <label class="feld"><span>Notiz</span><input name="notiz" value="${esc(e.notiz || '')}"></label>
        <dl class="daten"><dt>Datum</dt><dd>${esc(Datum.lang(e.datum))}</dd><dt>Von</dt><dd>${esc(c.person(e.pid).name)}</dd><dt>Status</dt><dd>${chip(e.status)}</dd>${e.positionen ? `<dt>Positionen</dt><dd>${e.positionen.map(esc).join('<br>')}</dd>` : ''}${Zusatz.anzeige(c, istBeleg ? 'belege' : 'lieferscheine', e.extra)}</dl>${verlauf(c, e)}
      </div></div>`,
      fuss: `<button class="k nein" data-f="loeschen" style="margin-right:auto">${Icon('muell')} Löschen</button>
        ${e.status === 'offen' && darf ? `<button class="k nein" data-f="status" data-id="abgelehnt">Ablehnen</button><button class="k haupt" data-f="status" data-id="freigegeben">${Icon('haken')} Freigeben</button>` : ''}
        ${e.status === 'neu' ? `<button class="k haupt" data-f="status" data-id="geprueft">${Icon('haken')} Geprüft</button>` : ''}
        <button class="k" data-f="speichern">Änderungen speichern</button>`,
      aktionen: {
        speichern: () => { const w = Fenster.werte(hg); if (w.betrag !== undefined) w.betrag = Number(w.betrag); Store.aendere(id, w); Fenster.schliesse(); meldung('Gespeichert'); },
        status: (b) => { const w = Fenster.werte(hg); if (w.betrag !== undefined) w.betrag = Number(w.betrag); Store.aendere(id, { ...w, status: b.dataset.id, geprueftVon: c.ich.id }); Fenster.schliesse(); },
        loeschen: () => { Store.loesche(id); Fenster.schliesse(); meldung('Gelöscht'); },
      },
    });
    bildFuer(e).then((url) => {
      if (!url) return;
      if (url.startsWith('data:application/pdf')) $('#vb-bild', hg).innerHTML = `<iframe src="${url}" title="PDF"></iframe>`;
      else $('#vb-img', hg).src = url;
    });
  }

  function dateiWaehlen(accept, fertig) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => inp.files[0] && fertig(inp.files[0]); inp.click();
  }
  async function dateiLesen(f) {
    if (f.type.startsWith('image/')) return bildVerkleinern(f, { maxKante: 1300 });
    if (f.size > 170000) throw new Error('Die PDF ist zu groß (max. 170 KB). Bitte kleiner speichern oder als Foto hochladen.');
    return dateiAlsDataUrl(f);
  }

  function hochladenFenster(c, typ) {
    dateiWaehlen('image/*,application/pdf', async (f) => {
      let url; try { url = await dateiLesen(f); } catch (err) { return meldung(err.message, 'fehler'); }
      const istBeleg = typ === 'beleg';
      const hg = Fenster.oeffne({
        titel: istBeleg ? 'Beleg hochladen' : 'Lieferschein hochladen', breit: true,
        inhalt: `<div class="vorschau-bild"><div>${url.startsWith('data:application/pdf') ? `<iframe src="${url}"></iframe>` : `<img src="${url}" alt="">`}</div><div>
          ${istBeleg ? `<div class="reihe"><label class="feld"><span>Betrag (€)</span><input name="betrag" type="number" step="0.01"></label><label class="feld"><span>Kategorie</span><select name="kategorie">${c.R.liste('belege', 'kategorien').map((k) => `<option>${esc(k)}</option>`).join('')}</select></label></div><label class="feld"><span>Geschäft</span><input name="haendler"></label>`
          : `<label class="feld"><span>Lieferant</span><select name="lieferant">${c.R.liste('lieferscheine', 'lieferanten').map((k) => `<option>${esc(k)}</option>`).join('')}</select></label><label class="feld"><span>Lieferschein-Nr.</span><input name="nummer"></label>`}
          <label class="feld"><span>Datum</span><input type="date" name="datum" value="${Datum.heute()}"></label>
          ${c.R.hat('baustellen') ? `<label class="feld"><span>Baustelle</span><select name="bs">${bsOptionen(c, '')}</select></label>` : ''}
          <label class="feld"><span>Notiz</span><input name="notiz"></label></div></div>`,
        fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
        aktionen: { ok: async (b) => {
          const w = Fenster.werte(hg); b.disabled = true;
          try {
            const datei = await Store.speichereDatei(url, f.name);
            if (istBeleg) { w.betrag = Number(w.betrag) || 0; Store.neu({ typ: 'beleg', pid: c.ich.id, ...w, datei, status: 'geprueft' }); }
            else Store.neu({ typ: 'lieferschein', pid: c.ich.id, ...w, datei, status: 'geprueft' });
            Fenster.schliesse(); meldung('Hochgeladen');
          } catch (err) { b.disabled = false; meldung(err.message, 'fehler'); }
        } },
      });
    });
  }

  function dokumentFenster(c, f) {
    dateiLesen(f).then((url) => {
      const vm = Datum.plus(Datum.heute().slice(0, 8) + '01', -1).slice(0, 7);
      const hg = Fenster.oeffne({
        titel: 'Dokument verteilen',
        inhalt: `<p style="margin-top:0">${Icon('dokument')} <b>${esc(f.name)}</b></p>
          <label class="feld"><span>Titel</span><input name="titel" value="Lohnabrechnung ${esc(Datum.monatName(vm))}"></label>
          <label class="feld"><span>Für</span><select name="fuer">${personOptionen(c, null, c.personen)}<option value="alle">Alle Mitarbeiter</option></select></label>`,
        fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">In die App stellen</button>`,
        aktionen: { ok: async (b) => {
          const w = Fenster.werte(hg); b.disabled = true;
          try { const datei = await Store.speichereDatei(url, f.name); Store.neu({ typ: 'dokument', ...w, monat: vm, datei, name: f.name, gelesen: false, datum: Datum.heute() }); Fenster.schliesse(); meldung('Der Mitarbeiter sieht das Dokument jetzt in seiner App.'); }
          catch (err) { b.disabled = false; meldung(err.message, 'fehler'); }
        } },
      });
    }).catch((err) => meldung(err.message, 'fehler'));
  }
  function ablageVorbereiten(c) {
    const a = $('#ablage-dok'); if (!a) return;
    a.addEventListener('dragover', (e) => { e.preventDefault(); a.classList.add('drueber'); });
    a.addEventListener('dragleave', () => a.classList.remove('drueber'));
    a.addEventListener('drop', (e) => { e.preventDefault(); a.classList.remove('drueber'); const f = e.dataTransfer.files[0]; if (f) dokumentFenster(c, f); });
  }
  function dateiAnsehen(d) {
    if (!d) return;
    const hg = Fenster.oeffne({ titel: esc(d.titel), breit: true, inhalt: '<div id="dok-inhalt" class="leer">Wird geladen …</div>' });
    bildFuer(d).then((url) => {
      const ziel = $('#dok-inhalt', hg); if (!ziel) return;
      ziel.className = '';
      ziel.innerHTML = url && url.startsWith('data:application/pdf') ? `<iframe src="${url}" style="width:100%;height:70vh;border:0"></iframe>` : `<img src="${url}" style="max-width:100%;display:block;margin:auto">`;
    });
  }

  function tageloehnerFenster(c, id) {
    const t = (c.cfg.tageloehner || []).find((x) => x.id === id) || { name: '', notiz: '', satz: c.R.p('tagelohn').satz };
    const hg = Fenster.oeffne({
      titel: id ? 'Aushilfe bearbeiten' : 'Aushilfe anlegen',
      inhalt: `<label class="feld"><span>Name</span><input name="name" value="${esc(t.name)}"></label><label class="feld"><span>Notiz</span><input name="notiz" value="${esc(t.notiz)}" placeholder="z. B. Student, Rentner"></label><label class="feld"><span>Stundensatz (€)</span><input type="number" name="satz" step="0.1" value="${esc(t.satz)}"></label><p style="color:#7a827c;font-size:12px;margin:0">Mindestlohn 2026: 13,90 € pro Stunde.</p>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: { ok: () => {
        const w = Fenster.werte(hg); if (!w.name.trim()) return meldung('Bitte einen Namen eingeben.', 'fehler');
        if (Number(w.satz) < 13.9) return meldung('Der Satz liegt unter dem Mindestlohn (13,90 €).', 'fehler');
        const liste = [...(Store.cfg.tageloehner || [])]; const neu = { id: id || Store.uid('t'), name: w.name.trim(), notiz: w.notiz, satz: Number(w.satz) };
        const i = liste.findIndex((x) => x.id === id); if (i >= 0) liste[i] = neu; else liste.push(neu);
        Store.speichereCfg({ ...Store.cfg, tageloehner: liste }); Fenster.schliesse();
      } },
    });
  }
  function einsatzFenster(c) {
    const tl = c.cfg.tageloehner || [];
    const hg = Fenster.oeffne({
      titel: 'Einsatz erfassen',
      inhalt: `<label class="feld"><span>Aushilfe</span><select name="tid">${tl.map((t) => `<option value="${t.id}">${esc(t.name)} (${Zahl.eur(t.satz)})</option>`).join('')}</select></label>
        <div class="reihe"><label class="feld"><span>Datum</span><input type="date" name="datum" value="${Datum.heute()}"></label><label class="feld"><span>Stunden</span><input type="number" step="0.25" name="stunden" value="8"></label></div>
        ${c.R.mitBaustelle('tagelohn') ? `<label class="feld"><span>Baustelle</span><select name="bs">${bsOptionen(c, '')}</select></label>` : ''}
        <label class="feld"><span>Tätigkeit</span><input name="taetigkeit"></label>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: { ok: () => {
        const w = Fenster.werte(hg); const t = tl.find((x) => x.id === w.tid);
        Store.neu({ typ: 'tagelohn', tid: w.tid, datum: w.datum, stunden: Number(w.stunden), satz: t ? t.satz : c.R.p('tagelohn').satz, bs: w.bs || '', taetigkeit: w.taetigkeit, status: startStatus(c.R, 'tagelohn'), bezahlt: false });
        Fenster.schliesse(); meldung('Einsatz gespeichert');
      } },
    });
  }
  function quittungFenster(c, id) {
    const e = c.items.find((i) => i.id === id); const t = c.tageloehner(e.tid);
    Fenster.oeffne({
      titel: 'Quittung',
      inhalt: `<div style="border:1px solid #dadfd7;padding:20px;font-size:14px;line-height:1.7">
        <b style="font-size:16px">Quittung Aushilfstätigkeit</b><br>${esc(c.cfg.name)}, ${esc(c.cfg.ort)}<br><br>
        Ich, <b>${esc(t.name)}</b>, habe am ${esc(Datum.lang(e.datum))} ${Zahl.std(e.stunden)} Stunden à ${Zahl.eur(e.satz)} gearbeitet${e.bs ? ` (Baustelle ${esc(c.bsName(e.bs))})` : ''}.<br>
        Betrag erhalten: <b>${Zahl.eur(e.stunden * e.satz)}</b><br><br>Datum, Unterschrift: ______________________</div>`,
      fuss: `<button class="k" data-f="zu">Schließen</button><button class="k haupt" data-f="laden">${Icon('download')} Als Datei speichern</button>`,
      aktionen: { laden: () => speichern(`Quittung_${t.name.replace(/\s+/g, '_')}_${e.datum}.txt`, `Quittung Aushilfstätigkeit\n${c.cfg.name}, ${c.cfg.ort}\n\n${t.name} hat am ${Datum.lang(e.datum)} ${Zahl.std(e.stunden)} Stunden à ${Zahl.eur(e.satz)} gearbeitet.\nBetrag erhalten: ${Zahl.eur(e.stunden * e.satz)}\n\nDatum, Unterschrift: ______________________\n`) },
    });
  }
  function baustelleFenster(c, id) {
    const b = (c.cfg.baustellen || []).find((x) => x.id === id) || { name: '', ort: '', arbeit: '', status: 'laufend' };
    const hg = Fenster.oeffne({
      titel: id ? 'Baustelle bearbeiten' : 'Baustelle anlegen',
      inhalt: `<label class="feld"><span>Name</span><input name="name" value="${esc(b.name)}" placeholder="z. B. Neubau EFH Müller"></label>
        <div class="reihe"><label class="feld"><span>Kunde</span><input name="kunde" value="${esc(b.kunde || '')}"></label><label class="feld"><span>Telefon</span><input name="telefon" type="tel" value="${esc(b.telefon || '')}"></label></div>
        <div class="reihe"><label class="feld"><span>Straße, PLZ Ort</span><input name="adresse" value="${esc(b.adresse || '')}" placeholder="für die Route im Handy"></label><label class="feld"><span>Ort (kurz)</span><input name="ort" value="${esc(b.ort)}"></label></div>
        <label class="feld"><span>Arbeiten</span><input name="arbeit" value="${esc(b.arbeit || '')}"></label>
        <label class="feld"><span>Hinweise für die Mitarbeiter</span><input name="notiz" value="${esc(b.notiz || '')}" placeholder="z. B. Schlüssel beim Nachbarn, Kran ab 7 Uhr"></label>
        <label class="feld"><span>Status</span><select name="status">${[['geplant', 'Geplant'], ['laufend', 'Laufend'], ['fertig', 'Fertig']].map(([k, t]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: { ok: () => {
        const w = Fenster.werte(hg); if (!w.name.trim()) return meldung('Bitte einen Namen eingeben.', 'fehler');
        const liste = [...(Store.cfg.baustellen || [])]; const neu = { ...b, ...w, id: id || Store.uid('b') };
        const i = liste.findIndex((x) => x.id === id); if (i >= 0) liste[i] = neu; else liste.push(neu);
        Store.speichereCfg({ ...Store.cfg, baustellen: liste }); Fenster.schliesse();
      } },
    });
  }
  /* ---------- Wochenplan speichern ---------- */
  function planSpeichern(c, montag, zellen) {
    const w = c.planWoche(montag);
    if (w) Store.aendere(w.id, { zellen }); else Store.neu({ id: 'plan_' + montag, typ: 'plan', montag, zellen });
  }
  function planSetzen(c, pid, tag, wert) {
    const w = c.planWoche(zustand.planWoche); const zellen = JSON.parse(JSON.stringify((w && w.zellen) || {}));
    zellen[pid] = zellen[pid] || {}; if (wert) zellen[pid][tag] = wert; else delete zellen[pid][tag];
    planSpeichern(c, zustand.planWoche, zellen);
  }

  /* ---------- Monatsnachweis (druckbar) ---------- */
  function nachweisFenster(c, pid) {
    const p = c.person(pid); const ym = zustand.monat; const n = c.monatsnachweis(pid, ym);
    const zeilen = n.tage.map((t) => {
      const wt = Datum.WT[Datum.wochentag(t.datum)];
      const bem = t.feiertag || (t.abw ? (t.abw.typ === 'krank' ? 'Krank' : esc(t.abw.art || 'Urlaub')) : t.eintr.some((e) => e.taetigkeit === 'Berufsschule') ? 'Berufsschule' : '');
      const grau = !t.arbeitstag ? ' class="frei"' : '';
      if (!t.eintr.length) return `<tr${grau}><td>${wt} ${Datum.kurz(t.datum)}</td><td></td><td></td><td></td><td></td><td class="r num">${t.g ? Zahl.std(t.g) : ''}</td><td>${bem}</td></tr>`;
      return t.eintr.map((e, i) => `<tr${grau}><td>${i ? '' : `${wt} ${Datum.kurz(t.datum)}`}</td><td class="num">${esc(e.von)} – ${esc(e.bis)}</td><td class="r num">${e.pause || 0}</td><td>${esc(c.bsName(e.bs))}</td><td class="r num">${Zahl.std(stundenVon(e))}</td><td></td><td>${i ? '' : bem}</td></tr>`).join('');
    }).join('');
    const inhalt = `<div class="nachweis" id="druck-nachweis">
      <div class="nw-kopf"><div><b>${esc(c.cfg.name)}</b><br>${esc(c.cfg.ort || '')}</div><div style="text-align:right"><b>Stundennachweis ${esc(Datum.monatName(ym))}</b><br>${esc(p.name)} · ${esc(p.funktion || '')}</div></div>
      <table class="t"><thead><tr><th>Tag</th><th>Beginn – Ende</th><th class="r">Pause</th><th>Baustelle</th><th class="r">Std.</th><th class="r">Gutschr.</th><th>Bemerkung</th></tr></thead><tbody>${zeilen}</tbody></table>
      <div class="nw-summe"><span>Soll <b>${Zahl.std(n.soll)}</b></span><span>Gearbeitet <b>${Zahl.std(n.ist)}</b></span><span>Gutschrift Urlaub/Krank <b>${Zahl.std(n.gut)}</b></span><span>Saldo Monat <b>${n.diff >= 0 ? '+' : ''}${Zahl.std(n.diff)}</b></span><span>Überstundenkonto <b>${(() => { const k = c.konto(pid, ym); return (k >= 0 ? '+' : '') + Zahl.std(k); })()}</b></span></div>
      <div class="nw-unterschrift"><div>Datum, Unterschrift Arbeitnehmer</div><div>Datum, Unterschrift Arbeitgeber</div></div>
      <p class="nw-fuss">Aufzeichnung von Beginn, Ende und Dauer der täglichen Arbeitszeit nach § 17 MiLoG. Aufbewahrung mindestens zwei Jahre.</p></div>`;
    Fenster.oeffne({ titel: `Stundennachweis ${esc(p.name)}`, breit: true, bereich: 'ui-buero-fenster', inhalt,
      fuss: `<button class="k" data-f="zu">Schließen</button><button class="k haupt" data-f="drucken">${Icon('drucken')} Drucken</button>`,
      aktionen: { drucken: () => drucken($('#druck-nachweis').outerHTML) } });
  }

  /* ---------- Regiezettel ---------- */
  function regieHtml(c, r) {
    const b = c.baustelle(r.bs) || { name: '–', adresse: '' };
    return `<div class="nachweis regiezettel" id="druck-regie">
      <div class="nw-kopf"><div><b>${esc(c.cfg.name)}</b><br>${esc(c.cfg.ort || '')}</div><div style="text-align:right"><b>Regiebericht</b><br>${esc(Datum.lang(r.datum))}</div></div>
      <dl class="daten"><dt>Baustelle</dt><dd>${esc(b.name)}${b.adresse ? `, ${esc(b.adresse)}` : ''}</dd><dt>Ausgeführte Arbeit</dt><dd>${esc(r.text)}</dd>
      <dt>Arbeitszeit</dt><dd>${r.leute > 1 ? `${r.leute} Mitarbeiter × ${Zahl.std(r.stunden)} Std. = ` : ''}<b>${Zahl.std(regieStunden(r))} Std.</b></dd>
      ${r.material ? `<dt>Material</dt><dd>${esc(r.material)}</dd>` : ''}${Zusatz.anzeige(c, 'regie', r.extra)}<dt>Aufgeschrieben von</dt><dd>${esc(c.person(r.pid).name)}</dd></dl>
      <div class="nw-unterschrift"><div>${r.unterschrift ? `<img data-datei="${esc(r.unterschrift)}" alt="Unterschrift" style="height:64px;display:block">` : '<div style="height:64px"></div>'}Auftraggeber${r.kunde ? ': ' + esc(r.kunde) : ''}</div><div><div style="height:64px"></div>${esc(c.cfg.name)}</div></div>
      <p class="nw-fuss">Die oben genannten Arbeiten wurden zusätzlich zum Auftrag ausgeführt und werden nach Aufwand abgerechnet.</p></div>`;
  }
  function regieFenster(c, id) {
    const r = c.items.find((i) => i.id === id); if (!r) return;
    const hg = Fenster.oeffne({ titel: `Regiezettel ${esc(Datum.kurz(r.datum))}`, breit: true, bereich: 'ui-buero-fenster',
      inhalt: regieHtml(c, r) + `<p style="margin:14px 0 0">${r.status === 'offen' ? '<span class="chip warn">Noch nicht unterschrieben</span> Der Kunde kann in der App nachträglich unterschreiben.' : `Wert nach Aufwand: <b>${Zahl.eur(regieBetrag(c, r))}</b> (${Zahl.eur(c.R.p('regie').satz)} je Std.)`}</p>${verlauf(c, r)}`,
      fuss: `<button class="k nein" data-f="loeschen" style="margin-right:auto">${Icon('muell')} Löschen</button><button class="k" data-f="drucken">${Icon('drucken')} Drucken</button>${r.status === 'abgerechnet' ? `<button class="k" data-f="status" data-id="${r.unterschrift ? 'unterschrieben' : 'offen'}">Wieder öffnen</button>` : `<button class="k haupt" data-f="status" data-id="abgerechnet">${Icon('haken')} Abgerechnet</button>`}`,
      aktionen: {
        drucken: () => drucken($('#druck-regie', hg).outerHTML),
        status: (b) => { Store.aendere(id, { status: b.dataset.id }); Fenster.schliesse(); meldung(b.dataset.id === 'abgerechnet' ? 'Als abgerechnet markiert' : 'Wieder offen'); },
        loeschen: (b) => { if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich löschen?'; return; } Store.loesche(id); Fenster.schliesse(); meldung('Gelöscht'); },
      } });
    bilderNachladen(hg, c.items);
  }

  /* ---------- Bautagebuch-Eintrag aus dem Büro ---------- */
  function tagebuchFenster(c, bs) {
    const fotos = [];
    const hg = Fenster.oeffne({ titel: 'Tagebuch-Eintrag', bereich: 'ui-buero-fenster',
      inhalt: `<div class="reihe"><label class="feld"><span>Datum</span><input type="date" name="datum" value="${Datum.heute()}" max="${Datum.heute()}"></label>
        <label class="feld"><span>Wetter</span><select name="wetter">${Object.entries(WETTER).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
        <label class="feld"><span>Was ist passiert?</span><textarea name="text" rows="4" placeholder="z. B. Schwelle gesetzt, Abnahme mit Bauleitung"></textarea></label>
        <div class="feld"><span>Fotos</span><div class="fotos" id="tb-fotos"></div><button class="k klein" type="button" data-f="foto">${Icon('foto')} Foto hinzufügen</button></div>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: {
        foto: () => dateiWaehlen('image/*', async (f) => {
          if (fotos.length >= Number(c.R.p('bautagebuch').fotos)) return meldung('Mehr Fotos gehen in einen neuen Eintrag.', 'fehler');
          try { const url = await bildVerkleinern(f, { maxKante: 1100 }); fotos.push(await Store.speichereDatei(url, f.name)); $('#tb-fotos', hg).insertAdjacentHTML('beforeend', `<span class="foto"><img src="${url}" alt="Foto"></span>`); }
          catch (e) { meldung(e.message, 'fehler'); }
        }),
        ok: () => {
          const w = Fenster.werte(hg); if (!w.text.trim() && !fotos.length) return meldung('Bitte eine Notiz oder ein Foto hinzufügen.', 'fehler');
          Store.neu({ typ: 'tagebuch', pid: c.ich.id, datum: w.datum, bs, wetter: w.wetter, text: w.text.trim(), fotos });
          Fenster.schliesse(); meldung('Eintrag gespeichert');
        },
      } });
  }

  function neuerCode(personen) {
    let code; do { code = String(Math.floor(2000 + Math.random() * 7999)); } while (personen.some((p) => p.code === code)); return code;
  }
  function personFenster(c, id) {
    const p = c.personen.find((x) => x.id === id) || { name: '', funktion: '', rolle: 'geselle', soll: 40, urlaub: c.R.p('urlaub').tage };
    const hg = Fenster.oeffne({
      titel: id ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen',
      inhalt: `<label class="feld"><span>Name</span><input name="name" value="${esc(p.name)}"></label><label class="feld"><span>Funktion</span><input name="funktion" value="${esc(p.funktion)}" placeholder="z. B. Geselle"></label>
        <label class="feld"><span>Rolle</span><select name="rolle">${Object.entries(ROLLEN).map(([k, t]) => `<option value="${k}" ${p.rolle === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="reihe"><label class="feld"><span>Wochenstunden</span><input type="number" name="soll" value="${esc(p.soll)}"></label><label class="feld"><span>Urlaubstage</span><input type="number" name="urlaub" value="${esc(p.urlaub)}"></label></div>`,
      fuss: `${id && id !== c.ich.id ? `<button class="k nein" data-f="weg" style="margin-right:auto">${Icon('muell')} Entfernen</button>` : ''}<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: {
        ok: () => {
          const w = Fenster.werte(hg); if (!w.name.trim()) return meldung('Bitte einen Namen eingeben.', 'fehler');
          const liste = [...Store.cfg.personen]; const neu = { ...p, ...w, name: w.name.trim(), soll: Number(w.soll) || 0, urlaub: Number(w.urlaub) || 0, id: id || Store.uid('p'), code: p.code || neuerCode(liste) };
          const i = liste.findIndex((x) => x.id === id); if (i >= 0) liste[i] = neu; else liste.push(neu);
          Store.speichereCfg({ ...Store.cfg, personen: liste }); Fenster.schliesse();
          if (!id) setTimeout(() => zugangFenster(ctx(), neu.id), 60);
        },
        weg: () => { Store.speichereCfg({ ...Store.cfg, personen: Store.cfg.personen.filter((x) => x.id !== id) }); Fenster.schliesse(); },
      },
    });
  }
  function zugangFenster(c, id) {
    const p = c.person(id);
    Fenster.oeffne({
      titel: `Zugang für ${esc(p.name)}`,
      inhalt: `<p style="margin-top:0;color:#5f6862">Diese Angaben bekommt ${esc(p.name.split(' ')[0])} für die Anmeldung in der Mitarbeiter-App.</p>
        <dl class="daten" style="font-size:16px;gap:10px 20px"><dt>Betriebskennung</dt><dd class="mono">${esc(c.cfg.kennung)}</dd><dt>Zugangscode</dt><dd class="mono" style="letter-spacing:.3em;font-size:22px">${esc(p.code)}</dd></dl>`,
      fuss: `<button class="k" data-f="neu">Neuen Code erzeugen</button><button class="k haupt" data-f="zu">Fertig</button>`,
      aktionen: { neu: () => {
        const liste = Store.cfg.personen.map((x) => (x.id === id ? { ...x, code: neuerCode(Store.cfg.personen) } : x));
        Store.speichereCfg({ ...Store.cfg, personen: liste }).then(() => zugangFenster(ctx(), id));
      } },
    });
  }

  /* ---------- Steuerbüro-Paket ---------- */
  function csv(zeilen) { return '﻿' + zeilen.map((z) => z.map((f) => { const s = String(f ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n'); }
  const dez = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  const eur2 = (n) => Number(n || 0).toFixed(2).replace('.', ',');
  const sauber = (s) => String(s || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9-]+/g, '');
  async function paketHerunterladen(c, knopf) {
    if (!window.JSZip) return meldung('Das ZIP-Werkzeug konnte nicht geladen werden (keine Internetverbindung?).', 'fehler');
    knopf.disabled = true; knopf.textContent = 'Paket wird erstellt …';
    try {
      const ym = zustand.monat; const inh = paketInhalt(c, ym); const zip = new JSZip();
      const nr = (pid) => String(c.personen.findIndex((p) => p.id === pid) + 1).padStart(3, '0');
      const ordner = `${c.cfg.kennung}_${ym}`;
      const z = zip.folder(ordner);
      if (inh.stdOk.length) {
        const zeilen = [['Personalnr', 'Name', 'Datum', 'Beginn', 'Ende', 'Pause Min', 'Stunden', 'Baustelle', 'Taetigkeit']];
        inh.stdOk.sort((a, b) => a.pid.localeCompare(b.pid) || a.datum.localeCompare(b.datum)).forEach((e) => zeilen.push([nr(e.pid), c.person(e.pid).name, Datum.kurz(e.datum) + e.datum.slice(0, 4), e.von, e.bis, e.pause, dez(stundenVon(e)), c.bsName(e.bs), e.taetigkeit]));
        z.file('Stunden_Einzeln.csv', csv(zeilen));
        const summen = [['Personalnr', 'Name', 'Stunden gesamt', 'Arbeitstage', 'Urlaubstage', 'Krankheitstage']];
        c.arbeiter().forEach((p) => {
          const eig = inh.stdOk.filter((e) => e.pid === p.id);
          const tageIm = (t) => c.typ(t).filter((x) => x.pid === p.id && x.status !== 'abgelehnt' && x.status !== 'beantragt').reduce((s, x) => { let n = 0; for (let d = x.von; d <= x.bis; d = Datum.plus(d, 1)) if (d.startsWith(ym) && Datum.istWerktag(d)) n++; return s + n; }, 0);
          summen.push([nr(p.id), p.name, dez(eig.reduce((s, e) => s + stundenVon(e), 0)), new Set(eig.map((e) => e.datum)).size, tageIm('urlaub'), tageIm('krank')]);
        });
        z.file('Stunden_Summen.csv', csv(summen));
      }
      if (inh.belOk.length) {
        const zeilen = [['Datum', 'Betrag', 'Kategorie', 'Geschaeft', 'Baustelle', 'Mitarbeiter', 'Datei']];
        for (const [i, b] of inh.belOk.entries()) {
          const name = `${b.datum}_${String(i + 1).padStart(2, '0')}_${sauber(b.kategorie || 'Beleg')}_${eur2(b.betrag)}EUR`;
          const url = await bildFuer(b); const datei = url ? await dateiInZip(z.folder('Belege'), name, url) : '';
          zeilen.push([Datum.kurz(b.datum) + b.datum.slice(0, 4), dez(b.betrag), b.kategorie, b.haendler, c.bsName(b.bs), c.person(b.pid).name, datei]);
        }
        z.file('Belege.csv', csv(zeilen));
      }
      if (inh.ls.length) {
        const zeilen = [['Datum', 'Lieferant', 'Nummer', 'Baustelle', 'Angenommen von', 'Datei']];
        for (const l of inh.ls) {
          const name = `${l.datum}_${sauber(l.lieferant)}_${sauber(l.nummer || l.id)}`;
          const url = await bildFuer(l); const datei = url ? await dateiInZip(z.folder('Lieferscheine'), name, url) : '';
          zeilen.push([Datum.kurz(l.datum) + l.datum.slice(0, 4), l.lieferant, l.nummer, c.bsName(l.bs), c.person(l.pid).name, datei]);
        }
        z.file('Lieferscheine.csv', csv(zeilen));
      }
      if (c.R.imExport('rechnungen')) Uebergabe.rechnungenInZip(c, z.folder('Rechnungen'), (r) => (r.datum || '').startsWith(ym));
      if (inh.tlOk.length) {
        const zeilen = [['Datum', 'Name', 'Stunden', 'Satz', 'Betrag', 'Baustelle', 'Bezahlt']];
        inh.tlOk.forEach((e) => zeilen.push([Datum.kurz(e.datum) + e.datum.slice(0, 4), c.tageloehner(e.tid).name, dez(e.stunden), dez(e.satz), dez(e.stunden * e.satz), c.bsName(e.bs), e.bezahlt ? 'bar' : 'offen']));
        z.file('Tagelohn.csv', csv(zeilen));
      }
      z.file('Uebersicht.txt', `${c.cfg.name}, ${c.cfg.ort}\nMonat: ${Datum.monatName(ym)}\nErstellt: ${new Date().toLocaleString('de-DE')} von ${c.ich.name}\n\nStunden: ${inh.stdOk.length} Einträge\nBelege: ${inh.belOk.length}\nLieferscheine: ${inh.ls.length}\nTagelohn: ${inh.tlOk.length}\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      await speichern(`${ordner}_Steuerbuero.zip`, blob);
    } catch (err) { console.error(err); meldung('Paket konnte nicht erstellt werden: ' + err.message, 'fehler'); }
    zeichne();
  }
  async function dateiInZip(ordner, name, url) {
    const [kopf, daten] = url.split(',');
    const endung = kopf.includes('svg') ? 'svg' : kopf.includes('pdf') ? 'pdf' : kopf.includes('png') ? 'png' : 'jpg';
    if (kopf.includes(';base64')) ordner.file(`${name}.${endung}`, daten, { base64: true });
    else ordner.file(`${name}.${endung}`, decodeURIComponent(daten));
    return `${name}.${endung}`;
  }

  function zeigeSeite(id) { zustand.seite = id; zustand.navOffen = false; zeichne(); window.scrollTo(0, 0); }
  return { start, neuZeichnen: zeichne, zeigeSeite, html, ROLLEN, erweitern, teile: { seitenkopf, leer } };
})();

/* Datei an den Nutzer geben (Artifact-Download, sonst normaler Link) */
async function speichern(dateiname, daten) {
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename: dateiname, data: daten }); meldung('Datei gespeichert'); return; }
  } catch (e) { if (e && e.code === 'dismissed') return; console.warn(e); }
  const blob = daten instanceof Blob ? daten : new Blob([daten], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = dateiname; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
