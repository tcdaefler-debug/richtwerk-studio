/* =========================================================================
   Baukasten: Welche Bausteine es gibt und was eine Verbindung bewirkt.
   Ein Betrieb speichert seinen Aufbau als Graph:
     cfg.baukasten = { knoten: [{id, typ, x, y, p:{...}}], kanten: [{von, zu}] }
   "von" und "zu" sind Bausteintypen (jeder Typ kommt höchstens einmal vor).
   ========================================================================= */
const BAUSTEINE = {
  app: {
    name: 'Mitarbeiter-App', gruppe: 'quelle', icon: 'person',
    kurz: 'Jeder Mitarbeiter meldet sich mit seinem Code am Handy an.',
    wofuer: 'Zettelwirtschaft im Bulli: Stunden, Belege und Lieferscheine kommen direkt vom Handy ins Büro.',
    ein: [], p: {},
  },
  baustellen: {
    name: 'Baustellen', gruppe: 'stamm', icon: 'haus',
    kurz: 'Liste der laufenden Baustellen. Verbunden: Einträge bekommen eine Baustelle.',
    wofuer: 'Am Monatsende weiß keiner mehr, welcher Beleg zu welchem Kunden gehört.',
    ein: [], p: {},
  },
  stempeln: {
    name: 'Stempeluhr', gruppe: 'erfassen', icon: 'uhr',
    kurz: 'Arbeitsbeginn und Feierabend mit einem Knopf. Erzeugt Stundeneinträge.',
    wofuer: 'Stunden werden freitags aus dem Gedächtnis aufgeschrieben und stimmen selten.',
    ein: ['app'],
    p: {
      rundung: { typ: 'zahl', name: 'Auf Minuten runden', wert: 15, min: 1, max: 30, einheit: 'Min.' },
      pause6: { typ: 'zahl', name: 'Pause ab 6 Std.', wert: 30, min: 0, max: 60, einheit: 'Min.' },
      pause9: { typ: 'zahl', name: 'Pause ab 9 Std.', wert: 45, min: 0, max: 90, einheit: 'Min.' },
    },
  },
  stunden: {
    name: 'Stundenzettel', gruppe: 'erfassen', icon: 'kalender',
    kurz: 'Arbeitszeit pro Tag mit Baustelle und Tätigkeit, auch nachträglich.',
    wofuer: 'Die Stundenzettel für den Lohn werden jeden Monat abgetippt.',
    ein: ['app', 'stempeln', 'baustellen'],
    p: {
      soll: { typ: 'zahl', name: 'Sollstunden pro Woche', wert: 40, min: 10, max: 50, einheit: 'Std.' },
      nachtrag: { typ: 'zahl', name: 'Nachtragen bis zurück', wert: 7, min: 0, max: 31, einheit: 'Tage' },
      maxTag: { typ: 'zahl', name: 'Warnung ab', wert: 10, min: 6, max: 12, einheit: 'Std./Tag' },
    },
  },
  urlaub: {
    name: 'Urlaub & Krank', gruppe: 'erfassen', icon: 'krank',
    kurz: 'Urlaub beantragen, krank melden, Resturlaub sehen.',
    wofuer: 'Urlaub wird mündlich abgesprochen und dann vergessen; keiner kennt seinen Resturlaub.',
    ein: ['app'],
    p: {
      tage: { typ: 'zahl', name: 'Urlaubstage pro Jahr', wert: 30, min: 20, max: 36, einheit: 'Tage' },
      vorlauf: { typ: 'zahl', name: 'Vorlauf für Anträge', wert: 3, min: 0, max: 60, einheit: 'Tage' },
      krank: { typ: 'wahl', name: 'Krankmeldung per App', wert: 'ja', optionen: ['ja', 'nein'] },
    },
  },
  belege: {
    name: 'Belege', gruppe: 'erfassen', icon: 'beleg',
    kurz: 'Tankquittung oder Baumarkt-Bon fotografieren statt sammeln.',
    wofuer: 'Kassenbons verbleichen im Handschuhfach und fehlen beim Steuerberater.',
    ein: ['app', 'baustellen'],
    p: {
      kategorien: { typ: 'text', name: 'Kategorien', wert: 'Tanken, Material, Werkzeug, Verpflegung, Sonstiges' },
      grenze: { typ: 'zahl', name: 'Chef prüft ab', wert: 100, min: 0, max: 2000, einheit: '€' },
    },
  },
  lieferscheine: {
    name: 'Lieferscheine', gruppe: 'erfassen', icon: 'liefer',
    kurz: 'Lieferschein auf der Baustelle abfotografieren, landet beim Auftrag.',
    wofuer: 'Lieferscheine gehen verloren, Rechnungen vom Händler lassen sich nicht prüfen.',
    ein: ['app', 'baustellen'],
    p: { lieferanten: { typ: 'text', name: 'Lieferanten', wert: 'Holzhandel Ritter, Baustoffe Nord, Würth, Sonstiger' } },
  },
  material: {
    name: 'Materialbedarf', gruppe: 'erfassen', icon: 'material',
    kurz: 'Geselle meldet, was fehlt. Der Chef sieht es gesammelt.',
    wofuer: 'Material wird per Anruf beim Chef bestellt, der gerade auf dem Dach steht.',
    ein: ['app', 'baustellen'],
    p: { haendler: { typ: 'text', name: 'Bestellen bei', wert: 'Holzhandel Ritter' } },
  },
  tagelohn: {
    name: 'Tagelöhner', gruppe: 'erfassen', icon: 'helfer',
    kurz: 'Aushilfen mit Stunden und Satz erfassen, Quittung erzeugen.',
    wofuer: 'Aushilfen werden bar bezahlt, am Jahresende fehlt der Nachweis.',
    ein: ['baustellen'],
    p: {
      satz: { typ: 'zahl', name: 'Stundensatz', wert: 16, min: 13.9, max: 40, einheit: '€/Std.' },
      grenzeTage: { typ: 'zahl', name: 'Warnung ab', wert: 60, min: 10, max: 70, einheit: 'Tage/Jahr' },
    },
  },
  freigabe: {
    name: 'Freigabe Chef', gruppe: 'pruefen', icon: 'haken',
    kurz: 'Was hier hineinläuft, muss erst freigegeben werden.',
    wofuer: 'Der Chef will sehen, was abgerechnet wird, bevor es zum Steuerbüro geht.',
    ein: ['stunden', 'urlaub', 'belege', 'tagelohn', 'material'],
    p: { wer: { typ: 'wahl', name: 'Wer darf freigeben', wert: 'Chef und Büro', optionen: ['Chef', 'Chef und Büro'] } },
  },
  export: {
    name: 'Steuerberater-Paket', gruppe: 'ausgeben', icon: 'paket',
    kurz: 'Monatspaket als ZIP: Stunden, Belege, Lieferscheine, Tagelohn.',
    wofuer: 'Der Pendelordner zum Steuerbüro kostet jeden Monat einen halben Tag.',
    ein: ['stunden', 'belege', 'lieferscheine', 'tagelohn', 'freigabe', 'rechnungen'],
    p: {
      empfaenger: { typ: 'text', name: 'Steuerbüro', wert: 'Steuerbüro Janssen & Partner' },
      stichtag: { typ: 'zahl', name: 'Abgabe bis Folgemonat', wert: 5, min: 1, max: 28, einheit: 'Tag' },
      format: { typ: 'wahl', name: 'Format Stunden', wert: 'DATEV (CSV)', optionen: ['DATEV (CSV)', 'Excel (CSV)'] },
    },
  },
  dokumente: {
    name: 'Lohnzettel & Dokumente', gruppe: 'ausgeben', icon: 'dokument',
    kurz: 'Büro lädt Lohnabrechnungen hoch, jeder sieht nur seine eigenen.',
    wofuer: 'Lohnzettel werden ausgedruckt und im Bauwagen verteilt.',
    ein: ['app'],
    p: {},
  },

  bautagebuch: {
    name: 'Bautagebuch', gruppe: 'erfassen', icon: 'stift',
    kurz: 'Fotos und Notizen pro Tag und Baustelle, mit Wetter.',
    wofuer: 'Bei Mängelstreit oder Nachträgen fehlt der Nachweis, wer wann was gemacht hat.',
    ein: ['app', 'baustellen'],
    p: { fotos: { typ: 'zahl', name: 'Fotos pro Eintrag', wert: 3, min: 1, max: 4, einheit: 'Stück' } },
  },
  regie: {
    name: 'Regiezettel', gruppe: 'erfassen', icon: 'unterschrift',
    kurz: 'Zusatzarbeiten vor Ort aufschreiben, der Kunde unterschreibt auf dem Handy.',
    wofuer: 'Beim Dachöffnen kommt morsches Holz zum Vorschein. Ohne Unterschrift wird die Mehrarbeit nie bezahlt.',
    ein: ['app', 'baustellen'],
    p: {
      satz: { typ: 'zahl', name: 'Stundensatz Regie', wert: 58, min: 30, max: 120, einheit: '€/Std.' },
      ohneUnterschrift: { typ: 'wahl', name: 'Ohne Unterschrift speichern', wert: 'ja', optionen: ['ja', 'nein'] },
    },
  },
  wochenplan: {
    name: 'Wochenplan', gruppe: 'stamm', icon: 'plan',
    kurz: 'Wer ist nächste Woche auf welcher Baustelle. Steht danach in der App.',
    wofuer: 'Der Plan steht nur im Kopf vom Chef; Sonntagabend wird reihum telefoniert.',
    ein: ['baustellen'],
    p: { tage: { typ: 'wahl', name: 'Planen für', wert: 'Mo bis Fr', optionen: ['Mo bis Fr', 'Mo bis Sa'] } },
  },

  angebote: {
    name: 'Angebote', gruppe: 'auftrag', icon: 'angebot',
    kurz: 'Angebote mit Positionen, Katalog und AGB. Angenommen wird es zum Auftrag mit Baustelle.',
    wofuer: 'Angebote entstehen abends in Word, Preise werden jedes Mal neu gesucht, angenommene Aufträge landen auf einem Zettel.',
    ein: ['baustellen'],
    p: {
      praefix: { typ: 'text', name: 'Nummer beginnt mit', wert: 'A' },
      gueltig: { typ: 'zahl', name: 'Gültig für', wert: 30, min: 7, max: 90, einheit: 'Tage' },
      mwst: { typ: 'zahl', name: 'Mehrwertsteuer', wert: 19, min: 0, max: 19, einheit: '%' },
      baustelleAnlegen: { typ: 'schalter', name: 'Angenommen: Baustelle anlegen', wert: 'ja' },
      bestaetigung: { typ: 'schalter', name: 'Auftragsbestätigung drucken', wert: 'ja' },
      agbAnhang: { typ: 'schalter', name: 'AGB als Anlage', wert: 'ja' },
      onlineAnnahme: { typ: 'schalter', name: 'Kunde nimmt online an (Link)', wert: 'ja' },
      unterschriftOnline: { typ: 'schalter', name: 'Online: Unterschrift verlangen', wert: 'ja' },
      fragen: { typ: 'schalter', name: 'Online: Kunde kann Fragen stellen', wert: 'ja' },
      widerruf: { typ: 'wahl', name: 'Widerruf bei Privatkunden', wert: 'Belehrung mit Arbeitsbeginn', optionen: ['Belehrung mit Arbeitsbeginn', 'Ausschluss Maßanfertigung', 'nicht anzeigen'] },
      einleitung: { typ: 'langtext', name: 'Text vor den Positionen', wert: 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Anfrage. Gern bieten wir Ihnen folgende Arbeiten an:' },
      schluss: { typ: 'langtext', name: 'Text nach den Positionen', wert: 'Wir freuen uns auf Ihren Auftrag. Bei Fragen erreichen Sie uns jederzeit telefonisch.' },
      katalog: { typ: 'langtext', name: 'Leistungskatalog (Text | Einheit | Preis)', wert: 'Abbund Dachstuhl nach Plan | m² | 38,50\nAufstellen und Richten Dachstuhl | m² | 24,00\nKVH C24 liefern, gehobelt | m³ | 620,00\nAufsparrendämmung 160 mm inkl. Unterdeckbahn | m² | 89,00\nSparren austauschen bis 5 m | Stk | 185,00\nZimmerer-Facharbeiter | Std | 58,00\nBaustelleneinrichtung | psch | 450,00' },
      widerrufText: { typ: 'langtext', name: 'Widerrufsbelehrung', wert: 'Widerrufsrecht\nSie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.\nUm Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung vor Ablauf der Frist absenden.\nFolgen des Widerrufs\nWenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen zurückzuzahlen. Haben Sie verlangt, dass die Arbeiten während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zum Widerruf bereits erbrachten Leistungen entspricht.' },
      datenschutz: { typ: 'langtext', name: 'Datenschutzhinweis', wert: 'Wir verarbeiten Ihren Namen, Ihre Anschrift und Ihre Kontaktdaten nur, um das Angebot zu erstellen und den Auftrag auszuführen (Art. 6 Abs. 1 lit. b DSGVO). Rechnungsdaten bewahren wir so lange auf, wie es das Steuerrecht verlangt. Eine Weitergabe an Dritte erfolgt nur, soweit es für den Auftrag nötig ist (z. B. an das Steuerbüro). Sie haben das Recht auf Auskunft, Berichtigung und Löschung. Fragen dazu richten Sie bitte an die im Angebot genannte Anschrift.' },
      agb: { typ: 'langtext', name: 'AGB', wert: '1. Geltung: Für alle Aufträge gelten diese Bedingungen sowie die VOB Teil B in der bei Vertragsschluss gültigen Fassung, soweit nichts anderes vereinbart ist.\n2. Preise: Alle Preise sind Festpreise für die angebotenen Mengen. Abgerechnet wird nach tatsächlichem Aufmaß.\n3. Zusatzarbeiten: Arbeiten, die nicht im Angebot enthalten sind, werden nach Aufwand (Regiebericht) zu den vereinbarten Stundensätzen berechnet.\n4. Zahlung: Rechnungen sind innerhalb der angegebenen Frist ohne Abzug zu zahlen. Bei Aufträgen über 5.000 € können Abschläge nach Baufortschritt verlangt werden.\n5. Eigentum: Gelieferte Materialien bleiben bis zur vollständigen Bezahlung unser Eigentum.\n6. Gewährleistung: Es gelten die gesetzlichen Fristen.' },
    },
  },
  rechnungen: {
    name: 'Rechnungen', gruppe: 'auftrag', icon: 'rechnung',
    kurz: 'Rechnung aus Angebot und Regiezetteln, mit fortlaufender Nummer und E-Rechnung.',
    wofuer: 'Rechnungen werden Wochen nach der Fertigstellung geschrieben, Regiearbeiten vergessen, offene Posten fallen keinem auf.',
    ein: ['angebote', 'regie', 'baustellen'],
    p: {
      praefix: { typ: 'text', name: 'Nummer beginnt mit', wert: 'R' },
      ziel: { typ: 'zahl', name: 'Zahlungsziel', wert: 14, min: 0, max: 60, einheit: 'Tage' },
      mahnung: { typ: 'zahl', name: 'Erinnerung nach', wert: 7, min: 1, max: 30, einheit: 'Tage über Ziel' },
      erechnung: { typ: 'wahl', name: 'E-Rechnung', wert: 'XRechnung (XML)', optionen: ['XRechnung (XML)', 'aus'] },
      lohnanteil: { typ: 'schalter', name: 'Arbeitskosten nach § 35a ausweisen', wert: 'ja' },
      schluss: { typ: 'langtext', name: 'Text nach den Positionen', wert: 'Vielen Dank für Ihren Auftrag. Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.' },
    },
  },

  tafel: {
    name: 'Auftragstafel', gruppe: 'auftrag', icon: 'plan',
    kurz: 'Jeder Auftrag eine Karte: Anfrage, Angebot, Auftrag, Baustelle, Rechnung, Bezahlt.',
    wofuer: 'Anfragen stehen auf Zetteln am Kühlschrank, keiner weiß, welches Angebot noch offen ist und welche Baustelle schon abgerechnet wurde.',
    ein: ['angebote', 'rechnungen', 'baustellen'],
    p: {
      spalten: { typ: 'text', name: 'Spalten (sechs, mit Komma)', wert: 'Anfrage, Angebot, Auftrag, Auf der Baustelle, Rechnung, Bezahlt' },
      bezahltTage: { typ: 'zahl', name: 'Bezahlte Karten zeigen', wert: 30, min: 7, max: 365, einheit: 'Tage' },
    },
  },

  /* ---- In Planung: im Entwickler-Tool sichtbar, beim Kunden noch nicht ---- */
  wetter: { name: 'Schlechtwetter', gruppe: 'geplant', icon: 'glocke', kurz: 'Ausfalltage für Saison-Kurzarbeitergeld markieren.', wofuer: 'Schlechtwetterstunden müssen für die Agentur sauber belegt werden.', ein: [], p: {} },
  geraete: { name: 'Geräte & Fahrzeuge', gruppe: 'geplant', icon: 'liefer', kurz: 'Wo steht der Kran, wann ist der TÜV fällig.', wofuer: 'Werkzeug bleibt auf der alten Baustelle liegen, Prüffristen laufen ab.', ein: [], p: {} },
  aufmass: { name: 'Aufmaß', gruppe: 'geplant', icon: 'stift', kurz: 'Maße vor Ort ins Handy, ab ins Angebot.', wofuer: 'Aufmaß auf dem Zettel wird abends nochmal abgetippt.', ein: [], p: {} },
};

/* Was im Inneren eines Bausteins passiert (im Entwickler-Tool unter „Ablauf“).
   schalter = Parameter, der diesen Schritt ein- oder ausschaltet. */
const ABLAEUFE = {
  angebote: [
    { name: 'Angebot schreiben', text: 'Positionen von Hand oder aus dem Leistungskatalog, Texte davor und danach' },
    { name: 'Senden und nachfassen', text: 'Nach 10 Tagen ohne Antwort steht es in der Übersicht unter „Zu erledigen“' },
    { name: 'Online annehmen', text: 'Der Kunde öffnet einen Link, liest Angebot und AGB, setzt die Haken und nimmt verbindlich an', schalter: 'onlineAnnahme' },
    { name: 'Unterschrift', text: 'Mit Finger oder Maus unter der Annahme', schalter: 'unterschriftOnline' },
    { name: 'Frage zum Angebot', text: 'Statt anzunehmen kann der Kunde eine Frage schicken. Sie steht im Büro unter „Zu erledigen“', schalter: 'fragen' },
    { name: 'Angenommen', text: 'Wird zum Auftrag' },
    { name: 'Baustelle anlegen', text: 'Mit Kunde, Anschrift und Betreff', schalter: 'baustelleAnlegen' },
    { name: 'Auftragsbestätigung', text: 'Druckbar mit denselben Positionen', schalter: 'bestaetigung' },
    { name: 'AGB als Anlage', text: 'Zweite Seite des Angebots', schalter: 'agbAnhang' },
  ],
  rechnungen: [
    { name: 'Entwurf', text: 'Aus dem Angebot übernommen oder neu, Regiezettel der Baustelle dazu' },
    { name: 'Stellen', text: 'Fortlaufende Nummer, Datum, Fälligkeit. Danach nicht mehr änderbar' },
    { name: 'Arbeitskosten ausweisen', text: 'Für Privatkunden (§ 35a EStG)', schalter: 'lohnanteil' },
    { name: 'Überfällig', text: 'Hinweis in der Übersicht, Zahlungserinnerung druckbar' },
    { name: 'Bezahlt', text: 'Zahlungseingang abhaken' },
  ],
  tafel: [
    { name: 'Anfrage', text: 'Neue Karte mit Kunde, Telefon und Besichtigungstermin' },
    { name: 'Angebot', text: 'Aus der Karte wird mit einem Klick das Angebot' },
    { name: 'Auftrag', text: 'Rückt von selbst weiter, wenn das Angebot angenommen ist (auch online)' },
    { name: 'Auf der Baustelle', text: 'Sobald jemand auf die Baustelle stempelt' },
    { name: 'Rechnung und Bezahlt', text: 'Folgt der Rechnung, bezahlte Karten verschwinden nach einiger Zeit' },
  ],
  regie: [
    { name: 'Aufschreiben', text: 'Arbeit, Leute, Stunden, Material auf dem Handy' },
    { name: 'Unterschrift', text: 'Der Kunde unterschreibt mit dem Finger' },
    { name: 'Später unterschreiben', text: 'Wenn der Kunde nicht da ist', schalter: 'ohneUnterschrift' },
    { name: 'Abrechnen', text: 'In die Rechnung übernehmen oder von Hand abhaken' },
  ],
};
/* In diese Bausteine kann Richtwerk eigene Felder einbauen */
const MIT_FELDERN = ['belege', 'lieferscheine', 'material', 'bautagebuch', 'regie', 'angebote', 'rechnungen'];

const GRUPPEN = {
  quelle: { name: 'Start', farbe: '#6f94ff' },
  stamm: { name: 'Stammdaten', farbe: '#8b95a3' },
  erfassen: { name: 'Erfassen', farbe: '#3fb37f' },
  pruefen: { name: 'Prüfen', farbe: '#e5a530' },
  ausgeben: { name: 'Ausgeben', farbe: '#ff6b3d' },
  auftrag: { name: 'Aufträge', farbe: '#b58cff' },
  geplant: { name: 'In Planung', farbe: '#5a6270' },
};

/* Regeln, die sich aus dem Aufbau eines Betriebs ergeben */
function regeln(cfg) {
  const bk = (cfg && cfg.baukasten) || { knoten: [], kanten: [] };
  const typen = new Set(bk.knoten.filter((k) => BAUSTEINE[k.typ] && BAUSTEINE[k.typ].gruppe !== 'geplant').map((k) => k.typ));
  const hat = (t) => typen.has(t);
  const verb = (a, b) => hat(a) && hat(b) && bk.kanten.some((k) => k.von === a && k.zu === b);
  const p = (t) => {
    const def = (BAUSTEINE[t] && BAUSTEINE[t].p) || {};
    const knoten = bk.knoten.find((k) => k.typ === t);
    const out = {};
    for (const [k, d] of Object.entries(def)) out[k] = knoten && knoten.p && knoten.p[k] !== undefined ? knoten.p[k] : d.wert;
    return out;
  };
  const liste = (t, k) => String(p(t)[k] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    hat, verb, p, liste,
    imApp: (t) => hat('app') && verb('app', t),
    mitBaustelle: (t) => verb('baustellen', t),
    freigabe: (t) => verb(t, 'freigabe'),
    imExport: (t) => verb(t, 'export') || (verb(t, 'freigabe') && verb('freigabe', 'export')),
    stempeln: () => hat('app') && verb('app', 'stempeln') && verb('stempeln', 'stunden'),
    stundenImApp: () => hat('app') && (verb('app', 'stunden') || verb('stempeln', 'stunden') && verb('app', 'stempeln')),
    plan: () => verb('baustellen', 'wochenplan'),
    name: (t) => { const k = bk.knoten.find((x) => x.typ === t); return (k && k.name) || (BAUSTEINE[t] ? BAUSTEINE[t].name : t); },
    hinweis: (t) => { const k = bk.knoten.find((x) => x.typ === t); return (k && k.hinweis) || ''; },
    felder: (t) => { const k = bk.knoten.find((x) => x.typ === t); return (k && k.felder) || []; },
    an: (t, k) => p(t)[k] === 'ja',
    darfFreigeben: (rolle) => rolle === 'chef' || (rolle === 'buero' && p('freigabe').wer === 'Chef und Büro'),
  };
}

/* Klartext: Was bewirkt der Aufbau? (für das Entwickler-Tool) */
function wirkungen(cfg, typ) {
  const R = regeln(cfg); const B = BAUSTEINE[typ]; const out = [];
  if (!B) return out;
  if (B.gruppe === 'geplant') return ['Noch in Entwicklung. Beim Kunden nicht sichtbar.'];
  const imBuero = { bautagebuch: 'Baustellen', regie: 'Baustellen', wochenplan: 'Wochenplan', stunden: 'Stunden', urlaub: 'Urlaub', belege: 'Belege', lieferscheine: 'Lieferscheine', tagelohn: 'Tagelöhner', export: 'Steuerberater', baustellen: 'Baustellen', material: 'Material', dokumente: 'Steuerberater' }[typ];
  if (imBuero) out.push(`Im Büro als Bereich „${imBuero}“ sichtbar.`);
  if (['stempeln', 'stunden', 'urlaub', 'belege', 'lieferscheine', 'material', 'dokumente', 'bautagebuch', 'regie'].includes(typ)) {
    if (typ === 'stunden') out.push(R.stundenImApp() ? 'Mitarbeiter sehen und erfassen Stunden in der App.' : 'Nicht mit der App verbunden: Stunden nur im Büro.');
    else out.push(R.imApp(typ) ? 'In der Mitarbeiter-App sichtbar.' : 'Nicht mit der App verbunden: Mitarbeiter sehen das nicht.');
  }
  if (typ === 'stempeln') out.push(R.verb('stempeln', 'stunden') ? 'Jedes Stempeln wird ein Stundeneintrag.' : 'Nicht mit dem Stundenzettel verbunden: Stempeln ist ausgeschaltet.');
  if (R.mitBaustelle(typ)) out.push('Mitarbeiter wählen eine Baustelle aus.');
  if (R.freigabe(typ)) out.push(typ === 'belege' ? `Belege ab ${Zahl.eur(R.p('belege').grenze)} muss ${R.p('freigabe').wer === 'Chef' ? 'der Chef' : 'Chef oder Büro'} freigeben.` : `Muss erst von ${R.p('freigabe').wer === 'Chef' ? 'dem Chef' : 'Chef oder Büro'} freigegeben werden.`);
  else if (['stunden', 'urlaub', 'belege', 'tagelohn', 'material'].includes(typ)) out.push(typ === 'material' ? 'Ohne Freigabe: geht direkt auf die Bestell-Liste.' : 'Ohne Freigabe: gilt sofort als erledigt.');
  if (['stunden', 'belege', 'lieferscheine', 'tagelohn'].includes(typ)) out.push(R.imExport(typ) ? `Kommt ins Monatspaket für ${R.p('export').empfaenger}.` : 'Geht nicht ans Steuerbüro.');
  if (typ === 'export') {
    const drin = ['stunden', 'belege', 'lieferscheine', 'tagelohn'].filter(R.imExport).map((t) => BAUSTEINE[t].name);
    out.push(drin.length ? 'Im Paket: ' + drin.join(', ') + '.' : 'Noch nichts angeschlossen.');
    if (R.verb('freigabe', 'export')) out.push('Über die Freigabe kommen nur freigegebene Einträge ins Paket.');
  }
  if (typ === 'freigabe') {
    const rein = B.ein.filter((t) => R.verb(t, 'freigabe')).map((t) => BAUSTEINE[t].name);
    out.push(rein.length ? 'Prüft: ' + rein.join(', ') + '.' : 'Noch nichts angeschlossen.');
  }
  if (typ === 'regie') out.push(R.p('regie').ohneUnterschrift === 'ja' ? 'Ist der Kunde nicht da, kann der Zettel ohne Unterschrift gespeichert werden.' : 'Speichern nur mit Unterschrift des Kunden.');
  if (typ === 'wochenplan') out.push(R.hat('app') ? 'Mitarbeiter sehen ihren Plan in der App; beim Einstempeln steht die geplante Baustelle oben.' : 'Ohne App nur im Büro sichtbar.');
  if (typ === 'wochenplan' && !R.verb('baustellen', 'wochenplan')) out.push('Mit „Baustellen“ verbinden, sonst gibt es nichts zu verplanen.');
  if (typ === 'angebote') {
    out.push('Im Büro als Bereich „Angebote“ sichtbar.');
    out.push(R.an('angebote', 'baustelleAnlegen') ? 'Wird ein Angebot angenommen, entsteht die Baustelle automatisch.' : 'Angenommene Angebote legen keine Baustelle an.');
    out.push(R.verb('angebote', 'rechnungen') ? 'Aus jedem Angebot wird mit einem Klick die Rechnung.' : 'Mit „Rechnungen“ verbinden, damit aus dem Angebot die Rechnung wird.');
  }
  if (typ === 'angebote') {
    out.push(R.an('angebote', 'onlineAnnahme') ? `Der Kunde bekommt einen Link, nimmt online an${R.an('angebote', 'unterschriftOnline') ? ' und unterschreibt' : ''}. Das Büro sieht es sofort.` : 'Angebote werden nur gedruckt oder als PDF verschickt.');
  }
  if (typ === 'tafel') {
    out.push('Im Büro als Bereich „Auftragstafel“ mit Karten zum Verschieben.');
    out.push(R.hat('angebote') ? 'Karten sind mit Angebot, Baustellenakte und Rechnung verknüpft.' : 'Ohne „Angebote“ bleiben die Karten reine Notizen.');
  }
  if (typ === 'rechnungen') {
    out.push('Im Büro als Bereich „Rechnungen“ sichtbar, mit offenen Posten und Erinnerung.');
    if (R.verb('regie', 'rechnungen')) out.push('Unterschriebene Regiezettel der Baustelle werden zur Übernahme angeboten.');
    out.push(R.p('rechnungen').erechnung === 'aus' ? 'Keine E-Rechnung.' : 'Zu jeder Rechnung gibt es die E-Rechnung als XRechnung-Datei.');
    out.push(R.verb('rechnungen', 'export') ? `Ausgangsrechnungen kommen ins Monatspaket für ${R.p('export').empfaenger}.` : 'Geht nicht ans Steuerbüro.');
  }
  const k = ((cfg && cfg.baukasten && cfg.baukasten.knoten) || []).find((x) => x.typ === typ) || {};
  if (k.name) out.push(`Heißt beim Kunden „${k.name}“.`);
  if ((k.felder || []).length) out.push(`${k.felder.length} eigene ${k.felder.length === 1 ? 'Feld' : 'Felder'}: ${k.felder.map((f) => f.name).join(', ')}.`);
  if (typ === 'tagelohn' && R.p('tagelohn').satz < 13.9) out.push('Achtung: unter dem Mindestlohn von 13,90 €.');
  return out;
}

/* Standard-Aufbau für einen neuen, leeren Betrieb */
function leererBaukasten() {
  return { knoten: [{ id: 'k_app', typ: 'app', x: 60, y: 220, p: {} }], kanten: [] };
}
