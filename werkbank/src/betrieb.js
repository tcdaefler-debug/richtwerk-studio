/* =========================================================================
   Kunden, Kalender, Mahnwesen, Nachrichten und Lager (Büro + App)
   Alles hängt an denselben Einträgen wie der Rest: Kunde ↔ Angebot ↔
   Baustelle ↔ Rechnung ↔ Fotos. Nichts wird doppelt angelegt.
   ========================================================================= */
const Betrieb = (() => {
  const { seitenkopf, leer } = Buero.teile;
  const zustand = { kunde: null, suche: '', monat: Datum.heute().slice(0, 7), tag: Datum.heute(), chat: null };
  const schluessel = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ctxBuero = () => kontext(Store.cfg, Store.items, (Sitzung.lies('buero') || {}).pid);
  const ctxApp = () => kontext(Store.cfg, Store.items, (Sitzung.lies('app') || {}).pid);
  const ctxJetzt = () => (document.body.classList.contains('app-modus') ? ctxApp() : ctxBuero());
  const zahl = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

  /* =====================================================================
     Kunden: ein Kontaktbuch, alles hängt am Namen oder an der Kunden-ID
     ===================================================================== */
  function kunden(c) { return c.typ('kunde').sort((a, b) => a.name.localeCompare(b.name)); }
  function gehoert(k, d) { return (d.kundeId && d.kundeId === k.id) || (!d.kundeId && schluessel(d.kunde) === schluessel(k.name)); }
  function akteVon(c, k) {
    const angebote = c.typ('angebot').filter((d) => gehoert(k, d));
    const rechnungen = c.typ('rechnung').filter((d) => gehoert(k, d));
    const baustellen = (c.cfg.baustellen || []).filter((b) => gehoert(k, b) || angebote.some((a) => a.bs === b.id));
    const bsIds = new Set(baustellen.map((b) => b.id));
    const fotos = c.typ('tagebuch').filter((t) => bsIds.has(t.bs)).flatMap((t) => (t.fotos || []).map((f) => ({ f, datum: t.datum, text: t.text })));
    const anfragen = c.typ('vorgang').filter((v) => gehoert(k, v));
    const offen = rechnungen.filter((r) => r.status === 'gestellt').reduce((s, r) => s + Auftraege.summen(r, Auftraege.mwstVon(c, r)).brutto, 0);
    const umsatz = rechnungen.filter((r) => ['gestellt', 'bezahlt'].includes(r.status)).reduce((s, r) => s + Auftraege.summen(r, Auftraege.mwstVon(c, r)).netto, 0);
    return { angebote, rechnungen, baustellen, fotos, anfragen, offen, umsatz };
  }
  /* Neuer Name in Angebot oder Anfrage → Kunde wird einmal angelegt */
  function kundeSichern(c, daten) {
    const name = String(daten.kunde || '').trim(); if (!name) return '';
    const da = c.typ('kunde').find((k) => schluessel(k.name) === schluessel(name));
    if (da) return da.id;
    const id = Store.uid('k');
    Store.neu({ id, typ: 'kunde', name, art: daten.kundenart || 'privat', adresse: daten.adresse || '', telefon: daten.telefon || '', email: daten.email || '', notiz: '' });
    return id;
  }

  function kundenSeite(c) {
    const q = schluessel(zustand.suche);
    const liste = kunden(c).filter((k) => !q || schluessel([k.name, k.adresse, k.telefon, k.email].join(' ')).includes(q));
    if (zustand.kunde) { const k = c.items.find((i) => i.id === zustand.kunde); if (k) return kundeAkte(c, k); }
    return seitenkopf('Kunden', 'Alle Kunden mit ihren Angeboten, Baustellen, Rechnungen und Fotos', `<button class="k haupt" data-a="kunde-neu">${Icon('plus')} Neuer Kunde</button>`)
      + `<div class="karte"><div class="kopf"><input class="kunden-suche" id="kunden-suche" type="search" placeholder="Name, Ort, Telefon …" value="${esc(zustand.suche)}" aria-label="Kunden suchen"><span class="chip">${liste.length} Kunden</span></div>
      ${liste.length ? `<div class="tabelle-huelle"><table class="t"><thead><tr><th>Kunde</th><th>Anschrift</th><th>Telefon</th><th class="r">Angebote</th><th class="r">Baustellen</th><th class="r">Umsatz netto</th><th class="r">Offen</th></tr></thead><tbody>
        ${liste.map((k) => { const a = akteVon(c, k); return `<tr class="klickbar" data-a="kunde" data-id="${k.id}"><td><b>${esc(k.name)}</b>${k.art === 'gewerblich' ? ' <span class="chip">Firma</span>' : ''}</td><td>${esc(String(k.adresse || '').replace(/\n/g, ', '))}</td><td class="num">${esc(k.telefon || '')}</td><td class="r num">${a.angebote.length}</td><td class="r num">${a.baustellen.length}</td><td class="r num">${a.umsatz ? Zahl.eur(a.umsatz) : '–'}</td><td class="r num">${a.offen ? `<span class="chip warn">${Zahl.eur(a.offen)}</span>` : '–'}</td></tr>`; }).join('')}
      </tbody></table></div>` : leer('Keine Kunden gefunden.')}</div>`;
  }
  function kundeAkte(c, k) {
    const a = akteVon(c, k); const adr = String(k.adresse || '').replace(/\n/g, ', ');
    const zeile = (titel, unter, rechts, aktion, id) => `<div class="liste-zeile klickbar" data-a="${aktion}" data-id="${id}"><div class="text"><b>${titel}</b><small>${unter}</small></div>${rechts}</div>`;
    return seitenkopf(esc(k.name), `${k.art === 'gewerblich' ? 'Firmenkunde' : 'Privatkunde'}${adr ? ' · ' + esc(adr) : ''}`, `<button class="k" data-a="kunde-zurueck">${Icon('zurueck')} Alle Kunden</button><button class="k" data-a="kunde-bearbeiten" data-id="${k.id}">${Icon('stift')} Bearbeiten</button><button class="k haupt" data-a="kunde-angebot" data-id="${k.id}">${Icon('plus')} Angebot</button>`)
      + `<div class="kunde-kopf karte"><div class="koerper kunde-kontakt">
          ${k.telefon ? `<a class="k" href="tel:${esc(k.telefon.replace(/\s+/g, ''))}">${Icon('telefon')} ${esc(k.telefon)}</a>` : ''}
          ${k.email ? `<a class="k" href="mailto:${esc(k.email)}">${Icon('angebot')} ${esc(k.email)}</a>` : ''}
          ${adr ? `<a class="k" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}" target="_blank" rel="noopener">${Icon('karte')} Route</a>` : ''}
          ${c.R.an('kunden', 'umsatz') ? `<span class="kunde-zahlen"><span>Umsatz <b>${Zahl.eur(a.umsatz)}</b></span><span>Offen <b>${Zahl.eur(a.offen)}</b></span></span>` : ''}
          ${k.notiz ? `<p class="kunde-notiz">${esc(k.notiz)}</p>` : ''}</div></div>
        <div class="zwei"><div>
          <div class="karte"><div class="kopf"><h3>Angebote</h3><span class="chip">${a.angebote.length}</span></div>${a.angebote.map((d) => zeile(`${esc(d.nr || 'Entwurf')} · ${esc(d.betreff || '')}`, Datum.kurz(d.datum || c.heute), `${Auftraege.chipDoc(c, d)} <span class="num">${Zahl.eur(Auftraege.summen(d, Auftraege.mwstVon(c, d)).netto)}</span>`, 'angebot', d.id)).join('') || leer('Noch keine Angebote.')}</div>
          <div class="karte"><div class="kopf"><h3>Rechnungen</h3><span class="chip">${a.rechnungen.length}</span></div>${a.rechnungen.map((d) => zeile(`${esc(d.nr || 'Entwurf')} · ${esc(d.betreff || '')}`, d.datum ? Datum.kurz(d.datum) : 'Entwurf', `${Auftraege.chipDoc(c, d)} <span class="num">${Zahl.eur(Auftraege.summen(d, Auftraege.mwstVon(c, d)).brutto)}</span>`, 'rechnung', d.id)).join('') || leer('Noch keine Rechnungen.')}</div>
        </div><div>
          <div class="karte"><div class="kopf"><h3>Baustellen</h3></div>${a.baustellen.map((b) => zeile(esc(b.name), esc(b.adresse || b.ort || ''), chip(b.status === 'fertig' ? 'erledigt' : b.status === 'geplant' ? 'neu' : 'laeuft'), 'akte', b.id)).join('') || leer('Noch keine Baustelle.')}</div>
          ${a.anfragen.length ? `<div class="karte"><div class="kopf"><h3>Anfragen</h3></div>${a.anfragen.map((v) => zeile(esc(v.titel || 'Anfrage'), `${Datum.kurz(v.datum)}${v.notiz ? ' · ' + esc(v.notiz) : ''}`, '', 'gehe', 'tafel')).join('')}</div>` : ''}
          <div class="karte"><div class="kopf"><h3>Fotos</h3><span class="chip">${a.fotos.length}</span></div>${a.fotos.length ? `<div class="kunde-fotos">${a.fotos.slice(0, 12).map((f) => `<figure><img data-datei="${esc(f.f)}" alt=""><figcaption>${Datum.kurz(f.datum)}</figcaption></figure>`).join('')}</div>` : leer('Fotos aus dem Bautagebuch erscheinen hier.')}</div>
        </div></div>`;
  }
  function kundeFenster(c, k = {}) {
    Fenster.oeffne({
      titel: k.id ? esc(k.name) : 'Neuer Kunde', bereich: 'ui-buero-fenster',
      inhalt: `<div class="reihe"><label class="feld"><span>Name oder Firma</span><input name="name" value="${esc(k.name || '')}"></label><label class="feld"><span>Art</span><select name="art"><option value="privat">Privat</option><option value="gewerblich" ${k.art === 'gewerblich' ? 'selected' : ''}>Firma</option></select></label></div>
        <label class="feld"><span>Anschrift (Straße, PLZ Ort)</span><textarea name="adresse" rows="2">${esc(k.adresse || '')}</textarea></label>
        <div class="reihe"><label class="feld"><span>Telefon</span><input name="telefon" type="tel" value="${esc(k.telefon || '')}"></label><label class="feld"><span>E-Mail</span><input name="email" type="email" value="${esc(k.email || '')}"></label></div>
        <label class="feld"><span>Notiz</span><input name="notiz" value="${esc(k.notiz || '')}" placeholder="z. B. nur vormittags erreichbar"></label>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: { ok: (b, hg) => {
        const w = Fenster.werte(hg); if (!w.name.trim()) return meldung('Bitte einen Namen eintragen.', 'fehler');
        const daten = { name: w.name.trim(), art: w.art, adresse: w.adresse.trim(), telefon: w.telefon.trim(), email: w.email.trim(), notiz: w.notiz.trim() };
        if (k.id) Store.aendere(k.id, daten); else { const id = Store.uid('k'); Store.neu({ id, typ: 'kunde', ...daten }); zustand.kunde = id; }
        Fenster.schliesse(); meldung('Gespeichert'); Buero.neuZeichnen();
      } },
    });
  }

  /* =====================================================================
     Angebot versenden: Text vorschlagen, Termine wählen, prüfen, abhaken
     ===================================================================== */
  function freieTage(c, n = 3) {
    const out = []; let d = Datum.plus(c.heute, 7);
    while (out.length < n) { d = Datum.plus(d, 1); if (!Datum.istArbeitstag(d)) continue; const w = c.planWoche(Datum.montag(d)); const t = Datum.wochentag(d); const belegt = w && w.zellen ? Object.values(w.zellen).filter((z) => z[t]).length : 0; if (belegt < c.arbeiter().length - 1) out.push(d); if (out.length && Datum.plus(out[out.length - 1], 0) === d) d = Datum.plus(d, 1); }
    return out;
  }
  const datumLang = (d) => `${Datum.WT_LANG ? Datum.WT_LANG[Datum.wochentag(d)] : Datum.WT[Datum.wochentag(d)]}, ${Datum.kurz(d)}${d.slice(0, 4)}`;
  function versenden(c, a) {
    const f = c.cfg; const s = Auftraege.summen(a, Auftraege.mwstVon(c, a));
    const anrede = a.kundenart === 'gewerblich' ? 'Sehr geehrte Damen und Herren' : (() => { const n = String(a.kunde || '').trim(); return /^familie\s/i.test(n) ? `Liebe ${n}` : `Guten Tag ${n}`; })();
    const vorschlag = freieTage(c);
    const textMit = (termine, link) => `${anrede},\n\nvielen Dank für Ihre Anfrage${a.betreff ? ` zu „${a.betreff}“` : ''} und das freundliche Gespräch. Wie besprochen schicke ich Ihnen unser Angebot ${a.nr}. Der Gesamtpreis liegt bei ${Zahl.eur(s.brutto)} inklusive Mehrwertsteuer.\n\n${link ? `Sie können sich das Angebot hier in Ruhe ansehen, ausdrucken und, wenn alles passt, auch direkt annehmen:\n${link}\n\n` : 'Das Angebot finden Sie im Anhang.\n\n'}${termine.length ? `Für die Ausführung hätten wir folgende Termine frei:\n${termine.map((t) => '– ' + datumLang(t)).join('\n')}\nSagen Sie mir einfach, welcher Ihnen am besten passt.\n\n` : ''}Wenn Sie Fragen haben oder etwas anders haben möchten, rufen Sie mich gern an${f.telefon ? ` unter ${f.telefon}` : ''}.\n\nViele Grüße aus ${f.ort || 'der Werkstatt'}\n${f.inhaber || f.name}\n${f.name}`;
    let link = '';
    const hg = Fenster.oeffne({
      titel: `Angebot ${esc(a.nr)} versenden`, breit: true, bereich: 'ui-buero-fenster',
      inhalt: `<div class="versand">
        <div class="versand-links">
          <h4>1. Termine anbieten</h4>
          <p class="klein">Vorschläge sind Tage, an denen laut Wochenplan noch Leute frei sind. Ändern oder leeren, wenn kein Termin genannt werden soll.</p>
          ${[0, 1, 2].map((i) => `<input type="date" class="v-termin" value="${vorschlag[i] || ''}" aria-label="Termin ${i + 1}">`).join('')}
          <h4>2. Prüfen und abhaken</h4>
          <label class="v-haken"><input type="checkbox" data-pruef>Positionen und Preise stimmen</label>
          <label class="v-haken"><input type="checkbox" data-pruef>Name, Anschrift und E-Mail stimmen</label>
          <label class="v-haken"><input type="checkbox" data-pruef>Termine sind mit der Planung abgestimmt</label>
          <label class="v-haken"><input type="checkbox" data-pruef>Text gelesen</label>
          <p class="v-ausblick">Ausblick: Eine KI-Prüfung, die Mengen, Preise und Text vor dem Versand gegenliest, ist in Planung.</p>
        </div>
        <div class="versand-rechts">
          <label class="feld"><span>An</span><input id="v-an" type="email" value="${esc(a.email || '')}" placeholder="E-Mail des Kunden"></label>
          <label class="feld"><span>Betreff</span><input id="v-betreff" value="${esc(`Ihr Angebot ${a.nr}${a.betreff ? ': ' + a.betreff : ''}`)}"></label>
          <label class="feld"><span>Text (Vorschlag, frei änderbar)</span><textarea id="v-text" rows="16"></textarea></label>
        </div></div>`,
      fuss: `<button class="k" data-f="drucken" style="margin-right:auto">${Icon('drucken')} Angebot als PDF</button><span class="v-status" id="v-status">Noch 4 Haken</span><button class="k haupt" data-f="senden" disabled>${Icon('angebot')} Senden</button>`,
      aktionen: {
        drucken: () => drucken(Auftraege.dokumentHtml(c, a, 'angebot')),
        senden: () => {
          const an = $('#v-an', hg).value.trim(); if (!/.+@.+\..+/.test(an)) return meldung('Bitte eine gültige E-Mail-Adresse eintragen.', 'fehler');
          const termine = termineLesen();
          Store.aendere(a.id, { status: a.status === 'entwurf' ? 'gesendet' : a.status, email: an, termine, versand: [...(a.versand || []), { wann: Date.now(), an, termine }] });
          location.href = `mailto:${encodeURIComponent(an)}?subject=${encodeURIComponent($('#v-betreff', hg).value)}&body=${encodeURIComponent($('#v-text', hg).value)}`;
          Fenster.schliesse(); meldung('Als gesendet vermerkt. Ihr E-Mail-Programm öffnet sich mit dem fertigen Text.');
        },
      },
    });
    function termineLesen() { return $$('.v-termin', hg).map((i) => i.value).filter(Boolean).sort(); }
    function textNeu() { $('#v-text', hg).value = textMit(termineLesen(), link); }
    function pruefen() { const n = $$('[data-pruef]', hg).filter((x) => !x.checked).length; $('[data-f=senden]', hg).disabled = n > 0; $('#v-status', hg).textContent = n ? `Noch ${n} ${n === 1 ? 'Haken' : 'Haken'}` : 'Bereit'; }
    hg.addEventListener('change', (e) => { if (e.target.classList.contains('v-termin')) textNeu(); pruefen(); });
    // Link für die Online-Annahme gleich mit erzeugen
    if (c.R.an('angebote', 'onlineAnnahme')) {
      const key = a.schluessel || Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      if (!a.schluessel) Store.aendere(a.id, { schluessel: key });
      link = `${location.href.split('#')[0]}#angebot/${Store.fid}/${a.id}/${key}`;
    }
    textNeu();
  }

  /* =====================================================================
     Mahnwesen: Stufen nach Tagen über Fälligkeit, nur intern
     ===================================================================== */
  const STUFEN = ['Zahlungserinnerung', '1. Mahnung', '2. Mahnung', 'Letzte Mahnung'];
  function mahnstand(c, r) {
    if (r.status !== 'gestellt' || !r.faellig || r.faellig >= c.heute) return null;
    const tage = Math.round((Datum.von(c.heute) - Datum.von(r.faellig)) / 864e5);
    const P = c.R.p('rechnungen'); const erste = Number(P.mahnung) || 7; const abstand = Number(P.mahnAbstand) || 14;
    const gesendet = (r.mahnungen || []).length;
    const faelligStufe = tage < erste ? -1 : Math.min(STUFEN.length - 1, Math.floor((tage - erste) / abstand));
    const letzte = (r.mahnungen || [])[gesendet - 1];
    const naechste = gesendet < STUFEN.length && faelligStufe >= gesendet && (!letzte || Datum.plus(letzte.datum, abstand) <= c.heute) ? gesendet : null;
    return { tage, gesendet, naechste, letzte };
  }
  function mahnungHtml(c, r, stufe) {
    const s = Auftraege.summen(r, Auftraege.mwstVon(c, r)); const f = c.cfg; const P = c.R.p('rechnungen');
    const gebuehr = stufe >= 2 ? Number(P.mahngebuehr) || 0 : 0;
    const privat = r.kundenart !== 'gewerblich';
    const text = stufe === 0 ? `sicher ist es Ihrer Aufmerksamkeit entgangen: Unsere Rechnung ${r.nr} vom ${Datum.kurz(r.datum)}${r.datum.slice(0, 4)} über ${Zahl.eur(s.brutto)} war am ${Datum.kurz(r.faellig)}${r.faellig.slice(0, 4)} fällig. Bitte überweisen Sie den Betrag innerhalb der nächsten 7 Tage. Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.`
      : `trotz unserer ${stufe === 1 ? 'Zahlungserinnerung' : 'bisherigen Schreiben'} ist unsere Rechnung ${r.nr} vom ${Datum.kurz(r.datum)}${r.datum.slice(0, 4)} über ${Zahl.eur(s.brutto)} noch offen. Sie befinden sich seit dem ${Datum.kurz(Datum.plus(r.faellig, 1))}${r.faellig.slice(0, 4)} in Verzug. Bitte überweisen Sie ${gebuehr ? `den Betrag zuzüglich ${Zahl.eur(gebuehr)} Mahngebühr, also ${Zahl.eur(s.brutto + gebuehr)},` : 'den Betrag'} bis zum ${Datum.kurz(Datum.plus(c.heute, 10))}${Datum.plus(c.heute, 10).slice(0, 4)}.${stufe === 3 ? ' Geht bis dahin keine Zahlung ein, übergeben wir die Forderung ohne weitere Ankündigung zur gerichtlichen Durchsetzung (Mahnbescheid).' : ''} Wir behalten uns vor, Verzugszinsen in gesetzlicher Höhe (${privat ? '5' : '9'} Prozentpunkte über dem Basiszinssatz, § 288 BGB)${privat ? '' : ' und die Pauschale von 40 €'} zu berechnen.`;
    return `<div class="dokument"><div class="d-kopf"><div class="d-firma"><b>${esc(f.name)}</b><span>${esc(f.zusatz || '')}</span></div><div class="d-adresse">${[f.strasse, [f.plz, f.ort].filter(Boolean).join(' '), f.telefon && 'Tel. ' + f.telefon, f.email].filter(Boolean).map(esc).join('<br>')}</div></div>
      <div class="d-mitte"><div class="d-empf">${esc(r.kunde)}<br>${esc(r.adresse || '').replace(/\n/g, '<br>')}</div><dl class="d-meta"><dt>Rechnung</dt><dd>${esc(r.nr)}</dd><dt>Datum</dt><dd>${Datum.kurz(c.heute)}${c.heute.slice(0, 4)}</dd></dl></div>
      <h2>${STUFEN[stufe]}</h2><p>Sehr geehrte Damen und Herren,</p><p>${text}</p>
      <table class="d-summe"><tr><td>Rechnungsbetrag</td><td class="r num">${Zahl.eur(s.brutto)}</td></tr>${gebuehr ? `<tr><td>Mahngebühr</td><td class="r num">${Zahl.eur(gebuehr)}</td></tr>` : ''}<tr class="gesamt"><td>Zu zahlen</td><td class="r num">${Zahl.eur(s.brutto + gebuehr)}</td></tr></table>
      <p>Mit freundlichen Grüßen<br>${esc(f.inhaber || f.name)}</p>
      <div class="d-fuss"><span>${esc(f.name)}</span><span>${f.bank ? esc(f.bank) + ' · ' : ''}${f.iban ? 'IBAN ' + esc(f.iban) : ''}</span></div></div>`;
  }
  function mahnFenster(c, r) {
    const m = mahnstand(c, r); if (!m) return;
    const stufe = m.naechste ?? Math.min(m.gesendet, STUFEN.length - 1);
    Fenster.oeffne({
      titel: `${STUFEN[stufe]} zu ${esc(r.nr)}`, breit: true, bereich: 'ui-buero-fenster',
      inhalt: `<p class="hinweis-zeile">${m.tage} Tage über dem Zahlungsziel. ${m.gesendet ? `Bisher: ${(r.mahnungen || []).map((x) => `${STUFEN[x.stufe]} am ${Datum.kurz(x.datum)}`).join(', ')}.` : 'Noch keine Erinnerung verschickt.'}</p>
        <div class="mahn-vorschau">${mahnungHtml(c, r, stufe)}</div>`,
      fuss: `<button class="k" data-f="zu" style="margin-right:auto">Abbrechen</button>${m.naechste === null ? '<span class="v-status">Nächste Stufe noch nicht fällig</span>' : ''}<button class="k haupt" data-f="ok">${Icon('drucken')} Drucken und als verschickt vermerken</button>`,
      aktionen: { ok: () => { drucken(mahnungHtml(c, r, stufe)); Store.aendere(r.id, { mahnungen: [...(r.mahnungen || []), { stufe, datum: c.heute }] }); Fenster.schliesse(); meldung(`${STUFEN[stufe]} vermerkt`); } },
    });
  }

  /* =====================================================================
     Kalender: Monat wie Outlook, Tag mit Einsatz, Terminen und Wetter
     ===================================================================== */
  const wetter = { daten: null, laden: false, fehler: false };
  /* Wettersymbole als schlichte Linien, wie im Rest der Oberfläche */
  const W = {
    sonne: '<circle cx="12" cy="12" r="4.2" fill="#e0a21b" stroke="none"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="#e0a21b"/>',
    wolke: '<path d="M7 18.5h10a4 4 0 00.4-8 5.5 5.5 0 00-10.6 1.4A3.3 3.3 0 007 18.5z" fill="#cfd5dc" stroke="#7d8894"/>',
    halb: '<circle cx="8.5" cy="8.5" r="3.4" fill="#e0a21b" stroke="none"/><path d="M8 19h9.5a3.6 3.6 0 00.3-7.2 5 5 0 00-9.6 1.3A3 3 0 008 19z" fill="#e3e7ec" stroke="#7d8894"/>',
    regen: '<path d="M7 14.5h10a3.8 3.8 0 00.4-7.6 5.3 5.3 0 00-10.2 1.3A3.2 3.2 0 007 14.5z" fill="#cfd5dc" stroke="#7d8894"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3" stroke="#2f6fb5"/>',
    schnee: '<path d="M7 14.5h10a3.8 3.8 0 00.4-7.6 5.3 5.3 0 00-10.2 1.3A3.2 3.2 0 007 14.5z" fill="#e3e7ec" stroke="#7d8894"/><path d="M8.5 18.5h.01M12 20h.01M15.5 18.5h.01" stroke="#5b8fc9" stroke-width="2.6"/>',
    gewitter: '<path d="M7 14h10a3.8 3.8 0 00.4-7.6 5.3 5.3 0 00-10.2 1.3A3.2 3.2 0 007 14z" fill="#b9c1ca" stroke="#5f6b78"/><path d="M12.5 15l-2 3.5h3l-2 3.5" stroke="#d48a00"/>',
    nebel: '<path d="M4 9h16M6 13h12M4 17h16" stroke="#8a95a1"/>',
  };
  const wsym = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${W[k]}</svg>`;
  const WETTER_TEXT = (code) => (code === 0 ? ['Sonnig', wsym('sonne')] : code <= 2 ? ['Leicht bewölkt', wsym('halb')] : code === 3 ? ['Bewölkt', wsym('wolke')] : code <= 48 ? ['Nebel', wsym('nebel')] : code <= 67 ? ['Regen', wsym('regen')] : code <= 77 ? ['Schnee', wsym('schnee')] : code <= 82 ? ['Schauer', wsym('regen')] : code <= 86 ? ['Schneeschauer', wsym('schnee')] : ['Gewitter', wsym('gewitter')]);
  async function wetterLaden(c) {
    if (wetter.daten || wetter.laden || wetter.fehler) return;
    wetter.laden = true;
    try {
      let { lat, lon } = c.cfg;
      if (!lat && c.cfg.ort) { const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c.cfg.ort)}&count=1&language=de&countryCode=DE`).then((r) => r.json()); if (g.results && g.results[0]) ({ latitude: lat, longitude: lon } = g.results[0]); }
      if (!lat) throw new Error('Ort unbekannt');
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=Europe%2FBerlin&forecast_days=14`).then((r) => r.json());
      const d = {}; (w.daily.time || []).forEach((t, i) => { d[t] = { code: w.daily.weathercode[i], max: w.daily.temperature_2m_max[i], min: w.daily.temperature_2m_min[i], regen: w.daily.precipitation_sum[i], wind: w.daily.windspeed_10m_max[i] }; });
      wetter.daten = d;
    } catch { wetter.fehler = true; }
    wetter.laden = false; Buero.neuZeichnen();
  }
  function eintraege(c, d) {
    const out = [];
    const w = c.planWoche(Datum.montag(d)); const t = Datum.wochentag(d);
    if (w && w.zellen && t < 6) (c.cfg.baustellen || []).forEach((b) => { const leute = c.arbeiter().filter((p) => w.zellen[p.id] && w.zellen[p.id][t] === b.id && !c.abwesend(p.id, d)); if (leute.length) out.push({ art: 'einsatz', text: `${b.name.replace(/^(Neubau|Dachsanierung|Carport|Gaube)\s+/, '')}: ${leute.map((p) => p.name.split(' ')[0]).join(', ')}`, a: 'akte', id: b.id }); });
    c.personen.forEach((p) => { const abw = c.abwesend(p.id, d); if (abw && Datum.istArbeitstag(d)) out.push({ art: abw.typ === 'krank' ? 'krank' : 'urlaub', text: `${p.name.split(' ')[0]}: ${abw.typ === 'krank' ? 'krank' : abw.art || 'Urlaub'}` }); });
    c.typ('vorgang').filter((v) => v.termin === d && !v.archiv).forEach((v) => out.push({ art: 'termin', text: `Besichtigung ${v.kunde}`, a: 'gehe', id: 'tafel' }));
    c.typ('angebot').filter((a) => a.angenommenOnline && a.angenommenOnline.termin === d).forEach((a) => out.push({ art: 'termin', text: `Beginn ${a.kunde} (Wunschtermin)`, a: 'angebot', id: a.id }));
    c.typ('angebot').filter((a) => a.status === 'gesendet' && (a.termine || []).includes(d)).forEach((a) => out.push({ art: 'vorschlag', text: `Termin angeboten: ${a.kunde}`, a: 'angebot', id: a.id }));
    if (c.R.an('kalender', 'faellige')) c.typ('rechnung').filter((r) => r.status === 'gestellt' && r.faellig === d).forEach((r) => out.push({ art: 'geld', text: `Fällig: ${r.nr} ${r.kunde}`, a: 'rechnung', id: r.id }));
    c.typ('erinnerung').filter((e) => !e.erledigt && e.faellig === d && c.ich && e.pid === c.ich.id).forEach((e) => out.push({ art: 'erinnerung', text: e.text, erinnerung: e.id }));
    out.push(...Netz.kalender(c, d));
    const fei = Datum.feiertag(d); if (fei) out.unshift({ art: 'feiertag', text: fei });
    return out;
  }
  function wetterChip(d, gross) {
    const w = wetter.daten && wetter.daten[d]; if (!w) return '';
    const P = regeln(Store.cfg).p('kalender'); const [t, s] = WETTER_TEXT(w.code); const warn = w.regen >= Number(P.regen || 5) || w.wind >= Number(P.wind || 50);
    return `<span class="wetter ${warn ? 'warn' : ''}" title="${t}, ${Math.round(w.min)} bis ${Math.round(w.max)} °C, ${String(w.regen).replace('.', ',')} mm Regen, Wind bis ${Math.round(w.wind)} km/h">${s}${Math.round(w.max)}°${gross ? ` ${t} · ${Math.round(w.min)}–${Math.round(w.max)} °C · ${String(w.regen).replace('.', ',')} mm · Wind ${Math.round(w.wind)} km/h` : ''}</span>`;
  }
  function kalenderSeite(c) {
    const mitWetter = c.R.an('kalender', 'wetter'); if (mitWetter) wetterLaden(c);
    const [j, m] = zustand.monat.split('-').map(Number);
    const erster = `${zustand.monat}-01`; let start = Datum.montag(erster);
    const tage = []; for (let i = 0; i < 42; i++) tage.push(Datum.plus(start, i));
    const zeigen = tage[35].slice(0, 7) > zustand.monat ? tage.slice(0, 35) : tage;
    const tag = zustand.tag; const liste = eintraege(c, tag);
    return seitenkopf('Kalender', 'Einsätze aus dem Wochenplan, Termine, Urlaub, Fälligkeiten und das Wetter vor Ort',
      `<span class="wochenwahl"><button class="k klein" data-a="kal-monat" data-id="-1" aria-label="Voriger Monat">${Icon('zurueck')}</button><b>${esc(Datum.monatName(zustand.monat))}</b><button class="k klein" data-a="kal-monat" data-id="1" aria-label="Nächster Monat">${Icon('pfeil')}</button></span><button class="k" data-a="kal-heute">Heute</button>`)
      + `<div class="kalender-layout"><div class="karte kal-monat"><div class="kal-kopf">${Datum.WT.slice(0, 7).map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="kal-raster">${zeigen.map((d) => { const e = eintraege(c, d); const anders = d.slice(0, 7) !== zustand.monat;
          return `<button class="kal-tag ${anders ? 'anders' : ''} ${d === c.heute ? 'heute' : ''} ${d === tag ? 'gewaehlt' : ''} ${Datum.istArbeitstag(d) ? '' : 'frei'}" data-a="kal-tag" data-id="${d}"><span class="kal-nr">${Number(d.slice(8))}${mitWetter ? wetterChip(d) : ''}</span>${e.slice(0, 4).map((x) => `<span class="kal-e ${x.art}">${esc(x.text)}</span>`).join('')}${e.length > 4 ? `<span class="kal-mehr">+${e.length - 4} weitere</span>` : ''}</button>`; }).join('')}</div></div>
        <div class="karte kal-detail"><div class="kopf"><h3>${esc(Datum.lang(tag))}</h3></div>
          ${!mitWetter ? '' : wetter.daten && wetter.daten[tag] ? `<div class="kal-wetter">${wetterChip(tag, true)}</div>` : `<div class="kal-wetter leise">${wetter.fehler ? 'Wetter gerade nicht abrufbar.' : wetter.laden ? 'Wetter wird geladen …' : 'Wetter gibt es für die nächsten 14 Tage.'}</div>`}
          ${liste.map((x) => `<div class="liste-zeile kal-zeile ${x.art}">${x.erinnerung ? `<div class="text"><b>${esc(x.text)}</b><small>Erinnerung</small></div><button class="k klein ok" data-erinnerung="${x.erinnerung}">Erledigt</button>` : `<div class="text"><b>${esc(x.text)}</b><small>${{ einsatz: 'Einsatz laut Wochenplan', urlaub: 'Abwesend', krank: 'Abwesend', termin: 'Termin', vorschlag: 'Dem Kunden angeboten', geld: 'Zahlung erwartet', feiertag: 'Feiertag', partner: 'Partnerbetrieb' }[x.art] || ''}</small></div>${x.a ? `<button class="k klein" data-a="${x.a}" data-id="${x.id}">Öffnen</button>` : ''}`}</div>`).join('') || leer('Nichts eingetragen.')}
          <div class="legende" style="padding:10px 14px">${mitWetter ? 'Wetter: Open-Meteo. ' : ''}Einsätze kommen aus dem Wochenplan, Partner aus dem Partnerbuch.</div></div></div>`;
  }

  /* =====================================================================
     Nachrichten zwischen Büro und Mitarbeitern (statt WhatsApp)
     ===================================================================== */
  const ungelesen = (c, pid, fuerBuero) => c.typ('nachricht').filter((n) => n.mit === pid && !n.gelesen && (fuerBuero ? n.von === pid : n.von !== pid)).length;
  function verlaufHtml(c, pid, ichPid) {
    const liste = c.typ('nachricht').filter((n) => n.mit === pid).sort((a, b) => a.wann - b.wann);
    let tagVorher = '';
    return liste.map((n) => { const tag = Datum.iso(new Date(n.wann)); const z = new Date(n.wann); const eigen = n.von === ichPid || (ichPid === 'buero' && n.von !== pid);
      const trenner = tag !== tagVorher ? `<div class="chat-tag">${tag === c.heute ? 'Heute' : Datum.kurz(tag)}</div>` : ''; tagVorher = tag;
      return `${trenner}<div class="chat-blase ${eigen ? 'eigen' : ''}">${!eigen && n.von !== pid ? `<small>${esc(c.person(n.von).name)}</small>` : ''}${n.bild ? `<img data-datei="${esc(n.bild)}" alt="Bild">` : ''}${n.text ? `<p>${esc(n.text)}</p>` : ''}<span class="zeit">${String(z.getHours()).padStart(2, '0')}:${String(z.getMinutes()).padStart(2, '0')}${eigen && n.gelesen && c.R.an('nachrichten', 'gelesen') ? ' · gelesen' : ''}</span></div>`; }).join('') || '<p class="chat-leer">Noch keine Nachrichten. Fragen zur Lohnabrechnung, Fotos von der Baustelle oder kurze Absprachen gehen hier rein und bleiben gespeichert.</p>';
  }
  function chatSeite(c) {
    const leute = c.arbeiter();
    const pid = zustand.chat && leute.some((p) => p.id === zustand.chat) ? zustand.chat : (leute[0] || {}).id;
    zustand.chat = pid;
    setTimeout(() => { const v = $('#chat-verlauf'); if (v) v.scrollTop = v.scrollHeight; markiere(c, pid, true); }, 0);
    return seitenkopf('Nachrichten', 'Rückfragen und Fotos zwischen Büro und Mitarbeitern. Alles bleibt beim Betrieb gespeichert.')
      + `<div class="chat-layout karte"><div class="chat-liste">${leute.map((p) => { const n = ungelesen(c, p.id, true); const letzte = c.typ('nachricht').filter((x) => x.mit === p.id).sort((a, b) => b.wann - a.wann)[0];
          return `<button class="chat-person ${p.id === pid ? 'an' : ''}" data-a="chat-person" data-id="${p.id}"><span class="rund">${esc(c.kuerzel(p.name))}</span><span class="text"><b>${esc(p.name)}</b><small>${letzte ? esc(letzte.text || 'Bild') : esc(p.funktion || '')}</small></span>${n ? `<span class="zahl">${n}</span>` : ''}</button>`; }).join('')}</div>
        <div class="chat-fenster"><div class="chat-verlauf" id="chat-verlauf">${verlaufHtml(c, pid, 'buero')}</div>${eingabe()}</div></div>`;
  }
  const eingabe = () => `<form class="chat-eingabe" data-chat-form>${regeln(Store.cfg).an('nachrichten', 'bilder') ? `<button type="button" class="k" data-chat-bild aria-label="Bild anhängen">${Icon('kamera')}</button>` : ''}<input name="text" placeholder="Nachricht schreiben …" autocomplete="off" aria-label="Nachricht"><button class="k haupt" type="submit">Senden</button></form>`;
  function markiere(c, pid, buero) { c.typ('nachricht').filter((n) => n.mit === pid && !n.gelesen && (buero ? n.von === pid : n.von !== pid)).forEach((n) => Store.aendere(n.id, { gelesen: Date.now() })); }
  async function senden(form) {
    const app = document.body.classList.contains('app-modus'); const c = ctxJetzt();
    const mit = app ? c.ich.id : zustand.chat; const text = form.text.value.trim(); const bild = form.dataset.bild || '';
    if (!text && !bild) return;
    Store.neu({ typ: 'nachricht', mit, von: c.ich.id, text, bild, wann: Date.now() });
    form.text.value = ''; delete form.dataset.bild; const vb = $('.chat-anhang', form); if (vb) vb.remove();
  }
  document.addEventListener('submit', (e) => { const f = e.target.closest && e.target.closest('[data-chat-form]'); if (!f) return; e.preventDefault(); senden(f); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-chat-bild]'); if (!b) return;
    const form = b.closest('form'); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const url = await bildVerkleinern(f, { maxKante: 1000 }); form.dataset.bild = await Store.speichereDatei(url, f.name); form.insertAdjacentHTML('afterbegin', `<span class="chat-anhang">${Icon('foto')} Bild angehängt</span>`); } catch (err) { meldung(err.message, 'fehler'); } };
    inp.click();
  });
  /* App: Nachrichten als eigenes Fenster */
  function appChat() {
    const c = ctxApp(); const pid = c.ich.id;
    const hg = Fenster.oeffne({ titel: 'Nachrichten an das Büro', bereich: 'ui-buero-fenster app-fenster chat-app', inhalt: `<div class="chat-verlauf" id="chat-verlauf">${verlaufHtml(c, pid, pid)}</div>${eingabe()}` });
    const neu = () => { const v = $('#chat-verlauf', hg); if (!v || !hg.isConnected) { ab(); return; } const c2 = ctxApp(); v.innerHTML = verlaufHtml(c2, pid, pid); bilderNachladen(v, Store.items); v.scrollTop = v.scrollHeight; markiere(c2, pid, false); };
    const ab = Store.abonniere(neu); neu();
  }
  /* App: Ablage des Mitarbeiters */
  function appAblage() {
    const c = ctxApp(); const p = c.ich;
    const monate = []; let ym = c.heute.slice(0, 7); for (let i = 0; i < 6; i++) { monate.push(ym); const [jj, mm] = ym.split('-').map(Number); ym = Datum.iso(new Date(jj, mm - 2, 1)).slice(0, 7); }
    const doks = c.typ('dokument').filter((d) => d.fuer === p.id || d.fuer === 'alle').sort((a, b) => b.erstellt - a.erstellt);
    const bilder = c.typ('nachricht').filter((n) => n.mit === p.id && n.bild);
    Fenster.oeffne({
      titel: 'Meine Ablage', bereich: 'ui-buero-fenster app-fenster',
      inhalt: `<h4 class="ablage-titel">Stundenzettel</h4>${monate.map((m) => { const n = c.monatsnachweis(p.id, m); return `<div class="liste-zeile"><div class="text"><b>${esc(Datum.monatName(m))}</b><small>${Zahl.std(n.ist)} Std. gearbeitet${n.soll ? ` · Soll ${Zahl.std(n.soll)}` : ''}</small></div><button class="k klein" data-ablage-monat="${m}">${Icon('drucken')} PDF</button></div>`; }).join('')}
        <h4 class="ablage-titel">Lohnabrechnungen und Dokumente</h4>${doks.map((d) => `<div class="liste-zeile"><div class="text"><b>${esc(d.titel)}</b><small>${Datum.kurz(d.datum || Datum.iso(d.erstellt))}</small></div></div>`).join('') || '<p class="ablage-leer">Noch keine Dokumente vom Büro.</p>'}
        <h4 class="ablage-titel">Bilder aus Nachrichten</h4>${bilder.length ? `<div class="kunde-fotos">${bilder.map((b) => `<figure><img data-datei="${esc(b.bild)}" alt=""><figcaption>${Datum.kurz(Datum.iso(new Date(b.wann)))}</figcaption></figure>`).join('')}</div>` : '<p class="ablage-leer">Noch keine.</p>'}
        <p class="ablage-leer">Alles hier gehört zu deinem Zugang und bleibt auch gespeichert, wenn du das Handy wechselst.</p>`,
    });
    bilderNachladen($('#fenster'), Store.items);
  }
  function stundenzettel(c, pid, ym) {
    const n = c.monatsnachweis(pid, ym); const p = c.person(pid);
    return `<div class="dokument"><div class="d-kopf"><div class="d-firma"><b>${esc(c.cfg.name)}</b><span>Stundenzettel</span></div><div class="d-adresse">${esc(p.name)}<br>${esc(Datum.monatName(ym))}</div></div>
      <table class="d-pos"><thead><tr><th>Tag</th><th>Zeiten</th><th>Baustelle</th><th class="r">Stunden</th></tr></thead><tbody>${n.tage.filter((t) => t.eintr.length || t.abw).map((t) => `<tr><td>${Datum.WT[Datum.wochentag(t.datum)]} ${Datum.kurz(t.datum)}</td><td>${t.eintr.map((e) => `${e.von}–${e.bis}`).join(', ') || (t.abw ? (t.abw.typ === 'krank' ? 'Krank' : esc(t.abw.art || 'Urlaub')) : '')}</td><td>${t.eintr.map((e) => esc(c.bsName(e.bs))).join(', ')}</td><td class="r num">${Zahl.std(t.eintr.reduce((s, e) => s + stundenVon(e), 0))}</td></tr>`).join('')}</tbody></table>
      <table class="d-summe"><tr><td>Gearbeitet</td><td class="r num">${Zahl.std(n.ist)}</td></tr>${n.soll ? `<tr><td>Soll</td><td class="r num">${Zahl.std(n.soll)}</td></tr>` : ''}</table></div>`;
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-app-chat],[data-app-ablage],[data-ablage-monat]'); if (!t) return;
    e.preventDefault();
    if (t.dataset.appChat !== undefined) return appChat();
    if (t.dataset.appAblage !== undefined) return appAblage();
    const c = ctxApp(); drucken(stundenzettel(c, c.ich.id, t.dataset.ablageMonat));
  });

  /* =====================================================================
     Lager, das sich selbst führt
     Zugang: Lieferschein oder E-Rechnung des Händlers übernehmen
     Abgang: Material für eine Baustelle (Rechner, Angebot, Entnahme),
             Mitarbeiter bestätigen auf der Baustelle mit einem Tipp
     Zwei-Kisten: Kleinteile werden nicht gezählt. Kiste leer = nachbestellen
     Stichprobe: ein paar Artikel zählen statt Jahresinventur
     ===================================================================== */
  const artikel = (c) => c.cfg.lager || [];
  function bestand(c, id) { return c.typ('lagerbuchung').filter((b) => b.artikel === id).reduce((s, b) => s + Number(b.menge || 0), 0); }
  function finde(c, text) {
    const t = schluessel(text).replace(/[^a-z0-9äöüß/ ]/g, ' ');
    let best = null; let punkte = 0;
    artikel(c).forEach((a) => { const worte = schluessel(a.suche || a.name).split(/[\s,]+/).filter((w) => w.length > 1); const n = worte.filter((w) => t.includes(w)).length; if (n > punkte && n >= Math.min(2, worte.length)) { punkte = n; best = a; } });
    return best;
  }
  function mengeAus(text) { const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(stk|stück|bd|bund|rollen?|pak|m|lfm|m²|m³|tafeln?|pal)\b/i); return m ? zahl(m[1]) : 0; }
  function buchen(c, a, menge, art, extra = {}) { Store.neu({ typ: 'lagerbuchung', artikel: a.id, menge, art, datum: c.heute, pid: c.ich ? c.ich.id : '', ...extra }); }
  function nachbestellen(c, a, grund) {
    if (c.typ('material').some((m) => m.status === 'offen' && m.lagerArtikel === a.id)) return meldung('Steht schon auf der Bestellliste.');
    Store.neu({ typ: 'material', pid: c.ich ? c.ich.id : '', datum: c.heute, bs: '', text: `${a.nachbestellMenge || ''} ${a.einheit} ${a.name}`.trim(), positionen: [{ menge: a.nachbestellMenge || 1, einheit: a.einheit, text: a.name }], lieferant: a.lieferant || '', lagerArtikel: a.id, quelle: grund, status: 'offen' });
    meldung(`${a.name} steht auf der Bestellliste${a.lieferant ? ' für ' + a.lieferant : ''}.`);
  }
  function lagerSeite(c) {
    const liste = artikel(c).map((a) => ({ a, b: bestand(c, a.id) }));
    const knapp = liste.filter((x) => !x.a.zweiKisten && x.a.min && x.b <= x.a.min);
    const offenBest = c.typ('lagerbuchung').filter((b) => b.art === 'abgang' && !b.bestaetigt);
    const gezaehlt = (a) => c.typ('lagerbuchung').filter((b) => b.artikel === a.id && b.art === 'zaehlung').sort((x, y) => y.datum.localeCompare(x.datum))[0];
    const wert = liste.reduce((s, x) => s + Math.max(0, x.b) * (Number(x.a.ek) || 0), 0);
    return seitenkopf('Lager', 'Bestand führt sich aus Lieferscheinen und Baustellen. Gezählt wird nur stichprobenweise.', `<button class="k" data-a="lager-eingang">${Icon('liefer')} Wareneingang</button><button class="k" data-a="lager-zaehlen">Stichprobe zählen</button><button class="k haupt" data-a="lager-entnahme">${Icon('material')} Für Baustelle</button>`)
      + `<div class="kacheln">
        <div class="kachel ${knapp.length ? 'achtung' : ''}"><div class="titel">Unter Mindestbestand</div><div class="wert">${knapp.length}</div><div class="fuss">${knapp.map((x) => esc(x.a.name)).join(', ') || 'alles da'}</div></div>
        <div class="kachel"><div class="titel">Warten auf Bestätigung</div><div class="wert">${offenBest.length}</div><div class="fuss">Entnahmen, die auf der Baustelle noch bestätigt werden</div></div>
        <div class="kachel"><div class="titel">Lagerwert</div><div class="wert">${Zahl.eur(wert)}</div><div class="fuss">zum Einkaufspreis</div></div></div>
      <div class="karte"><div class="kopf"><h3>Bestand</h3></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Artikel</th><th>Lagerort</th><th class="r">Bestand</th><th class="r">Mindestens</th><th>Zuletzt gezählt</th><th>Händler</th><th></th></tr></thead><tbody>
        ${liste.map(({ a, b }) => { const z = gezaehlt(a); return `<tr><td><b>${esc(a.name)}</b>${a.zweiKisten ? ' <span class="chip info">Zwei Kisten</span>' : ''}</td><td>${esc(a.ort || '')}</td><td class="r num">${a.zweiKisten ? (a.kisteLeer ? '<span class="chip warn">1 Kiste</span>' : '2 Kisten') : `${String(Math.round(b * 10) / 10).replace('.', ',')} ${esc(a.einheit)}`}</td><td class="r num">${a.zweiKisten ? '–' : `${a.min || 0} ${esc(a.einheit)}`}</td><td>${z ? Datum.kurz(z.datum) : '<span style="color:#9aa19c">noch nie</span>'}</td><td>${esc(a.lieferant || '')}</td>
          <td class="r">${a.zweiKisten ? `<button class="k klein" data-a="lager-kiste" data-id="${a.id}">Kiste leer</button>` : (a.min && b <= a.min ? `<button class="k klein" data-a="lager-nach" data-id="${a.id}">Nachbestellen</button>` : '')}</td></tr>`; }).join('') || `<tr><td colspan="7">${leer('Noch keine Artikel.')}</td></tr>`}
      </tbody></table></div></div>
      <div class="karte"><div class="kopf"><h3>Letzte Bewegungen</h3></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Datum</th><th>Artikel</th><th class="r">Menge</th><th>Woher / wohin</th><th>Status</th></tr></thead><tbody>
        ${c.typ('lagerbuchung').sort((x, y) => (y.erstellt || 0) - (x.erstellt || 0)).slice(0, 12).map((b) => { const a = artikel(c).find((x) => x.id === b.artikel) || { name: '?', einheit: '' };
          return `<tr><td>${Datum.kurz(b.datum)}</td><td>${esc(a.name)}</td><td class="r num" style="color:${b.menge < 0 ? '#a23b2e' : '#2f6b45'}">${b.menge > 0 ? '+' : ''}${String(Math.round(b.menge * 10) / 10).replace('.', ',')} ${esc(a.einheit)}</td><td>${esc({ zugang: 'Wareneingang', abgang: 'Baustelle', korrektur: 'Korrektur Baustelle', zaehlung: 'Zählung', kiste: 'Kiste angebrochen' }[b.art] || b.art)}${b.bs ? ' · ' + esc(c.bsName(b.bs)) : ''}${b.quelle ? ` <small style="color:#7a827c">(${esc(b.quelle)})</small>` : ''}</td><td>${b.art === 'abgang' ? (b.bestaetigt ? '<span class="chip ok">bestätigt</span>' : '<span class="chip">offen</span>') : ''}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }
  function eingangFenster(c) {
    const ls = c.typ('lieferschein').filter((l) => !l.eingebucht).sort((a, b) => b.datum.localeCompare(a.datum));
    let zeilen = [];
    const hg = Fenster.oeffne({
      titel: 'Wareneingang buchen', breit: true, bereich: 'ui-buero-fenster',
      inhalt: `<p style="margin:0 0 12px">Positionen aus einem Lieferschein oder der E-Rechnung des Händlers übernehmen. Richtwerk ordnet sie den Lagerartikeln zu, du prüfst nur.</p>
        <div class="reihe"><label class="feld"><span>Lieferschein</span><select id="eg-ls"><option value="">Lieferschein wählen …</option>${ls.map((l) => `<option value="${l.id}">${Datum.kurz(l.datum)} · ${esc(l.lieferant)} ${esc(l.nummer || '')}</option>`).join('')}</select></label>
          <div class="feld"><span>oder E-Rechnung (XRechnung / ZUGFeRD-XML)</span><button class="k" type="button" data-f="xml">${Icon('upload')} Datei wählen</button></div></div>
        <div id="eg-liste"></div><p class="r-hinweis">Ausblick: Datanorm-Dateien und die Schnittstellen der Großhändler (z. B. über IDS-Connect) liefern dieselben Positionen automatisch.</p>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="buchen">Einbuchen</button>`,
      aktionen: {
        xml: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xml,text/xml,application/xml'; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const t = await f.text(); const doc = new DOMParser().parseFromString(t, 'application/xml'); const lines = [...doc.getElementsByTagNameNS('*', 'InvoiceLine')]; zeilen = lines.map((l) => { const name = (l.getElementsByTagNameNS('*', 'Name')[0] || {}).textContent || ''; const menge = zahl(String((l.getElementsByTagNameNS('*', 'InvoicedQuantity')[0] || {}).textContent || '0').replace('.', ',')); return { text: name, menge, a: finde(c, name) }; }); zeigen(); }; inp.click(); },
        buchen: () => {
          $$('#eg-liste tr[data-i]', hg).forEach((tr) => { const z = zeilen[Number(tr.dataset.i)]; const id = $('select', tr).value; const m = zahl($('input', tr).value); const a = artikel(c).find((x) => x.id === id); if (a && m) buchen(c, a, m, 'zugang', { quelle: z.quelle || 'Lieferschein' }); });
          const lsId = $('#eg-ls', hg).value; if (lsId) Store.aendere(lsId, { eingebucht: true });
          Fenster.schliesse(); meldung('Wareneingang gebucht');
        },
      },
    });
    function zeigen() {
      $('#eg-liste', hg).innerHTML = zeilen.length ? `<table class="t"><thead><tr><th>Position</th><th>Lagerartikel</th><th class="r">Menge</th></tr></thead><tbody>${zeilen.map((z, i) => `<tr data-i="${i}"><td>${esc(z.text)}</td><td><select><option value="">nicht ins Lager</option>${artikel(c).filter((a) => !a.zweiKisten).map((a) => `<option value="${a.id}" ${z.a && z.a.id === a.id ? 'selected' : ''}>${esc(a.name)} (${esc(a.einheit)})</option>`).join('')}</select></td><td class="r"><input class="num" style="width:90px;text-align:right" value="${String(z.a && z.a.faktor ? z.menge * z.a.faktor : z.menge).replace('.', ',')}"></td></tr>`).join('')}</tbody></table>` : '';
    }
    $('#eg-ls', hg).addEventListener('change', (e) => { const l = c.items.find((i) => i.id === e.target.value); zeilen = l ? (l.positionen || []).map((p) => { const a = finde(c, p); return { text: p, menge: mengeAus(p), a, quelle: `${l.lieferant} ${l.nummer || ''}`.trim() }; }) : []; zeigen(); });
  }
  function entnahmeFenster(c, vorgabe = []) {
    const hg = Fenster.oeffne({
      titel: 'Material für eine Baustelle', bereich: 'ui-buero-fenster',
      inhalt: `<label class="feld"><span>Baustelle</span><select id="en-bs">${c.baustellenOffen().map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
        <table class="t"><thead><tr><th>Artikel</th><th class="r">Menge</th></tr></thead><tbody>${artikel(c).filter((a) => !a.zweiKisten).map((a) => { const v = vorgabe.find((x) => x.id === a.id); return `<tr data-id="${a.id}"><td>${esc(a.name)} <small style="color:#7a827c">Bestand ${String(Math.round(bestand(c, a.id))).replace('.', ',')} ${esc(a.einheit)}</small></td><td class="r"><input class="num" style="width:90px;text-align:right" value="${v ? String(v.menge).replace('.', ',') : ''}" placeholder="0"> ${esc(a.einheit)}</td></tr>`; }).join('')}</tbody></table>
        <p class="r-hinweis">Die Mitarbeiter auf der Baustelle sehen die Menge in der App und tippen nur „Passt“ oder tragen ein, was es wirklich war.</p>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Buchen</button>`,
      aktionen: { ok: () => { const bs = $('#en-bs', hg).value; let n = 0; $$('tr[data-id]', hg).forEach((tr) => { const m = zahl($('input', tr).value); const a = artikel(c).find((x) => x.id === tr.dataset.id); if (a && m) { buchen(c, a, -m, 'abgang', { bs, quelle: vorgabe.length ? 'Rechner' : 'Entnahme' }); n++; } }); Fenster.schliesse(); meldung(n ? `${n} Artikel für ${c.bsName(bs)} gebucht` : 'Nichts gebucht'); } },
    });
  }
  function zaehlFenster(c) {
    const zuletzt = (a) => (c.typ('lagerbuchung').filter((b) => b.artikel === a.id && b.art === 'zaehlung').sort((x, y) => y.datum.localeCompare(x.datum))[0] || { datum: '0000' }).datum;
    const auswahl = artikel(c).filter((a) => !a.zweiKisten).sort((a, b) => zuletzt(a).localeCompare(zuletzt(b))).slice(0, Number(c.R.p('lager').stichprobe) || 4);
    const hg = Fenster.oeffne({
      titel: 'Stichprobe zählen', bereich: 'ui-buero-fenster',
      inhalt: `<p style="margin:0 0 12px">Heute nur diese ${auswahl.length} Artikel zählen, die am längsten nicht gezählt wurden. So ist über das Jahr alles einmal geprüft, ohne Inventurtag.</p>
        <table class="t"><thead><tr><th>Artikel</th><th>Lagerort</th><th class="r">Laut Buch</th><th class="r">Gezählt</th></tr></thead><tbody>${auswahl.map((a) => `<tr data-id="${a.id}"><td>${esc(a.name)}</td><td>${esc(a.ort || '')}</td><td class="r num">${String(Math.round(bestand(c, a.id) * 10) / 10).replace('.', ',')} ${esc(a.einheit)}</td><td class="r"><input class="num" style="width:90px;text-align:right" placeholder="?"></td></tr>`).join('')}</tbody></table>`,
      fuss: `<button class="k" data-f="zu">Später</button><button class="k haupt" data-f="ok">Zählung speichern</button>`,
      aktionen: { ok: () => { $$('tr[data-id]', hg).forEach((tr) => { const v = $('input', tr).value.trim(); if (v === '') return; const a = artikel(c).find((x) => x.id === tr.dataset.id); buchen(c, a, zahl(v) - bestand(c, a.id), 'zaehlung', { gezaehlt: zahl(v) }); }); Fenster.schliesse(); meldung('Zählung gespeichert, Bestand angepasst'); } },
    });
  }
  /* App: offene Entnahmen auf der Baustelle bestätigen */
  function appLagerKarte(c, bs) {
    const offen = c.typ('lagerbuchung').filter((b) => b.art === 'abgang' && !b.bestaetigt && b.bs === bs);
    if (!offen.length) return '';
    return `<div class="a-titel">Material aus dem Lager</div><div class="a-karte lager-best">${offen.map((b) => { const a = artikel(c).find((x) => x.id === b.artikel) || { name: '?', einheit: '' };
      return `<div class="lb-zeile" data-lb="${b.id}"><div class="text"><b>${String(-b.menge).replace('.', ',')} ${esc(a.einheit)} ${esc(a.name)}</b><small>Stimmt das ungefähr?</small></div><div class="lb-knoepfe"><button class="lb-ok" data-lb-ok="${b.id}">Passt</button><button class="lb-anders" data-lb-anders="${b.id}">Anders</button></div></div>`; }).join('')}</div>`;
  }
  function appKisten(c) {
    const k = artikel(c).filter((a) => a.zweiKisten);
    return k.length ? `<div class="a-titel">Kiste leer? Ein Tipp genügt</div><div class="a-karte kisten">${k.map((a) => `<button class="kiste-knopf ${a.kisteLeer ? 'leer' : ''}" data-kiste="${a.id}"><b>${esc(a.name)}</b><small>${a.kisteLeer ? 'schon gemeldet' : esc(a.ort || 'Lager')}</small></button>`).join('')}</div>` : '';
  }
  function kisteLeer(c, id) {
    const a = artikel(c).find((x) => x.id === id); if (!a) return;
    if (a.kisteLeer) return meldung('Ist schon gemeldet. Die volle Kiste ist bestellt.');
    Store.speichereCfg({ ...Store.cfg, lager: artikel(c).map((x) => (x.id === id ? { ...x, kisteLeer: c.heute } : x)) });
    nachbestellen(c, a, 'Zwei-Kisten');
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-lb-ok],[data-lb-anders],[data-kiste],[data-lb-speichern]'); if (!t) return;
    e.preventDefault(); e.stopPropagation(); const c = ctxJetzt();
    if (t.dataset.kiste) return kisteLeer(c, t.dataset.kiste);
    if (t.dataset.lbOk) { Store.aendere(t.dataset.lbOk, { bestaetigt: Date.now(), bestaetigtVon: c.ich.id }); return meldung('Danke'); }
    if (t.dataset.lbAnders) { const z = t.closest('.lb-zeile'); const b = c.items.find((i) => i.id === t.dataset.lbAnders); z.querySelector('.lb-knoepfe').innerHTML = `<input class="lb-menge" inputmode="decimal" value="${String(-b.menge).replace('.', ',')}" aria-label="Tatsächliche Menge"><button class="lb-ok" data-lb-speichern="${b.id}">OK</button>`; z.querySelector('.lb-menge').select(); return; }
    if (t.dataset.lbSpeichern) { const b = c.items.find((i) => i.id === t.dataset.lbSpeichern); const echt = zahl(t.closest('.lb-zeile').querySelector('.lb-menge').value); const diff = -echt - b.menge; if (diff) Store.neu({ typ: 'lagerbuchung', artikel: b.artikel, menge: diff, art: 'korrektur', bs: b.bs, datum: c.heute, pid: c.ich.id }); Store.aendere(b.id, { bestaetigt: Date.now(), bestaetigtVon: c.ich.id }); meldung('Korrigiert'); }
  }, true);

  /* ---------- Aufgaben in der Übersicht ---------- */
  function aufgaben(c) {
    const out = [];
    if (c.R.hat('rechnungen')) c.typ('rechnung').forEach((r) => { const m = mahnstand(c, r); if (m && m.naechste !== null) out.push({ titel: `${STUFEN[m.naechste]} fällig: ${r.nr}`, unter: `${r.kunde} · ${m.tage} Tage über Ziel`, a: 'mahnen', id: r.id }); });
    if (c.R.hat('lager')) artikel(c).filter((a) => !a.zweiKisten && a.min && bestand(c, a.id) <= a.min && !c.typ('material').some((m) => m.status === 'offen' && m.lagerArtikel === a.id)).forEach((a) => out.push({ titel: `Nachbestellen: ${a.name}`, unter: `Noch ${Math.round(bestand(c, a.id))} ${a.einheit}, Mindestbestand ${a.min}`, a: 'lager-nach', id: a.id }));
    if (c.R.hat('nachrichten')) { const n = c.arbeiter().reduce((s, p) => s + ungelesen(c, p.id, true), 0); if (n) out.push({ titel: `${n} neue ${n === 1 ? 'Nachricht' : 'Nachrichten'}`, unter: 'von Mitarbeitern', a: 'gehe', id: 'nachrichten' }); }
    return out;
  }

  Buero.erweitern({
    nav: [
      { id: 'kunden', name: 'Kunden', icon: 'person', braucht: 'kunden', gruppe: 'Aufträge' },
      { id: 'kalender', name: 'Kalender', icon: 'kalender', braucht: 'kalender', gruppe: 'Betrieb' },
      { id: 'nachrichten', name: 'Nachrichten', icon: 'angebot', braucht: 'nachrichten', gruppe: 'Betrieb', zahl: (o, c) => c.arbeiter().reduce((s, p) => s + ungelesen(c, p.id, true), 0) },
      { id: 'lager', name: 'Lager', icon: 'material', braucht: 'lager', gruppe: 'Unterlagen', zahl: (o, c) => artikel(c).filter((a) => !a.zweiKisten && a.min && bestand(c, a.id) <= a.min).length },
    ],
    seiten: { kunden: kundenSeite, kalender: kalenderSeite, nachrichten: chatSeite, lager: lagerSeite },
    aktionen: {
      kunde(el) { zustand.kunde = el.dataset.id; Buero.zeigeSeite('kunden'); },
      'kunde-zurueck'() { zustand.kunde = null; Buero.neuZeichnen(); },
      'kunde-neu'(el, c) { kundeFenster(c); },
      'kunde-bearbeiten'(el, c) { kundeFenster(c, c.items.find((i) => i.id === el.dataset.id)); },
      'kunde-angebot'(el, c) { const k = c.items.find((i) => i.id === el.dataset.id); Auftraege.editor(c, { typ: 'angebot', status: 'entwurf', kunde: k.name, kundeId: k.id, kundenart: k.art, adresse: k.adresse, email: k.email, telefon: k.telefon, positionen: [{ text: '', menge: 1, einheit: 'm²', preis: '' }] }); },
      'angebot-senden'(el, c) { const a = c.items.find((i) => i.id === el.dataset.id); if (a) versenden(c, a); },
      mahnen(el, c) { const r = c.items.find((i) => i.id === el.dataset.id); if (r) mahnFenster(c, r); },
      'kal-monat'(el) { const [j, m] = zustand.monat.split('-').map(Number); zustand.monat = Datum.iso(new Date(j, m - 1 + Number(el.dataset.id), 1)).slice(0, 7); Buero.neuZeichnen(); },
      'kal-heute'() { zustand.monat = Datum.heute().slice(0, 7); zustand.tag = Datum.heute(); Buero.neuZeichnen(); },
      'kal-tag'(el) { zustand.tag = el.dataset.id; Buero.neuZeichnen(); },
      'chat-person'(el) { zustand.chat = el.dataset.id; Buero.neuZeichnen(); },
      'lager-eingang'(el, c) { eingangFenster(c); },
      'lager-entnahme'(el, c) { entnahmeFenster(c); },
      'lager-zaehlen'(el, c) { zaehlFenster(c); },
      'lager-nach'(el, c) { const a = artikel(c).find((x) => x.id === el.dataset.id); if (a) nachbestellen(c, a, 'Mindestbestand'); },
      'lager-kiste'(el, c) { kisteLeer(c, el.dataset.id); },
    },
    aufgaben,
  });
  document.addEventListener('input', (e) => { if (e.target.id !== 'kunden-suche') return; zustand.suche = e.target.value; const pos = e.target.selectionStart; Buero.neuZeichnen(); setTimeout(() => { const i = $('#kunden-suche'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 0); });

  return { kundeSichern, versenden, mahnstand, mahnFenster, STUFEN, appLagerKarte, appKisten, entnahmeFenster, artikel, bestand, ungelesen, wetter };
})();
