/* =========================================================================
   Betriebszentrale (Büro am Computer)
   Seiten werden als HTML-Text erzeugt (html(seite, kontext)), damit das
   Entwickler-Tool dieselben Seiten als Vorschau zeigen kann.
   ========================================================================= */
const Buero = (() => {
  const zustand = { seite: 'uebersicht', woche: Datum.montag(Datum.heute()), monat: Datum.heute().slice(0, 7), filter: {}, navOffen: false, wahl: null };
  const kompakt = () => (zustand.wahl ? zustand.wahl === 'kompakt' : window.innerWidth < 820);
  let warKompakt = null;
  window.addEventListener('resize', () => { if (aktiverBereich === Buero && kompakt() !== warKompakt) zeichne(); });

  const NAV = [
    { id: 'uebersicht', name: 'Übersicht', icon: 'start', gruppe: 'Betrieb' },
    { id: 'stunden', name: 'Stunden', icon: 'uhr', braucht: 'stunden', gruppe: 'Betrieb', zahl: (o) => o.stunden.length },
    { id: 'urlaub', name: 'Urlaub & Krank', icon: 'kalender', braucht: 'urlaub', gruppe: 'Betrieb', zahl: (o) => o.urlaub.length },
    { id: 'belege', name: 'Belege', icon: 'beleg', braucht: 'belege', gruppe: 'Unterlagen', zahl: (o) => o.belege.length },
    { id: 'lieferscheine', name: 'Lieferscheine', icon: 'liefer', braucht: 'lieferscheine', gruppe: 'Unterlagen', zahl: (o) => o.lieferscheine.length },
    { id: 'material', name: 'Materialbedarf', icon: 'material', braucht: 'material', gruppe: 'Unterlagen', zahl: (o) => o.material.length },
    { id: 'tagelohn', name: 'Tagelöhner', icon: 'helfer', braucht: 'tagelohn', gruppe: 'Unterlagen', zahl: (o) => o.tagelohn.length },
    { id: 'steuer', name: 'Steuerbüro', icon: 'paket', braucht: ['export', 'dokumente'], gruppe: 'Unterlagen' },
    { id: 'baustellen', name: 'Baustellen', icon: 'haus', braucht: 'baustellen', gruppe: 'Stammdaten' },
    { id: 'team', name: 'Team & Zugänge', icon: 'team', gruppe: 'Stammdaten' },
    { id: 'einstellungen', name: 'Einstellungen', icon: 'zahnrad', gruppe: 'Stammdaten', nurChef: true },
  ];
  const sichtbar = (n, c) => {
    if (n.nurChef && c.ich && c.ich.rolle !== 'chef') return false;
    if (!n.braucht) return true;
    return [].concat(n.braucht).some((t) => c.R.hat(t));
  };

  /* ---------- Helfer für Tabellen ---------- */
  const personZelle = (c, p, unter = '') => `<div class="person"><span class="ava">${esc(c.kuerzel(p.name))}</span><div>${esc(p.name)}${unter ? `<small>${esc(unter)}</small>` : ''}</div></div>`;
  const seitenkopf = (titel, unter, rechts = '') => `<div class="seitenkopf"><div><h1>${titel}</h1>${unter ? `<p>${unter}</p>` : ''}</div><div class="rechts">${rechts}</div></div>`;
  const leer = (text) => `<div class="leer">${text}</div>`;
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

  SEITEN.stunden = (c) => {
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
      `<span class="wochenwahl"><button class="k klein" data-a="woche" data-id="-7">${Icon('zurueck')}</button><b>${Datum.kurz(wo)} – ${Datum.kurz(tage[6])}${tage[6].slice(0, 4)}</b><button class="k klein" data-a="woche" data-id="7">${Icon('pfeil')}</button></span>
       <button class="k" data-a="woche" data-id="0">Diese Woche</button>
       <button class="k" data-a="stunden-neu">${Icon('plus')} Eintrag</button>
       ${c.R.freigabe('stunden') && c.R.darfFreigeben(c.ich && c.ich.rolle) ? `<button class="k haupt" data-a="woche-frei" ${offeneWoche.length ? '' : 'disabled'}>${Icon('haken')} Woche freigeben${offeneWoche.length ? ` (${offeneWoche.length})` : ''}</button>` : ''}`)
      + `<div class="karte"><div class="tabelle-huelle"><table class="t"><thead><tr><th>Mitarbeiter</th>${kopf}<th class="r">Summe</th><th class="r">± Soll</th><th>Status</th></tr></thead><tbody>${zeilen || `<tr><td colspan="10">${leer('Keine Mitarbeiter mit Wochenstunden.')}</td></tr>`}</tbody></table></div>
        <div class="legende"><span><i style="background:var(--warn)"></i>zu prüfen</span><span><i style="background:var(--info)"></i>gerade eingestempelt</span><span>BS = Berufsschule</span><span>Klick auf ein Feld: Tag ansehen und ändern</span></div></div>`;
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
    const text = offen.map((m) => `- ${m.text} (Baustelle: ${c.bsName(m.bs)})`).join('\n');
    const mail = `mailto:?subject=${encodeURIComponent('Bestellung ' + (c.cfg.name || ''))}&body=${encodeURIComponent(`Guten Tag,\n\nwir bestellen:\n${text}\n\nViele Grüße\n${c.ich ? c.ich.name : ''}\n${c.cfg.name}`)}`;
    const zeile = (m) => `<div class="liste-zeile"><div class="text"><b>${esc(m.text)}</b><small>${esc(c.bsName(m.bs))} · ${esc(c.person(m.pid).name)} · ${Datum.kurz(m.datum)}</small></div>${chip(m.status)}
      <div class="aktionen">${m.status === 'offen' ? `<button class="k klein" data-a="material" data-id="${m.id}" data-wert="bestellt">Bestellt</button>` : ''}${m.status !== 'erledigt' ? `<button class="k klein ok" data-a="material" data-id="${m.id}" data-wert="erledigt">${Icon('haken')} Erledigt</button>` : ''}</div></div>`;
    return seitenkopf('Materialbedarf', `Was auf den Baustellen fehlt · Bestellung bei ${esc(haendler)}`, offen.length ? `<a class="k haupt" href="${mail}" style="text-decoration:none">${Icon('download')} Bestellung als E-Mail</a>` : '')
      + `<div class="karte"><div class="kopf"><h3>Offen</h3><span class="chip ${offen.length ? 'warn' : ''}">${offen.length}</span></div>${offen.map(zeile).join('') || leer('Nichts offen.')}</div>
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
        return `<tr class="klickbar" data-a="baustelle" data-id="${b.id}"><td><b>${esc(b.name)}</b></td><td>${esc(b.ort)}</td><td>${esc(b.arbeit || '')}</td><td class="r num">${Zahl.std(std)}</td><td class="r num">${Zahl.eur(c.typ('beleg').filter((x) => x.bs === b.id).reduce((s, x) => s + Number(x.betrag || 0), 0))}</td><td class="r num">${c.typ('lieferschein').filter((x) => x.bs === b.id).length}</td><td>${b.status === 'fertig' ? '<span class="chip">Fertig</span>' : b.status === 'geplant' ? '<span class="chip info">Geplant</span>' : '<span class="chip ok">Laufend</span>'}</td></tr>`; }).join('') || `<tr><td colspan="7">${leer('Noch keine Baustellen.')}</td></tr>`}
      </tbody></table></div></div>`;
  };

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
    return seitenkopf('Einstellungen', 'Angaben zum Betrieb und Ihr Funktionsumfang')
      + `<div class="zwei"><div class="karte"><div class="kopf"><h3>Betrieb</h3></div><form class="koerper" id="f-einst">
        <div class="einstellungen-raster">
          <label class="feld"><span>Name</span><input name="name" value="${esc(c.cfg.name)}"></label>
          <label class="feld"><span>Kürzel (2 Buchstaben)</span><input name="kuerzel" maxlength="2" value="${esc(c.cfg.kuerzel)}"></label>
          <label class="feld"><span>Zusatz</span><input name="zusatz" value="${esc(c.cfg.zusatz)}"></label>
          <label class="feld"><span>Ort</span><input name="ort" value="${esc(c.cfg.ort)}"></label>
        </div>
        <div class="feld"><span>Firmenfarbe</span><div class="farbwahl">${FARBEN.map((f) => `<button type="button" style="background:${f}" class="${c.cfg.farbe === f ? 'an' : ''}" data-a="farbe" data-id="${f}" aria-label="Farbe ${f}"></button>`).join('')}</div></div>
        <button class="k haupt" type="submit">Speichern</button></form></div>
        <div class="karte"><div class="kopf"><h3>Ihr Funktionsumfang</h3><span class="chip info">Paket ${esc(c.cfg.paket || 'Start')}</span></div>
          ${aktiv.map((t) => `<div class="liste-zeile">${Icon(BAUSTEINE[t].icon)}<div class="text"><b>${esc(BAUSTEINE[t].name)}</b><small>${esc(BAUSTEINE[t].kurz)}</small></div><span class="chip ok">Aktiv</span></div>`).join('')}
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
      const z = n.zahl ? n.zahl(o) : 0;
      return `${kopf}<button class="${zustand.seite === n.id ? 'aktiv' : ''}" data-a="gehe" data-id="${n.id}">${Icon(n.icon)}${n.name}${z ? `<span class="zahl">${z}</span>` : ''}</button>`;
    }).join('');
    return `<div class="ui-buero ${kompakt() ? 'kompakt' : ''} ${zustand.navOffen ? 'nav-offen' : ''}" style="--firma:${esc(c.cfg.farbe)}">
      <header class="b-kopf">
        <button class="flach menueknopf" data-a="nav" aria-label="Menü">${Icon('menue')}</button>
        <span class="firmenzeichen">${esc(c.cfg.kuerzel || c.kuerzel(c.cfg.name))}</span>
        <div class="firma">${esc(c.cfg.name)}<small>Betriebszentrale</small></div>
        <span class="luecke"></span>
        <span class="segment nur-breit" title="Darstellung"><button class="${kompakt() ? '' : 'an'}" data-a="ansicht" data-id="breit">Computer</button><button class="${kompakt() ? 'an' : ''}" data-a="ansicht" data-id="kompakt">Handy</button></span>
        <div class="wer">${esc(c.ich.name)}<small>${esc(c.ich.funktion || ROLLEN[c.ich.rolle])}</small></div>
        <span class="rund">${esc(c.kuerzel(c.ich.name))}</span>
        <button class="flach" data-a="abmelden" title="Abmelden">${Icon('abmelden')}<span class="nur-breit">Abmelden</span></button>
      </header>
      <nav class="b-nav">${nav}<div class="unten">${kompakt() ? `<button data-a="ansicht" data-id="breit">${Icon('start')}Computer-Ansicht</button>` : `<button data-a="ansicht" data-id="kompakt">${Icon('person')}Handy-Ansicht</button>`}<a href="#" style="color:inherit">Bereich wechseln</a></div></nav>
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
    zeichne();
  }
  function zeichne() {
    if (aktiverBereich !== Buero) return;
    const c = ctx();
    if (!c.cfg) { Wurzel().innerHTML = `<div class="laden"><div>Betrieb wird geladen<div class="balken"><i></i></div></div></div>`; return; }
    if (!c.ich || !['chef', 'buero'].includes(c.ich.rolle)) { Sitzung.setze('buero', null); return bueroAnmeldung('Ihr Zugang wurde geändert. Bitte neu anmelden.'); }
    const scroll = window.scrollY;
    const aktivesFeld = document.activeElement && document.activeElement.closest && document.activeElement.closest('#b-inhalt form');
    if (aktivesFeld) return; // nicht beim Tippen neu zeichnen
    warKompakt = kompakt();
    Wurzel().innerHTML = rahmen(c);
    bilderNachladen(Wurzel(), c.items);
    ablageVorbereiten(c);
    window.scrollTo(0, scroll);
  }

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
  });
  document.addEventListener('submit', (e) => {
    if (aktiverBereich !== Buero || e.target.id !== 'f-einst') return;
    e.preventDefault();
    const w = Object.fromEntries(new FormData(e.target));
    Store.speichereCfg({ ...Store.cfg, name: w.name.trim() || Store.cfg.name, kuerzel: w.kuerzel.trim().toUpperCase(), zusatz: w.zusatz, ort: w.ort });
    document.activeElement.blur(); meldung('Gespeichert');
    setTimeout(zeichne, 50);
  });

  const AKTION = {
    gehe(el) { zustand.seite = el.dataset.id; zustand.navOffen = false; zeichne(); window.scrollTo(0, 0); },
    nav() { zustand.navOffen = !zustand.navOffen; zeichne(); },
    ansicht(el) { zustand.wahl = el.dataset.id; zustand.navOffen = false; zeichne(); },
    abmelden() { Sitzung.setze('buero', null); aktiverBereich = null; bueroAnmeldung(); },
    woche(el) { const d = Number(el.dataset.id); zustand.woche = d ? Datum.plus(zustand.woche, d) : Datum.montag(Datum.heute()); zeichne(); },
    monat(el) { const [j, m] = zustand.monat.split('-').map(Number); const d = new Date(j, m - 1 + Number(el.dataset.id), 1); zustand.monat = Datum.iso(d).slice(0, 7); zeichne(); },
    filter(el) { zustand.filter[el.dataset.feld] = el.dataset.id; zeichne(); },
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
        <dl class="daten"><dt>Datum</dt><dd>${esc(Datum.lang(e.datum))}</dd><dt>Von</dt><dd>${esc(c.person(e.pid).name)}</dd><dt>Status</dt><dd>${chip(e.status)}</dd>${e.positionen ? `<dt>Positionen</dt><dd>${e.positionen.map(esc).join('<br>')}</dd>` : ''}</dl>
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
      inhalt: `<label class="feld"><span>Name</span><input name="name" value="${esc(b.name)}" placeholder="z. B. Neubau EFH Müller"></label><label class="feld"><span>Ort</span><input name="ort" value="${esc(b.ort)}"></label><label class="feld"><span>Arbeiten</span><input name="arbeit" value="${esc(b.arbeit || '')}"></label>
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

  return { start, neuZeichnen: zeichne, html, ROLLEN };
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
