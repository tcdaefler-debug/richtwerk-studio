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
      version: 5,
      kalkulation: { faktor: 2.1, aufschlag: 20, lohn: { p3: 23.5, p4: 21.5, p5: 21, p6: 6.5, p7: 17 } },
      kennung: 'ahlers',
      name: 'Zimmerei Ahlers',
      zusatz: 'Holzbau · Dachstühle · Carports',
      ort: 'Ganderkesee',
      inhaber: 'Jan Ahlers',
      strasse: 'Gewerbestraße 9',
      plz: '27777',
      telefon: '04222 70 41 90',
      email: 'info@zimmerei-ahlers.example',
      steuernr: '64/123/45678',
      ustid: 'DE299999999',
      bank: 'Volksbank Ganderkesee',
      iban: 'DE89 3704 0044 0532 0130 00',
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
        { id: 'b1', name: 'Neubau EFH Hinrichs', ort: 'Hude', adresse: 'Am Moorweg 14, 27798 Hude', kunde: 'Familie Hinrichs', telefon: '04408 91 27 40', arbeit: 'Dachstuhl abbinden und richten', status: 'laufend', notiz: 'Bauleitung: Architekturbüro Wempe. Kran am Do bis 12 Uhr bestellt.' },
        { id: 'b2', name: 'Carport Gerdes', ort: 'Ganderkesee', adresse: 'Lindenstraße 3, 27777 Ganderkesee', kunde: 'Holger Gerdes', telefon: '0171 448 20 19', arbeit: 'Doppelcarport mit Abstellraum', status: 'laufend', notiz: 'Schlüssel für Abstellraum beim Nachbarn (Nr. 5).' },
        { id: 'b3', name: 'Dachsanierung Wilkens', ort: 'Wardenburg', adresse: 'Hauptstraße 52, 26203 Wardenburg', kunde: 'Renate Wilkens', telefon: '04407 55 81', arbeit: 'Sparren verstärken, Aufsparrendämmung', status: 'laufend', notiz: 'Kundin ist vormittags da. Hund im Garten.' },
        { id: 'b4', name: 'Gaube Steenken', ort: 'Delmenhorst', adresse: 'Stedinger Straße 120, 27753 Delmenhorst', kunde: 'Jörg Steenken', telefon: '0152 029 33 71', arbeit: 'Schleppgaube', status: 'geplant', notiz: '' },
        { id: 'b0', name: 'Halle / Abbund', ort: 'Ganderkesee', adresse: 'Gewerbestraße 9, 27777 Ganderkesee', kunde: '', telefon: '', arbeit: 'Werkstatt, Abbund, Lager', status: 'laufend', notiz: '' },
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
          knoten('bautagebuch', 330, 740),
          knoten('regie', 330, 830),
          knoten('wochenplan', 330, 920),
          knoten('angebote', 890, 640),
          knoten('rechnungen', 1170, 760),
          knoten('tafel', 1170, 580),
          knoten('rechner', 610, 1010),
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
          ['app', 'bautagebuch'], ['app', 'regie'], ['baustellen', 'bautagebuch'], ['baustellen', 'regie'], ['baustellen', 'wochenplan'],
          ['baustellen', 'angebote'], ['angebote', 'rechnungen'], ['regie', 'rechnungen'], ['rechnungen', 'export'], ['angebote', 'tafel'], ['rechnungen', 'tafel'], ['app', 'rechner'],
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
    // Bautagebuch
    const tb = (id, tage, pid, bs, wetter, text, fotos) => { const datum = Datum.plus(heute, -tage); if (Datum.istWerktag(datum)) add(id, { typ: 'tagebuch', pid, datum, bs, wetter, text, fotos }); };
    tb('tb1', 15, 'p3', 'b3', 'bewölkt', 'Dach abgedeckt. Zwei Sparren am Ortgang morsch (Fotos), Kundin informiert. Rest in Ordnung.', ['muster-sparren', 'muster-dach']);
    tb('tb2', 13, 'p3', 'b3', 'Regen', 'Ab 11 Uhr Regen, Dach mit Plane gesichert. Nachmittags in der Halle.', ['muster-plane']);
    tb('tb3', 8, 'p3', 'b1', 'sonnig', 'Schwelle und Wände ausgerichtet, Abbund angeliefert.', ['muster-dach']);
    tb('tb4', 2, 'p3', 'b1', 'sonnig', 'Dachstuhl gerichtet, Richtfest mit Bauherren um 15 Uhr.', ['muster-dach', 'muster-richtfest']);
    // Regiezettel (Zusatzarbeiten mit Unterschrift)
    add('rg1', { typ: 'regie', pid: 'p3', datum: Datum.plus(heute, -15), bs: 'b3', text: 'Zwei Sparren am Ortgang ausgetauscht (morsch), inkl. Entsorgung', leute: 2, stunden: 6, material: 'KVH 80x180, 2 x 5,0 m', kunde: 'Renate Wilkens', unterschrift: 'muster-unterschrift', status: 'unterschrieben' });
    add('rg2', { typ: 'regie', pid: 'p5', datum: Datum.plus(heute, -3), bs: 'b2', text: 'Fundamente für Abstellraum nachträglich tiefer gesetzt (Wurzeln)', leute: 2, stunden: 3.5, material: '', kunde: 'Holger Gerdes', unterschrift: 'muster-unterschrift', status: 'unterschrieben' });
    add('rg3', { typ: 'regie', pid: 'p3', datum: Datum.plus(heute, -1), bs: 'b1', text: 'Zusätzliches Gaubenwechsel nach Planänderung Architekt', leute: 3, stunden: 4, material: 'BSH 120x240, 1 Stk', kunde: '', unterschrift: '', status: 'offen' });
    // Wochenplan diese und nächste Woche
    const planWoche = (mo, belegung) => {
      const zellen = {};
      for (const [pid, bs] of Object.entries(belegung)) zellen[pid] = Object.fromEntries([0, 1, 2, 3, 4].map((t) => [t, pid === 'p6' && t === 1 ? 'S' : bs]));
      add('plan_' + mo, { typ: 'plan', montag: mo, zellen });
    };
    planWoche(montag, plan[2]);
    planWoche(Datum.plus(montag, 7), { p3: 'b1', p4: 'b3', p5: 'b2', p6: 'b3', p7: 'b1' });
    // Angebote und Rechnungen
    const j = heute.slice(0, 4);
    const pos = (text, menge, einheit, preis) => ({ text, menge, einheit, preis });
    add('an1', { typ: 'angebot', nr: `A-${j}-014`, datum: Datum.plus(heute, -40), gueltigBis: Datum.plus(heute, -10), kunde: 'Holger Gerdes', kundenart: 'privat', adresse: 'Lindenstraße 3\n27777 Ganderkesee', betreff: 'Doppelcarport mit Abstellraum', status: 'angenommen', entschieden: Date.now() - 30 * 864e5, bs: 'b2', mwst: 19,
      positionen: [pos('Baustelleneinrichtung', 1, 'psch', 450), pos('Doppelcarport 6,0 x 6,0 m, KVH C24, Flachdach mit Trapezblech, inkl. Abbund', 1, 'psch', 8900), pos('Abstellraum 2,0 x 6,0 m, Lärchenschalung', 12, 'm²', 165), pos('Pfostenträger setzen, Punktfundamente', 6, 'Stk', 95), pos('Zimmerer-Facharbeiter für Montage', 32, 'Std', 58)] });
    add('an2', { typ: 'angebot', nr: `A-${j}-017`, datum: Datum.plus(heute, -21), gueltigBis: Datum.plus(heute, 9), kunde: 'Jörg Steenken', kundenart: 'privat', adresse: 'Stedinger Straße 120\n27753 Delmenhorst', betreff: 'Schleppgaube Dachgeschoss', status: 'angenommen', entschieden: Date.now() - 6 * 864e5, bs: 'b4', mwst: 19, schluessel: 'k7Q2m9xTe4Lw', gesehen: Date.now() - 5 * 864e5,
      angenommenOnline: { name: 'Jörg Steenken', wann: Date.now() - 6 * 864e5 - 3 * 36e5, unterschrift: 'muster-unterschrift', agb: true, widerruf: 'belehrung', beginnVorFrist: true, datenschutz: true },
      positionen: [pos('Dachöffnung herstellen, Sparren auswechseln', 1, 'psch', 1850), pos('Schleppgaube 3,2 m breit abbinden und aufstellen', 1, 'psch', 6400), pos('Aufsparrendämmung 160 mm inkl. Unterdeckbahn', 14, 'm²', 89), pos('Zimmerer-Facharbeiter', 24, 'Std', 58)] });
    add('an3', { typ: 'angebot', nr: `A-${j}-019`, datum: Datum.plus(heute, -12), gueltigBis: Datum.plus(heute, 18), kunde: 'Bäckerei Logemann GmbH', kundenart: 'gewerblich', adresse: 'Bremer Straße 41\n27777 Ganderkesee', email: 'buchhaltung@logemann.example', betreff: 'Vordach Lieferzone', status: 'gesendet', mwst: 19, schluessel: 'p3Vn8sRc1Hy6',
      fragen: [{ text: 'Ist die Rinne inklusive Fallrohr bis zum Kanalanschluss? Und könnten Sie in den Herbstferien anfangen, dann ist bei uns weniger Lieferverkehr. (Rückruf: 04222 81 33 0)', wann: Date.now() - 20 * 36e5 }],
      positionen: [pos('Vordach 8,0 x 2,5 m, BSH GL24h, sichtbar gehobelt', 1, 'psch', 5200), pos('Dacheindeckung Trapezblech mit Rinne', 20, 'm²', 74), pos('Montage mit Hubsteiger', 16, 'Std', 58)] });
    add('an4', { typ: 'angebot', nr: `A-${j}-020`, datum: Datum.plus(heute, -2), gueltigBis: Datum.plus(heute, 28), kunde: 'Familie Brinkmann', kundenart: 'privat', adresse: 'Am Sportplatz 7\n27798 Hude', betreff: 'Terrassenüberdachung', status: 'entwurf', mwst: 19,
      positionen: [pos('Terrassenüberdachung 5,0 x 3,5 m, Douglasie, Stegplatten', 1, 'psch', 6800), pos('Zimmerer-Facharbeiter', 16, 'Std', 58)] });
    add('re1', { typ: 'rechnung', nr: `R-${j}-031`, datum: Datum.plus(heute, -26), faellig: Datum.plus(heute, -12), bezahltAm: Datum.plus(heute, -14), kunde: 'Renate Wilkens', kundenart: 'privat', adresse: 'Hauptstraße 52\n26203 Wardenburg', betreff: 'Abschlag Dachsanierung', leistung: 'Abschlag nach Baufortschritt', status: 'bezahlt', mwst: 19,
      positionen: [pos('1. Abschlag Dachsanierung lt. Angebot A-' + j + '-009, 40 %', 1, 'psch', 9200)] });
    add('re2', { typ: 'rechnung', nr: `R-${j}-033`, datum: Datum.plus(heute, -29), faellig: Datum.plus(heute, -15), kunde: 'Hausverwaltung Nordlicht GmbH', kundenart: 'gewerblich', adresse: 'Lange Straße 12\n27749 Delmenhorst', email: 'rechnung@nordlicht.example', betreff: 'Reparatur Dachstuhl nach Sturmschaden', leistung: `${Datum.kurz(Datum.plus(heute, -36))}${j} bis ${Datum.kurz(Datum.plus(heute, -33))}${j}`, status: 'gestellt', mwst: 19,
      positionen: [pos('Sparren austauschen bis 5 m', 3, 'Stk', 185), pos('KVH C24 liefern, gehobelt', 0.4, 'm³', 620), pos('Zimmerer-Facharbeiter', 14, 'Std', 58), pos('Entsorgung Altholz', 1, 'psch', 120)] });
    add('re3', { typ: 'rechnung', status: 'entwurf', kunde: 'Holger Gerdes', kundenart: 'privat', adresse: 'Lindenstraße 3\n27777 Ganderkesee', betreff: 'Doppelcarport mit Abstellraum', bs: 'b2', angebot: 'an1', angebotNr: `A-${j}-014`, mwst: 19, leistung: '',
      positionen: [pos('Baustelleneinrichtung', 1, 'psch', 450), pos('Doppelcarport 6,0 x 6,0 m, KVH C24, Flachdach mit Trapezblech, inkl. Abbund', 1, 'psch', 8900), pos('Abstellraum 2,0 x 6,0 m, Lärchenschalung', 12, 'm²', 165), pos('Pfostenträger setzen, Punktfundamente', 6, 'Stk', 95), pos('Zimmerer-Facharbeiter für Montage', 32, 'Std', 58)] });
    // Eingesprochen: Bestellung vom Vorarbeiter, Erinnerung vom Chef
    add('m3', { typ: 'material', pid: 'p3', datum: heute, bs: 'b1', text: '6 Pal. Dachsteine, 1 Pal. Gratziegel, 3 Rollen Firstrolle', positionen: [{ menge: 6, einheit: 'Pal.', text: 'Dachsteine' }, { menge: 1, einheit: 'Pal.', text: 'Gratziegel' }, { menge: 3, einheit: 'Rollen', text: 'Firstrolle' }], lieferant: 'Dachdecker-Einkauf', quelle: 'sprache', status: 'offen' });
    add('er1', { typ: 'erinnerung', pid: 'p1', datum: Datum.plus(heute, -1), text: 'Gerdes wegen Rinne und Fallrohr anrufen', faellig: heute, quelle: 'sprache' });
    add('er2', { typ: 'erinnerung', pid: 'p1', datum: heute, text: 'Kran für die Gaube Steenken anfragen', faellig: Datum.plus(heute, 1), quelle: 'sprache' });
    add('er3', { typ: 'erinnerung', pid: 'p3', datum: heute, text: 'Akku-Schrauber zum Service bringen', faellig: Datum.plus(heute, 1), quelle: 'sprache' });
    // Auftragstafel: zwei frische Anfragen
    add('vg1', { typ: 'vorgang', spalte: 'anfrage', datum: Datum.plus(heute, -2), kunde: 'Familie Thölken', telefon: '04222 93 17 52', titel: 'Zwei Dachfenster tauschen', adresse: 'Birkenweg 11\n27777 Ganderkesee', termin: Datum.plus(heute, 3), notiz: 'Empfehlung von Gerdes' });
    add('vg2', { typ: 'vorgang', spalte: 'anfrage', datum: Datum.plus(heute, -1), kunde: 'Autohaus Meyer', telefon: '04221 45 60 0', titel: 'Hallendach, Sturmschaden an der Traufe', adresse: 'Oldenburger Straße 88\n27753 Delmenhorst', notiz: 'Versicherung ist informiert, braucht Angebot für Gutachter' });
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
