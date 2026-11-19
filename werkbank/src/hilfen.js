/* =========================================================================
   Kleine Hilfsfunktionen: HTML, Datum, Zahlen, Bilder
   ========================================================================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, wurzel = document) => wurzel.querySelector(sel);
const $$ = (sel, wurzel = document) => [...wurzel.querySelectorAll(sel)];

const Datum = {
  heute() { return Datum.iso(new Date()); },
  iso(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; },
  von(iso) { const [j, m, t] = iso.split('-').map(Number); return new Date(j, m - 1, t, 12); },
  plus(iso, tage) { const d = Datum.von(iso); d.setDate(d.getDate() + tage); return Datum.iso(d); },
  montag(iso) { const d = Datum.von(iso); const wt = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wt); return Datum.iso(d); },
  wochentag(iso) { return (Datum.von(iso).getDay() + 6) % 7; }, // 0 = Montag
  istWerktag(iso) { return Datum.wochentag(iso) < 5; },
  kw(iso) {
    const d = Datum.von(iso); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  },
  kurz(iso) { const d = Datum.von(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; },
  lang(iso) { return Datum.von(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); },
  mittel(iso) { return Datum.von(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }); },
  monatName(ym) { const [j, m] = ym.split('-').map(Number); return new Date(j, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }); },
  WT: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  /* Gesetzliche Feiertage Niedersachsen */
  feiertag(iso) {
    const j = Number(iso.slice(0, 4));
    if (!Datum._ft || Datum._ft.jahr !== j) {
      const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
      const ostern = Datum.iso(new Date(j, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1, 12));
      const t = { [`${j}-01-01`]: 'Neujahr', [`${j}-05-01`]: 'Tag der Arbeit', [`${j}-10-03`]: 'Tag der Deutschen Einheit', [`${j}-10-31`]: 'Reformationstag', [`${j}-12-25`]: '1. Weihnachtstag', [`${j}-12-26`]: '2. Weihnachtstag' };
      t[Datum.plus(ostern, -2)] = 'Karfreitag'; t[Datum.plus(ostern, 1)] = 'Ostermontag'; t[Datum.plus(ostern, 39)] = 'Christi Himmelfahrt'; t[Datum.plus(ostern, 50)] = 'Pfingstmontag';
      Datum._ft = { jahr: j, t };
    }
    return Datum._ft.t[iso] || null;
  },
  istArbeitstag(iso) { return Datum.istWerktag(iso) && !Datum.feiertag(iso); },
  werktageZwischen(von, bis) {
    let n = 0; for (let d = von; d <= bis; d = Datum.plus(d, 1)) if (Datum.istArbeitstag(d)) n++;
    return n;
  },
  uhr(ms) { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
};

const Zahl = {
  std(h) { return (Math.round(h * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  eur(b) { return Number(b || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }); },
  tage(n, wort = 'Tag') { return `${n} ${wort}${n === 1 ? '' : 'e'}`; },
  min(hhmm) { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); },
  hhmm(min) { const m = Math.max(0, Math.round(min)); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; },
};

/* Stunden eines Eintrags (ohne Pause) */
function stundenVon(e) {
  if (!e.von || !e.bis) return 0;
  return Math.max(0, (Zahl.min(e.bis) - Zahl.min(e.von) - (Number(e.pause) || 0)) / 60);
}

/* Foto verkleinern, optional als "Scan" (Graustufen + Kontrast) */
function bildVerkleinern(datei, { maxKante = 1100, scan = false, qualitaet = 0.62 } = {}) {
  return new Promise((ok, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(new Error('Datei konnte nicht gelesen werden.'));
    leser.onload = () => {
      const img = new Image();
      img.onerror = () => fehler(new Error('Das ist kein Bild.'));
      img.onload = () => {
        const f = Math.min(1, maxKante / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, c.width, c.height);
        if (scan) {
          const px = g.getImageData(0, 0, c.width, c.height); const d = px.data;
          for (let i = 0; i < d.length; i += 4) {
            let y = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            y = Math.max(0, Math.min(255, (y - 128) * 1.45 + 150));
            d[i] = d[i + 1] = d[i + 2] = y;
          }
          g.putImageData(px, 0, 0);
        }
        let q = qualitaet; let url = c.toDataURL('image/jpeg', q);
        while (url.length > 230000 && q > 0.3) { q -= 0.08; url = c.toDataURL('image/jpeg', q); }
        if (url.length > 230000) { // noch kleiner rechnen
          const c2 = document.createElement('canvas'); c2.width = c.width * 0.7; c2.height = c.height * 0.7;
          c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height); url = c2.toDataURL('image/jpeg', 0.5);
        }
        ok(url);
      };
      img.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

function dateiAlsDataUrl(datei) {
  return new Promise((ok, fehler) => { const l = new FileReader(); l.onload = () => ok(l.result); l.onerror = fehler; l.readAsDataURL(datei); });
}

/* Platzhalter-Foto für Musterdaten: gezeichneter Beleg / Lieferschein als SVG */
function musterBild(art, e) {
  const zeilen = art === 'lieferschein'
    ? [`LIEFERSCHEIN ${esc(e.nummer || '')}`, esc(e.lieferant || ''), '', ...(e.positionen || ['KVH 60x120 C24', 'Schrauben 6x120', 'Folie']).map(esc)]
    : [esc(e.haendler || e.kategorie || 'Beleg'), Datum.kurz(e.datum || Datum.heute()) + (e.datum ? e.datum.slice(0, 4) : ''), '', esc(e.notiz || ''), '', 'SUMME  ' + Zahl.eur(e.betrag)];
  const txt = zeilen.map((z, i) => `<text x="28" y="${58 + i * 26}" font-size="${i === 0 ? 19 : 15}" font-weight="${i === 0 ? 700 : 400}">${z}</text>`).join('');
  const striche = Array.from({ length: 6 }, (_, i) => `<rect x="28" y="${250 + i * 18}" width="${150 + ((i * 47) % 120)}" height="6" fill="#c9ccc6"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 460"><rect width="340" height="460" fill="#dcd8cf"/><g transform="rotate(-2 170 230)"><rect x="12" y="14" width="316" height="430" fill="#fbfaf6" stroke="#cfcac0"/><g font-family="Courier New,monospace" fill="#2a2a2a">${txt}</g>${striche}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* Kurzmeldung unten am Bildschirm */
function meldung(text, art = 'ok') {
  let box = $('#meldung');
  if (!box) { box = document.createElement('div'); box.id = 'meldung'; document.body.appendChild(box); }
  box.className = 'meldung ' + art; box.textContent = text; box.hidden = false;
  clearTimeout(meldung.t); meldung.t = setTimeout(() => { box.hidden = true; }, 3200);
}

/* Kleine Linien-Symbole (24er Raster) */
const Icon = (name) => {
  const p = {
    start: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    uhr: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    kalender: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    beleg: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    liefer: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
    team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2.4.6 4 2.4 4 5.2',
    paket: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    haus: 'M4 20V10l8-6 8 6v10zM9 20v-6h6v6',
    zahnrad: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
    kamera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    plus: 'M12 5v14M5 12h14',
    haken: 'M5 12l5 5 9-10',
    x: 'M6 6l12 12M18 6L6 18',
    pfeil: 'M9 6l6 6-6 6',
    zurueck: 'M15 6l-6 6 6 6',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    dokument: 'M6 3h8l4 4v14H6zM14 3v4h4',
    stift: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
    muell: 'M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3',
    krank: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z',
    helfer: 'M8 21v-6l-3-3 4-5h6l4 5-3 3v6M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    abmelden: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
    material: 'M3 17l9 4 9-4M3 12l9 4 9-4M12 3l9 4-9 4-9-4z',
    mehr: 'M5 12h.01M12 12h.01M19 12h.01',
    menue: 'M4 7h16M4 12h16M4 17h16',
    glocke: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
    play: 'M8 5v14l11-7z',
    stop: 'M7 7h10v10H7z',
    unterschrift: 'M3 17c3-6 5-9 6-8s-2 7 0 8 4-6 5-5-1 4 1 4 3-2 4-2M3 21h18',
    plan: 'M4 5h16v15H4zM4 10h16M10 10v10M15 10v10',
    foto: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9h.01',
    suche: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    drucken: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
    karte: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    telefon: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    wolke: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  }[name] || '';
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;
};
