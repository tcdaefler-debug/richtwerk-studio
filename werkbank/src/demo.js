/* =========================================================================
   Musterdaten
   - "ahlers": kleine Zimmerei, Meister + Büro (Teilzeit) + 3 Gesellen,
     1 Azubi, 1 Bauhelfer. Daten liegen immer um das heutige Datum herum.
   - "leer":   leerer Betrieb, nur Inhaber und der Start-Baustein.
   Kennung + Zugangscode stehen im Tutorial, nicht auf dem Bildschirm.
   ========================================================================= */
const ENTWICKLER = { kennung: 'richtwerk', code: '2611' };

const Muster = (() => {
  function ahlersCfg() {
    const knoten = (typ, x, y, p = {}) => ({ id: 'k_' + typ, typ, x, y, p });
    return {
      id: 'ahlers',
      kennung: 'ahlers',
      name: 'Zimmerei Ahlers',
      zusatz: 'Holzbau · Dachstühle · Carports',
      ort: 'Ganderkesee',
      farbe: '#2f5e4e',
      kuerzel: 'ZA',
      paket: 'Start',
      personen: [
        { id: 'p1', name: 'Jan Ahlers', rolle: 'chef', funktion: 'Zimmermeister, Inhaber', code: '1001', soll: 0, urlaub: 30 },
        { id: 'p2', name: 'Anke Ahlers', rolle: 'buero', funktion: 'Büro (Teilzeit)', code: '1002', soll: 0, urlaub: 30 },
        { id: 'p3', name: 'Henning Meyer', rolle: 'geselle', funktion: 'Geselle, Vorarbeiter', code: '2001', soll: 40, urlaub: 30 },
        { id: 'p4', name: 'Lukas Bruns', rolle: 'geselle', funktion: 'Geselle', code: '2002', soll: 40, urlaub: 30 },
        { id: 'p5', name: 'Dennis Kramer', rolle: 'geselle', funktion: 'Geselle', code: '2003', soll: 40, urlaub: 30 },
        { id: 'p6', name: 'Finn Schröder', rolle: 'azubi', funktion: 'Azubi, 2. Lehrjahr', code: '2004', soll: 40, urlaub: 30 },
        { id: 'p7', name: 'Marek Nowak', rolle: 'helfer', funktion: 'Bauhelfer', code: '2005', soll: 40, urlaub: 28 },
      ],
      baustellen: [
        { id: 'b1', name: 'Neubau EFH Hinrichs', ort: 'Hude', arbeit: 'Dachstuhl abbinden und richten', status: 'laufend' },
        { id: 'b2', name: 'Carport Gerdes', ort: 'Ganderkesee', arbeit: 'Doppelcarport mit Abstellraum', status: 'laufend' },
        { id: 'b3', name: 'Dachsanierung Wilkens', ort: 'Wardenburg', arbeit: 'Sparren verstärken, Aufsparrendämmung', status: 'laufend' },
        { id: 'b4', name: 'Gaube Steenken', ort: 'Delmenhorst', arbeit: 'Schleppgaube', status: 'geplant' },
        { id: 'b0', name: 'Halle / Abbund', ort: 'Ganderkesee', arbeit: 'Werkstatt, Abbund, Lager', status: 'laufend' },
      ],
      tageloehner: [
        { id: 't1', name: 'Kevin Lange', notiz: 'Aushilfe, Student', satz: 16 },
        { id: 't2', name: 'Paul Wiechmann', notiz: 'Rentner, Zimmerer i. R.', satz: 18 },
      ],
      baukasten: {
        knoten: [
          knoten('app', 40, 300),
          knoten('baustellen', 40, 560),
          knoten('stempeln', 330, 20),
          knoten('urlaub', 330, 200),
          knoten('belege', 330, 290),
          knoten('lieferscheine', 330, 380),
          knoten('material', 330, 470),
          knoten('tagelohn', 330, 560),
          knoten('dokumente', 330, 650),
          knoten('stunden', 610, 60),
          knoten('freigabe', 890, 230),
          knoten('export', 1170, 400),
        ],
        kanten: [
          ['app', 'stempeln'], ['stempeln', 'stunden'], ['app', 'stunden'], ['app', 'urlaub'], ['app', 'belege'],
          ['app', 'lieferscheine'], ['app', 'material'], ['app', 'dokumente'],
          ['baustellen', 'stunden'], ['baustellen', 'belege'], ['baustellen', 'lieferscheine'], ['baustellen', 'material'], ['baustellen', 'tagelohn'],
          ['stunden', 'freigabe'], ['urlaub', 'freigabe'], ['belege', 'freigabe'],
          ['freigabe', 'export'], ['lieferscheine', 'export'], ['tagelohn', 'export'],
        ].map(([von, zu]) => ({ von, zu })),
      },
      notizen: '',
      angelegt: Date.now(),
    };
  }

  function ahlersItems(heute = Datum.heute()) {
    const items = [];
    const add = (id, e) => items.push({ id, erstellt: Date.now(), ...e });
    const jahr = Number(heute.slice(0, 4));
    const montag = Datum.montag(heute);
    const start = Datum.plus(montag, -14);
    const arbeiter = ['p3', 'p4', 'p5', 'p6', 'p7'];
    // Wer an welcher Baustelle arbeitet (pro Woche wechselnd)
    const plan = [
      { p3: 'b3', p4: 'b3', p5: 'b2', p6: 'b2', p7: 'b3' },
      { p3: 'b1', p4: 'b0', p5: 'b2', p6: 'b0', p7: 'b1' },
      { p3: 'b1', p4: 'b1', p5: 'b2', p6: 'b2', p7: 'b1' },
    ];
    const taetigkeit = { b0: 'Abbund Dachstuhl Hinrichs', b1: 'Dachstuhl richten', b2: 'Carport aufstellen', b3: 'Sparren verstärken, Dämmung' };
    const krankMarek = Datum.plus(montag, -7 + 2); // Mi + Do letzte Woche
    for (let d = start; d < heute; d = Datum.plus(d, 1)) {
      const wt = Datum.wochentag(d);
      if (wt > 4 || Datum.feiertag(d)) continue;
      const woche = Math.floor((Datum.von(d) - Datum.von(start)) / 864e5 / 7);
      const aktuelleWoche = d >= montag;
      for (const p of arbeiter) {
        if (p === 'p7' && (d === krankMarek || d === Datum.plus(krankMarek, 1))) continue;
        let bs = plan[woche][p]; let von = '07:00'; let bis = wt === 4 ? '13:00' : '16:15'; let pause = wt === 4 ? 15 : 45; let txt = taetigkeit[bs];
        if (p === 'p6' && wt === 1) { bs = ''; von = '07:45'; bis = '15:15'; pause = 30; txt = 'Berufsschule'; }
        if (p === 'p3' && wt === 2) bis = '17:00';
        if (p === 'p5' && wt === 0 && woche === 1) { von = '06:30'; }
        add(`s_${d}_${p}`, { typ: 'stunden', pid: p, datum: d, von, bis, pause, bs, taetigkeit: txt, quelle: 'stempeln', status: aktuelleWoche ? 'offen' : 'freigegeben' });
      }
    }
    // Heute: wer schon eingestempelt ist
    if (Datum.istWerktag(heute)) {
      const heuteBs = plan[2];
      // Beginn 07:00; außerhalb der Arbeitszeit (Vorführung am Abend) zwei Stunden vor jetzt
      const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
      const beginn = jetzt >= 8 * 60 && jetzt <= 17 * 60 ? 7 * 60 : Math.max(0, Math.floor((jetzt - 120) / 15) * 15);
      for (const p of ['p3', 'p4', 'p5', 'p7']) add(`s_${heute}_${p}`, { typ: 'stunden', pid: p, datum: heute, von: Zahl.hhmm(p === 'p5' ? beginn + 15 : beginn), bis: '', pause: 0, bs: heuteBs[p], taetigkeit: '', quelle: 'stempeln', status: 'laeuft' });
    }
    // Urlaub und Krank
    add('u_marek_krank', { typ: 'krank', pid: 'p7', von: krankMarek, bis: Datum.plus(krankMarek, 1), notiz: 'Erkältung', status: 'gemeldet', au: true });
    add('u_sommer_p3', { typ: 'urlaub', pid: 'p3', von: `${jahr}-07-20`, bis: `${jahr}-08-07`, art: 'Urlaub', status: 'genehmigt' });
    add('u_sommer_p4', { typ: 'urlaub', pid: 'p4', von: `${jahr}-08-10`, bis: `${jahr}-08-21`, art: 'Urlaub', status: 'genehmigt' });
    add('u_sommer_p5', { typ: 'urlaub', pid: 'p5', von: `${jahr}-06-01`, bis: `${jahr}-06-12`, art: 'Urlaub', status: 'genehmigt' });
    add('u_sommer_p6', { typ: 'urlaub', pid: 'p6', von: `${jahr}-07-27`, bis: `${jahr}-08-14`, art: 'Urlaub', status: 'genehmigt' });
    add('u_sommer_p7', { typ: 'urlaub', pid: 'p7', von: `${jahr}-08-03`, bis: `${jahr}-08-14`, art: 'Urlaub', status: 'genehmigt' });
    const weihnachten = heute < `${jahr}-12-14` ? [`${jahr}-12-22`, `${jahr + 1}-01-02`] : [Datum.plus(heute, 20), Datum.plus(heute, 31)];
    add('u_antrag_p5', { typ: 'urlaub', pid: 'p5', von: weihnachten[0], bis: weihnachten[1], art: 'Urlaub', notiz: 'Weihnachten bei der Familie', status: 'beantragt' });
    add('u_antrag_p4', { typ: 'urlaub', pid: 'p4', von: Datum.plus(montag, 11), bis: Datum.plus(montag, 11), art: 'Überstundenabbau', notiz: 'Umzug', status: 'beantragt' });
    // Belege
    const b = (id, tage, pid, kategorie, haendler, betrag, bs, status, notiz) => {
      const datum = Datum.plus(heute, -tage); const e = { typ: 'beleg', pid, datum, kategorie, haendler, betrag, bs, status, notiz };
      e.datei = 'muster'; add(id, e);
    };
    b('be1', 12, 'p3', 'Tanken', 'Tankstelle Hude', 78.4, 'b1', 'freigegeben', 'Bulli HB-ZA 410');
    b('be2', 9, 'p5', 'Material', 'Baumarkt Delmenhorst', 23.95, 'b2', 'freigegeben', 'Schlossschrauben M12');
    b('be3', 6, 'p4', 'Werkzeug', 'Würth Niederlassung', 146.2, 'b0', 'offen', 'Sägeblätter Handkreissäge');
    b('be4', 3, 'p3', 'Verpflegung', 'Bäckerei Hude', 18.5, 'b1', 'freigegeben', 'Richtfest Brötchen');
    b('be5', 1, 'p5', 'Tanken', 'Tankstelle Ganderkesee', 92.1, 'b2', 'offen', 'Pritsche HB-ZA 77');
    b('be6', 0, 'p7', 'Material', 'Baumarkt Delmenhorst', 12.49, 'b1', 'neu', 'Abdeckplane');
    // Lieferscheine
    const l = (id, tage, pid, lieferant, nummer, bs, status, positionen) => add(id, { typ: 'lieferschein', pid, datum: Datum.plus(heute, -tage), lieferant, nummer, bs, status, positionen, datei: 'muster', notiz: '' });
    l('ls1', 10, 'p3', 'Holzhandel Ritter', 'LS-204471', 'b1', 'geprueft', ['KVH 80x200 C24, 38 Stk', 'BSH 120x240 GL24h, 4 Stk', 'Dachlatten 30/50, 20 Bd']);
    l('ls2', 8, 'p5', 'Baustoffe Nord', '8812-33', 'b2', 'geprueft', ['Pfostenträger U 100, 6 Stk', 'Trapezblech 0,63 mm, 14 Tafeln']);
    l('ls3', 2, 'p3', 'Holzhandel Ritter', 'LS-204915', 'b1', 'neu', ['Konterlatten 40/60, 12 Bd', 'Unterdeckbahn 1,5 x 50 m, 3 Rollen']);
    l('ls4', 0, 'p4', 'Würth', '4471-0098', 'b3', 'neu', ['Vollgewindeschrauben 8x300, 2 Pak', 'Holzbauwinkel 105, 40 Stk']);
    // Tagelöhner
    add('tl1', { typ: 'tagelohn', tid: 't1', datum: Datum.plus(montag, -6), stunden: 7.5, satz: 16, bs: 'b1', taetigkeit: 'Richten Dachstuhl, Material reichen', status: 'freigegeben', bezahlt: true });
    add('tl2', { typ: 'tagelohn', tid: 't2', datum: Datum.plus(montag, -5), stunden: 6, satz: 18, bs: 'b1', taetigkeit: 'Richten Dachstuhl', status: 'freigegeben', bezahlt: true });
    add('tl3', { typ: 'tagelohn', tid: 't1', datum: Datum.plus(montag, 0) < heute ? Datum.plus(montag, 0) : Datum.plus(montag, -3), stunden: 8, satz: 16, bs: 'b3', taetigkeit: 'Entsorgung Altdämmung', status: 'offen', bezahlt: false });
    // Material
    add('m1', { typ: 'material', pid: 'p3', datum: Datum.plus(heute, -1), bs: 'b1', text: 'Dachlatten 30/50 nochmal 10 Bund, Nagelplatten', status: 'offen' });
    add('m2', { typ: 'material', pid: 'p5', datum: Datum.plus(heute, -4), bs: 'b2', text: 'Kopfbänder 2 Stk nachschneiden lassen', status: 'erledigt' });
    // Lohnzettel Vormonat
    const vm = Datum.plus(heute.slice(0, 8) + '01', -1).slice(0, 7);
    for (const p of arbeiter) add(`d_lohn_${p}`, { typ: 'dokument', fuer: p, titel: `Lohnabrechnung ${Datum.monatName(vm)}`, monat: vm, datei: 'muster', name: `Lohnabrechnung_${vm}.pdf`, gelesen: p === 'p3', datum: Datum.plus(heute, -12) });
    return items;
  }

  function leerCfg() {
    return {
      id: 'leer', kennung: 'neu', name: 'Neuer Betrieb', zusatz: 'Hier wird ein Betrieb von Grund auf eingerichtet', ort: '', farbe: '#3a4a63', kuerzel: 'NB', paket: 'Start',
      personen: [{ id: 'p1', name: 'Inhaber', rolle: 'chef', funktion: 'Inhaber', code: '1001', soll: 0, urlaub: 30 }],
      baustellen: [], tageloehner: [], baukasten: leererBaukasten(), notizen: '', angelegt: Date.now(),
    };
  }

  const LISTE = [
    { id: 'ahlers', kennung: 'ahlers', name: 'Zimmerei Ahlers', art: 'muster' },
    { id: 'leer', kennung: 'neu', name: 'Neuer Betrieb', art: 'leer' },
  ];

  async function einrichten(fortschritt) {
    await Store.ersetzeBetrieb('ahlers', ahlersCfg(), ahlersItems(), fortschritt);
    await Store.ersetzeBetrieb('leer', leerCfg(), [], fortschritt);
    await Store.setzeBetriebe(LISTE);
  }

  async function zuruecksetzen(fid, fortschritt) {
    if (fid === 'ahlers') return Store.ersetzeBetrieb('ahlers', ahlersCfg(), ahlersItems(), fortschritt);
    if (fid === 'leer') return Store.ersetzeBetrieb('leer', leerCfg(), [], fortschritt);
    return 0;
  }

  return { einrichten, zuruecksetzen, ahlersCfg, leerCfg, LISTE };
})();
