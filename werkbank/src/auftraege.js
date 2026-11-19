/* =========================================================================
   Angebote und Rechnungen (Büro)
   Ablauf: Angebot (Entwurf → gesendet → angenommen/abgelehnt)
           → angenommen: Baustelle wird angelegt
           → Rechnung aus dem Angebot, unterschriebene Regiezettel dazu
           → gestellt (Nummer fest, nicht mehr änderbar) → bezahlt
   Dokumente werden als HTML erzeugt, gedruckt (oder als PDF gespeichert)
   und als E-Rechnung im XRechnung-Format (UBL) heruntergeladen.
   ========================================================================= */
const Auftraege = (() => {
  const EINHEITEN = ['Stk', 'm', 'm²', 'm³', 'lfm', 'Std', 'psch', 'kg', 't'];
  const zustand = { filter: 'offen' };
  const { seitenkopf, leer } = Buero.teile;

  /* ---------- Rechnen ---------- */
  const zahl = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
  const rund = (n) => Math.round(n * 100) / 100;
  function summen(doc, mwst) {
    const netto = rund((doc.positionen || []).reduce((s, p) => s + rund(zahl(p.menge) * zahl(p.preis)), 0));
    const steuer = rund(netto * mwst / 100);
    const lohn = rund((doc.positionen || []).filter((p) => p.einheit === 'Std' || p.lohn).reduce((s, p) => s + rund(zahl(p.menge) * zahl(p.preis)), 0));
    return { netto, steuer, brutto: rund(netto + steuer), lohn };
  }
  const mwstVon = (c, d) => (d.mwst !== undefined ? Number(d.mwst) : Number(c.R.p('angebote').mwst));
  function naechsteNummer(c, typ) {
    const praefix = (c.R.p(typ === 'angebot' ? 'angebote' : 'rechnungen').praefix || (typ === 'angebot' ? 'A' : 'R')).trim();
    const jahr = c.heute.slice(0, 4); const kopf = `${praefix}-${jahr}-`;
    const max = c.typ(typ).map((d) => d.nr || '').filter((n) => n.startsWith(kopf)).reduce((m, n) => Math.max(m, Number(n.slice(kopf.length)) || 0), 0);
    return kopf + String(max + 1).padStart(3, '0');
  }
  function katalog(c) {
    return String(c.R.p('angebote').katalog || '').split('\n').map((z) => z.split('|').map((s) => s.trim())).filter((t) => t[0]).map(([text, einheit, preis]) => ({ text, einheit: einheit || 'Stk', preis: zahl(preis) }));
  }
  const ueberfaellig = (c, r) => r.status === 'gestellt' && r.faellig && r.faellig < c.heute;
  const tageUeber = (c, r) => Math.round((Datum.von(c.heute) - Datum.von(r.faellig)) / 864e5);

  const STATUS = {
    entwurf: ['Entwurf', ''], gesendet: ['Gesendet', 'info'], angenommen: ['Angenommen', 'ok'], abgelehnt: ['Abgelehnt', 'bad'],
    gestellt: ['Offen', 'warn'], bezahlt: ['Bezahlt', 'ok'], storniert: ['Storniert', ''],
  };
  const chipDoc = (c, d) => {
    if (d.typ === 'rechnung' && ueberfaellig(c, d)) return `<span class="chip bad">${tageUeber(c, d)} Tage überfällig</span>`;
    const [t, k] = STATUS[d.status] || [d.status, '']; return `<span class="chip ${k}">${esc(t)}</span>`;
  };

  /* ---------- Seiten ---------- */
  function angeboteSeite(c) {
    const alle = c.typ('angebot').sort((a, b) => (b.nr || '').localeCompare(a.nr || '') || b.erstellt - a.erstellt);
    const f = zustand.filter;
    const liste = alle.filter((a) => (f === 'offen' ? ['entwurf', 'gesendet'].includes(a.status) : f === 'alle' ? true : a.status === f));
    const offenSumme = alle.filter((a) => a.status === 'gesendet').reduce((s, a) => s + summen(a, mwstVon(c, a)).netto, 0);
    const quote = (() => { const ent = alle.filter((a) => ['angenommen', 'abgelehnt'].includes(a.status)); return ent.length ? Math.round(100 * ent.filter((a) => a.status === 'angenommen').length / ent.length) : null; })();
    const tabs = [['offen', 'Offen'], ['angenommen', 'Angenommen'], ['abgelehnt', 'Abgelehnt'], ['alle', 'Alle']];
    return seitenkopf(esc(c.R.name('angebote')), 'Angebote schreiben, nachfassen und in Aufträge umwandeln', `<button class="k haupt" data-a="angebot-neu">${Icon('plus')} Neues Angebot</button>`)
      + `<div class="kacheln">
        <div class="kachel"><div class="titel">Warten auf Antwort</div><div class="wert">${alle.filter((a) => a.status === 'gesendet').length}</div><div class="fuss">${Zahl.eur(offenSumme)} netto</div></div>
        <div class="kachel"><div class="titel">Angenommen ${c.heute.slice(0, 4)}</div><div class="wert">${Zahl.eur(alle.filter((a) => a.status === 'angenommen' && (a.entschieden || a.datum).toString().slice(0, 4) >= c.heute.slice(0, 4)).reduce((s, a) => s + summen(a, mwstVon(c, a)).netto, 0))}</div><div class="fuss">netto</div></div>
        <div class="kachel"><div class="titel">Annahmequote</div><div class="wert">${quote === null ? '–' : quote + ' %'}</div><div class="fuss">der entschiedenen Angebote</div></div>
      </div>
      <div class="karte"><div class="kopf"><span class="segment">${tabs.map(([k, t]) => `<button class="${f === k ? 'an' : ''}" data-a="auf-filter" data-id="${k}">${t}</button>`).join('')}</span></div>
      ${liste.length ? `<div class="tabelle-huelle"><table class="t"><thead><tr><th>Nummer</th><th>Datum</th><th>Kunde</th><th>Betreff</th><th class="r">Netto</th><th>Status</th></tr></thead><tbody>
        ${liste.map((a) => { const alt = a.status === 'gesendet' && a.gueltigBis && a.gueltigBis < c.heute;
          return `<tr class="klickbar" data-a="angebot" data-id="${a.id}"><td class="mono">${esc(a.nr || '–')}</td><td>${Datum.kurz(a.datum)}</td><td>${esc(a.kunde)}</td><td>${esc(a.betreff)}</td><td class="r num">${Zahl.eur(summen(a, mwstVon(c, a)).netto)}</td><td>${chipDoc(c, a)}${alt ? ' <span class="chip warn">abgelaufen</span>' : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : leer(f === 'offen' ? 'Keine offenen Angebote.' : 'Keine Angebote in dieser Auswahl.')}</div>`;
  }

  function rechnungenSeite(c) {
    const alle = c.typ('rechnung').sort((a, b) => (b.nr || '~').localeCompare(a.nr || '~') || b.erstellt - a.erstellt);
    const f = zustand.filter === 'angenommen' || zustand.filter === 'abgelehnt' ? 'offen' : zustand.filter;
    const liste = alle.filter((r) => (f === 'offen' ? ['entwurf', 'gestellt'].includes(r.status) : f === 'alle' ? true : r.status === f));
    const offen = alle.filter((r) => r.status === 'gestellt'); const ueber = offen.filter((r) => ueberfaellig(c, r));
    const brutto = (r) => summen(r, mwstVon(c, r)).brutto;
    const monat = c.heute.slice(0, 7);
    return seitenkopf(esc(c.R.name('rechnungen')), 'Rechnungen stellen, Zahlungseingänge abhaken, säumige Kunden erinnern', `<button class="k" data-a="rechnung-export" title="Rechnungsliste und E-Rechnungen für Buchhaltung oder Steuerbüro">${Icon('download')} Für die Buchhaltung</button><button class="k haupt" data-a="rechnung-neu">${Icon('plus')} Neue Rechnung</button>`)
      + `<div class="kacheln">
        <div class="kachel ${ueber.length ? 'achtung' : ''}"><div class="titel">Offene Posten</div><div class="wert">${Zahl.eur(offen.reduce((s, r) => s + brutto(r), 0))}</div><div class="fuss">${offen.length} Rechnungen${ueber.length ? `, davon ${ueber.length} überfällig` : ''}</div></div>
        <div class="kachel"><div class="titel">Gestellt ${esc(Datum.monatName(monat).split(' ')[0])}</div><div class="wert">${Zahl.eur(alle.filter((r) => r.status !== 'entwurf' && r.status !== 'storniert' && (r.datum || '').startsWith(monat)).reduce((s, r) => s + summen(r, mwstVon(c, r)).netto, 0))}</div><div class="fuss">netto</div></div>
        <div class="kachel"><div class="titel">Bezahlt ${esc(Datum.monatName(monat).split(' ')[0])}</div><div class="wert">${Zahl.eur(alle.filter((r) => r.status === 'bezahlt' && (r.bezahltAm || '').startsWith(monat)).reduce((s, r) => s + brutto(r), 0))}</div><div class="fuss">brutto eingegangen</div></div>
      </div>
      <div class="karte"><div class="kopf"><span class="segment">${[['offen', 'Offen'], ['bezahlt', 'Bezahlt'], ['alle', 'Alle']].map(([k, t]) => `<button class="${f === k ? 'an' : ''}" data-a="auf-filter" data-id="${k}">${t}</button>`).join('')}</span></div>
      ${liste.length ? `<div class="tabelle-huelle"><table class="t"><thead><tr><th>Nummer</th><th>Datum</th><th>Kunde</th><th>Betreff</th><th class="r">Brutto</th><th>Fällig</th><th>Status</th></tr></thead><tbody>
        ${liste.map((r) => `<tr class="klickbar" data-a="rechnung" data-id="${r.id}"><td class="mono">${esc(r.nr || 'Entwurf')}</td><td>${r.datum ? Datum.kurz(r.datum) : '–'}</td><td>${esc(r.kunde)}</td><td>${esc(r.betreff)}</td><td class="r num">${Zahl.eur(brutto(r))}</td><td>${r.faellig ? Datum.kurz(r.faellig) : '–'}</td><td>${chipDoc(c, r)}</td></tr>`).join('')}
      </tbody></table></div>` : leer('Keine Rechnungen in dieser Auswahl.')}</div>`;
  }

  /* ---------- Dokument (Ansicht = Druck) ---------- */
  function absender(c) { const f = c.cfg; return [f.name, f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join(' · '); }
  function dokumentHtml(c, d, art) {
    const f = c.cfg; const mwst = mwstVon(c, d); const s = summen(d, mwst);
    const titel = { angebot: 'Angebot', bestaetigung: 'Auftragsbestätigung', rechnung: 'Rechnung', erinnerung: 'Zahlungserinnerung' }[art];
    const istRechnung = art === 'rechnung' || art === 'erinnerung';
    const text = (t) => esc(t || '').replace(/\n/g, '<br>');
    const einleitung = art === 'angebot' ? c.R.p('angebote').einleitung : art === 'bestaetigung' ? 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihren Auftrag. Hiermit bestätigen wir die Ausführung folgender Arbeiten:' : art === 'erinnerung' ? `Sehr geehrte Damen und Herren,\nsicher ist es Ihrer Aufmerksamkeit entgangen: Unsere Rechnung ${d.nr} vom ${Datum.kurz(d.datum)}${d.datum.slice(0, 4)} über ${Zahl.eur(s.brutto)} war am ${Datum.kurz(d.faellig)}${d.faellig.slice(0, 4)} fällig. Bitte überweisen Sie den Betrag innerhalb der nächsten 7 Tage.` : 'Sehr geehrte Damen und Herren,\nfür die ausgeführten Arbeiten erlauben wir uns, wie folgt zu berechnen:';
    const schluss = art === 'angebot' ? `${c.R.p('angebote').schluss}${c.R.an('angebote', 'agbAnhang') ? '\nEs gelten unsere Allgemeinen Geschäftsbedingungen (Anlage).' : ''}` : istRechnung ? `Zahlbar bis ${Datum.kurz(d.faellig || c.heute)}${(d.faellig || c.heute).slice(0, 4)} ohne Abzug.\n${c.R.p('rechnungen').schluss}` : 'Wir freuen uns auf die Zusammenarbeit.';
    const datum = art === 'erinnerung' ? c.heute : (d.datum || c.heute);
    const meta = [[`${titel === 'Zahlungserinnerung' ? 'Rechnung' : titel}-Nr.`, d.nr || 'Entwurf'], ['Datum', Datum.kurz(datum) + datum.slice(0, 4)],
      ...(art === 'angebot' && d.gueltigBis ? [['Gültig bis', Datum.kurz(d.gueltigBis) + d.gueltigBis.slice(0, 4)]] : []),
      ...(istRechnung && d.leistung ? [['Leistungszeitraum', d.leistung]] : []),
      ...(d.angebotNr && art !== 'angebot' ? [['Zu Angebot', d.angebotNr]] : [])];
    const pos = (d.positionen || []).map((p, i) => `<tr><td>${i + 1}</td><td>${text(p.text)}</td><td class="r num">${String(zahl(p.menge)).replace('.', ',')} ${esc(p.einheit)}</td><td class="r num">${Zahl.eur(zahl(p.preis))}</td><td class="r num">${Zahl.eur(rund(zahl(p.menge) * zahl(p.preis)))}</td></tr>`).join('');
    const privat = d.kundenart !== 'gewerblich';
    return `<div class="dokument">
      <div class="d-kopf"><div class="d-firma"><b>${esc(f.name)}</b><span>${esc(f.zusatz || '')}</span></div><div class="d-adresse">${[f.strasse, [f.plz, f.ort].filter(Boolean).join(' '), f.telefon && 'Tel. ' + f.telefon, f.email].filter(Boolean).map(esc).join('<br>')}</div></div>
      <div class="d-mitte"><div class="d-empf"><small>${esc(absender(c))}</small>${esc(d.kunde || '')}<br>${text(d.adresse)}</div>
        <dl class="d-meta">${meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
      <h2>${titel}${d.betreff ? ': ' + esc(d.betreff) : ''}</h2>
      <p>${text(einleitung)}</p>
      ${art === 'erinnerung' ? '' : `<table class="d-pos"><thead><tr><th>Pos.</th><th>Leistung</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Gesamt</th></tr></thead><tbody>${pos}</tbody></table>
      <table class="d-summe"><tr><td>Summe netto</td><td class="r num">${Zahl.eur(s.netto)}</td></tr><tr><td>zzgl. ${mwst} % MwSt.</td><td class="r num">${Zahl.eur(s.steuer)}</td></tr><tr class="gesamt"><td>Gesamtbetrag</td><td class="r num">${Zahl.eur(s.brutto)}</td></tr></table>`}
      ${istRechnung && art === 'rechnung' && privat && c.R.an('rechnungen', 'lohnanteil') && s.lohn ? `<p class="d-klein">Im Rechnungsbetrag enthaltene Arbeitskosten (§ 35a EStG): ${Zahl.eur(s.lohn)} netto zzgl. ${Zahl.eur(rund(s.lohn * mwst / 100))} MwSt.</p>` : ''}
      ${istRechnung && art === 'rechnung' && privat ? '<p class="d-klein">Sie sind gesetzlich verpflichtet, diese Rechnung zwei Jahre aufzubewahren (§ 14b UStG).</p>' : ''}
      <p>${text(schluss)}</p><p>Mit freundlichen Grüßen<br>${esc(f.inhaber || f.name)}</p>
      ${art === 'bestaetigung' ? onlineBlock(d) : ''}
      <div class="d-fuss"><span>${esc(f.name)}${f.inhaber ? ', Inh. ' + esc(f.inhaber) : ''}</span><span>${f.steuernr ? 'St.-Nr. ' + esc(f.steuernr) : ''}${f.ustid ? ' · USt-IdNr. ' + esc(f.ustid) : ''}</span><span>${f.bank ? esc(f.bank) + ' · ' : ''}${f.iban ? 'IBAN ' + esc(f.iban) : ''}</span></div>
      ${art === 'angebot' && c.R.an('angebote', 'agbAnhang') ? `<div class="d-agb"><h3>Allgemeine Geschäftsbedingungen</h3><p>${text(c.R.p('angebote').agb)}</p></div>` : ''}
    </div>`;
  }

  /* ---------- E-Rechnung (XRechnung, UBL-Syntax) ---------- */
  const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const betrag = (n) => rund(n).toFixed(2);
  const EINHEIT_CODE = { Stk: 'H87', m: 'MTR', 'm²': 'MTK', 'm³': 'MTQ', lfm: 'MTR', Std: 'HUR', psch: 'LS', kg: 'KGM', t: 'TNE' };
  function xrechnung(c, r) {
    const f = c.cfg; const mwst = mwstVon(c, r); const s = summen(r, mwst);
    const adr = (strasse, plzort) => { const m = String(plzort || '').match(/^(\d{5})\s+(.*)$/); return `<cac:PostalAddress><cbc:StreetName>${x(strasse)}</cbc:StreetName><cbc:CityName>${x(m ? m[2] : plzort)}</cbc:CityName><cbc:PostalZone>${x(m ? m[1] : '')}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`; };
    const [kStrasse, ...kRest] = String(r.adresse || '').split('\n');
    const zeilen = (r.positionen || []).map((p, i) => `
  <cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="${EINHEIT_CODE[p.einheit] || 'C62'}">${zahl(p.menge)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">${betrag(zahl(p.menge) * zahl(p.preis))}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${x(String(p.text).split('\n')[0].slice(0, 100))}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${mwst}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${betrag(zahl(p.preis))}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${x(r.nr)}</cbc:ID><cbc:IssueDate>${r.datum}</cbc:IssueDate><cbc:DueDate>${r.faellig}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${r.leistung ? `<cbc:Note>Leistungszeitraum: ${x(r.leistung)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cbc:BuyerReference>${x(r.leitweg || r.nr)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty><cac:Party>${f.email ? `<cbc:EndpointID schemeID="EM">${x(f.email)}</cbc:EndpointID>` : ''}<cac:PartyName><cbc:Name>${x(f.name)}</cbc:Name></cac:PartyName>${adr(f.strasse, [f.plz, f.ort].filter(Boolean).join(' '))}
    ${f.ustid ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(f.ustid)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}${f.steuernr ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(f.steuernr)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
    <cac:PartyLegalEntity><cbc:RegistrationName>${x(f.name)}</cbc:RegistrationName></cac:PartyLegalEntity>
    <cac:Contact><cbc:Name>${x(f.inhaber || f.name)}</cbc:Name><cbc:Telephone>${x(f.telefon || '')}</cbc:Telephone><cbc:ElectronicMail>${x(f.email || '')}</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>${r.email ? `<cbc:EndpointID schemeID="EM">${x(r.email)}</cbc:EndpointID>` : ''}<cac:PartyName><cbc:Name>${x(r.kunde)}</cbc:Name></cac:PartyName>${adr(kStrasse, kRest.join(' '))}
    <cac:PartyLegalEntity><cbc:RegistrationName>${x(r.kunde)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>${x(r.nr)}</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>${x(String(f.iban || '').replace(/\s+/g, ''))}</cbc:ID><cbc:Name>${x(f.name)}</cbc:Name></cac:PayeeFinancialAccount></cac:PaymentMeans>
  <cac:PaymentTerms><cbc:Note>Zahlbar bis ${x(r.faellig)} ohne Abzug.</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${betrag(s.steuer)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${betrag(s.netto)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${betrag(s.steuer)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${mwst}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${betrag(s.netto)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${betrag(s.netto)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${betrag(s.brutto)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">${betrag(s.brutto)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${zeilen}
</ubl:Invoice>
`;
  }

  /* Angenommenes Angebot → Baustelle (aus dem Büro und bei der Online-Annahme) */
  function baustelleAusAngebot(a) {
    const bs = Store.uid('b'); const [strasse, ...rest] = String(a.adresse || '').split('\n');
    const ort = (rest.join(' ').match(/\d{5}\s+(.*)/) || [])[1] || rest.join(' ');
    Store.speichereCfg({ ...Store.cfg, baustellen: [...(Store.cfg.baustellen || []), { id: bs, name: a.betreff || a.kunde, kunde: a.kunde, adresse: [strasse, rest.join(' ')].filter(Boolean).join(', '), ort, telefon: a.telefon || '', arbeit: a.betreff, status: 'geplant', notiz: `Auftrag aus Angebot ${a.nr}` }] });
    return bs;
  }
  /* Link, den der Kunde bekommt. Der Schlüssel im Link verhindert, dass man fremde Angebote durch Raten öffnet. */
  const kundenLink = (fid, a) => `${location.href.split('#')[0]}#angebot/${fid}/${a.id}/${a.schluessel}`;
  const offeneFragen = (a) => (a.fragen || []).filter((f) => !f.erledigt);
  function onlineBlock(a) {
    const o = a.angenommenOnline; if (!o) return '';
    const z = new Date(o.wann);
    return `<p class="d-klein d-online">Online angenommen am ${Datum.kurz(Datum.iso(z))}${Datum.iso(z).slice(0, 4)} um ${String(z.getHours()).padStart(2, '0')}:${String(z.getMinutes()).padStart(2, '0')} Uhr von ${esc(o.name)}. AGB akzeptiert${o.widerruf === 'belehrung' ? ', Widerrufsbelehrung erhalten' + (o.beginnVorFrist ? ', Beginn vor Ablauf der Widerrufsfrist verlangt' : '') : o.widerruf === 'massanfertigung' ? ', Hinweis Maßanfertigung bestätigt' : ''}.</p>${o.unterschrift ? `<img class="d-unterschrift" data-datei="${esc(o.unterschrift)}" alt="Unterschrift ${esc(o.name)}">` : ''}`;
  }

  /* ---------- Bearbeiten (Angebot und Rechnung teilen sich den Editor) ---------- */
  function positionZeile(p, i, gesperrt) {
    const dis = gesperrt ? 'disabled' : '';
    return `<tr data-pos="${i}"><td class="num">${i + 1}</td><td><textarea class="p-text" rows="1" ${dis} aria-label="Leistung Position ${i + 1}">${esc(p.text || '')}</textarea></td>
      <td><input class="p-menge num" inputmode="decimal" value="${esc(String(p.menge ?? '').replace('.', ','))}" ${dis} aria-label="Menge"></td>
      <td><select class="p-einheit" ${dis} aria-label="Einheit">${EINHEITEN.map((e) => `<option ${e === p.einheit ? 'selected' : ''}>${e}</option>`).join('')}</select></td>
      <td><input class="p-preis num" inputmode="decimal" value="${esc(p.preis !== undefined && p.preis !== '' ? String(rund(zahl(p.preis))).replace('.', ',') : '')}" ${dis} aria-label="Einzelpreis in Euro"></td>
      <td class="r num p-gesamt">${Zahl.eur(rund(zahl(p.menge) * zahl(p.preis)))}</td>
      <td>${gesperrt ? '' : `<button class="k klein" type="button" data-f="pos-weg" data-id="${i}" aria-label="Position ${i + 1} entfernen">${Icon('x')}</button>`}</td></tr>`;
  }
  function editor(c, d) {
    const istR = d.typ === 'rechnung'; const gesperrt = istR && d.status !== 'entwurf';
    const kat = katalog(c);
    const regieOffen = istR && d.bs && c.R.verb('regie', 'rechnungen') ? c.typ('regie').filter((r) => r.bs === d.bs && r.status === 'unterschrieben') : [];
    let positionen = JSON.parse(JSON.stringify(d.positionen || []));
    const dis = gesperrt ? 'disabled' : '';
    const titel = istR ? (d.nr ? `Rechnung ${esc(d.nr)}` : 'Rechnung (Entwurf)') : (d.nr ? `Angebot ${esc(d.nr)}` : 'Neues Angebot');
    const knoepfe = [];
    if (!istR) {
      if (d.id && ['entwurf', 'gesendet'].includes(d.status)) knoepfe.push(`<button class="k nein" data-f="status" data-id="abgelehnt">Abgelehnt</button><button class="k ok" data-f="status" data-id="angenommen">${Icon('haken')} Angenommen</button>`);
      if (d.status === 'entwurf' || !d.id) knoepfe.push(`<button class="k" data-f="status" data-id="gesendet">Als gesendet markieren</button>`);
      if (['entwurf', 'gesendet'].includes(d.status || 'entwurf') && c.R.an('angebote', 'onlineAnnahme')) knoepfe.push(`<button class="k" data-f="link">${Icon('wolke')} Link für den Kunden</button>`);
      if (d.status === 'angenommen' && c.R.an('angebote', 'bestaetigung')) knoepfe.push(`<button class="k" data-f="drucken" data-id="bestaetigung">${Icon('drucken')} Auftragsbestätigung</button>`);
      if (d.status === 'angenommen' && c.R.verb('angebote', 'rechnungen')) knoepfe.push(`<button class="k haupt" data-f="zur-rechnung">${Icon('rechnung')} Rechnung erstellen</button>`);
    } else {
      if (d.status === 'entwurf') knoepfe.push(`<button class="k haupt" data-f="stellen">${Icon('haken')} Rechnung stellen</button>`);
      if (d.status === 'gestellt') knoepfe.push(`<button class="k" data-f="storno">Stornieren</button>`, ueberfaellig(c, d) ? `<button class="k" data-f="drucken" data-id="erinnerung">${Icon('drucken')} Zahlungserinnerung</button>` : '', `<button class="k ok" data-f="bezahlt">${Icon('haken')} Bezahlt</button>`);
      if (d.status !== 'entwurf' && c.R.p('rechnungen').erechnung !== 'aus') knoepfe.push(`<button class="k" data-f="xml">${Icon('download')} E-Rechnung</button>`);
    }
    const hg = Fenster.oeffne({
      titel, breit: true, bereich: 'ui-buero-fenster',
      inhalt: `${!istR && offeneFragen(d).length ? offeneFragen(d).map((q) => `<div class="kundenfrage"><div><b>Frage von ${esc(d.kunde)}</b> <small>${Datum.kurz(Datum.iso(new Date(q.wann)))}</small><p>${esc(q.text)}</p></div><button class="k klein" data-f="frage-erledigt" data-id="${q.wann}">Erledigt</button></div>`).join('') : ''}
        ${!istR && d.angenommenOnline ? `<div class="hinweis-zeile online-ok">${onlineBlock(d)}</div>` : ''}
        ${gesperrt ? `<p class="hinweis-zeile">${d.status === 'bezahlt' ? `Bezahlt am ${Datum.kurz(d.bezahltAm)}.` : d.status === 'storniert' ? 'Storniert.' : `Gestellt am ${Datum.kurz(d.datum)}, fällig am ${Datum.kurz(d.faellig)}.`} Gestellte Rechnungen lassen sich nicht mehr ändern (GoBD). Bei Fehlern stornieren und neu stellen.</p>` : ''}
        <div class="reihe"><label class="feld"><span>Kunde</span><input name="kunde" value="${esc(d.kunde || '')}" ${dis} placeholder="Name oder Firma"></label>
          <label class="feld"><span>Kundenart</span><select name="kundenart" ${dis}><option value="privat" ${d.kundenart !== 'gewerblich' ? 'selected' : ''}>Privat</option><option value="gewerblich" ${d.kundenart === 'gewerblich' ? 'selected' : ''}>Gewerblich</option></select></label></div>
        <div class="reihe"><label class="feld"><span>Anschrift (Straße, PLZ Ort)</span><textarea name="adresse" rows="2" ${dis}>${esc(d.adresse || '')}</textarea></label>
          <label class="feld"><span>E-Mail (optional)</span><input name="email" type="email" value="${esc(d.email || '')}" ${dis}></label></div>
        <div class="reihe"><label class="feld"><span>Betreff</span><input name="betreff" value="${esc(d.betreff || '')}" ${dis} placeholder="z. B. Dachstuhl Neubau EFH"></label>
          ${istR ? `<label class="feld"><span>Leistungszeitraum</span><input name="leistung" value="${esc(d.leistung || '')}" ${dis} placeholder="z. B. 02.11. bis 13.11.2026"></label>` : `<label class="feld"><span>Baustelle (optional)</span><select name="bs" ${dis}><option value="">neu beim Annehmen</option>${(c.cfg.baustellen || []).map((b) => `<option value="${b.id}" ${b.id === d.bs ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`}</div>
        ${Zusatz.buero(c, d.typ === 'rechnung' ? 'rechnungen' : 'angebote', d.extra, gesperrt)}
        <div class="pos-huelle"><table class="t pos-tabelle"><thead><tr><th>Pos.</th><th>Leistung</th><th style="width:90px">Menge</th><th style="width:90px">Einheit</th><th style="width:110px">Einzelpreis €</th><th class="r" style="width:110px">Gesamt</th><th></th></tr></thead><tbody id="pos-liste"></tbody></table></div>
        ${gesperrt ? '' : `<div class="pos-werkzeug"><button class="k klein" type="button" data-f="pos-neu">${Icon('plus')} Position</button>
          ${kat.length ? `<select id="katalog" aria-label="Aus dem Leistungskatalog übernehmen"><option value="">Aus Katalog übernehmen …</option>${kat.map((k, i) => `<option value="${i}">${esc(k.text)} (${Zahl.eur(k.preis)}/${esc(k.einheit)})</option>`).join('')}</select>` : ''}
          ${regieOffen.length ? `<button class="k klein" type="button" data-f="regie">${Icon('unterschrift')} ${regieOffen.length} Regiezettel übernehmen</button>` : ''}</div>`}
        <div class="pos-summe" id="pos-summe"></div>`,
      fuss: `${d.id && d.status === 'entwurf' ? `<button class="k nein" data-f="loeschen" style="margin-right:auto">${Icon('muell')} Löschen</button>` : '<span style="margin-right:auto"></span>'}
        <button class="k" data-f="drucken" data-id="${istR ? 'rechnung' : 'angebot'}">${Icon('drucken')} Ansehen & drucken</button>${knoepfe.join('')}${gesperrt ? '' : '<button class="k haupt" data-f="speichern">Speichern</button>'}`,
      aktionen: {
        'pos-neu': () => { lesen(); positionen.push({ text: '', menge: 1, einheit: 'Stk', preis: '' }); zeichnen(); $$('.p-text', hg).pop().focus(); },
        'pos-weg': (b) => { lesen(); positionen.splice(Number(b.dataset.id), 1); zeichnen(); },
        regie: () => {
          lesen(); const satz = Number(c.R.p('regie').satz);
          regieOffen.forEach((r) => positionen.push({ text: `Regiearbeit ${Datum.kurz(r.datum)}: ${r.text}${r.material ? ` (Material: ${r.material})` : ''}, lt. Regiebericht`, menge: Number(r.stunden) * Number(r.leute || 1), einheit: 'Std', preis: satz, regie: r.id }));
          zeichnen(); meldung(`${regieOffen.length} Regiezettel übernommen. Sie werden beim Stellen als abgerechnet markiert.`);
          const knopf = $('[data-f=regie]', hg); if (knopf) knopf.remove();
        },
        speichern: () => { const id = sichern(); if (id) { Fenster.schliesse(); meldung('Gespeichert'); } },
        drucken: (b) => { const id = sichern(); if (!id) return; const neu = Store.items.find((i) => i.id === id); drucken(dokumentHtml(ctxNeu(), neu, b.dataset.id)); },
        status: (b) => {
          const id = sichern(); if (!id) return; const st = b.dataset.id; const a = Store.items.find((i) => i.id === id);
          const patch = { status: st, ...(st !== 'gesendet' ? { entschieden: Date.now() } : {}) };
          if (st === 'angenommen' && !a.bs && c.R.an('angebote', 'baustelleAnlegen')) {
            patch.bs = baustelleAusAngebot(a); meldung('Auftrag angenommen. Die Baustelle ist angelegt.');
          } else meldung(st === 'angenommen' ? 'Auftrag angenommen' : st === 'abgelehnt' ? 'Als abgelehnt markiert' : 'Als gesendet markiert');
          Store.aendere(id, patch); Fenster.schliesse();
        },
        'zur-rechnung': () => {
          const id = sichern(); const a = Store.items.find((i) => i.id === id);
          const vorhanden = c.typ('rechnung').find((r) => r.angebot === id && r.status !== 'storniert');
          if (vorhanden) { meldung('Zu diesem Angebot gibt es schon eine Rechnung.'); return editor(ctxNeu(), vorhanden); }
          const r = { typ: 'rechnung', status: 'entwurf', kunde: a.kunde, kundenart: a.kundenart, adresse: a.adresse, email: a.email, betreff: a.betreff, bs: a.bs || '', angebot: id, angebotNr: a.nr, positionen: JSON.parse(JSON.stringify(a.positionen || [])), mwst: mwstVon(c, a), leistung: leistungszeitraum(c, a.bs) };
          Store.neu(r).then((rid) => editor(ctxNeu(), Store.items.find((i) => i.id === rid)));
        },
        stellen: () => {
          const id = sichern(); if (!id) return; const r = Store.items.find((i) => i.id === id);
          if (!(r.positionen || []).length) return meldung('Die Rechnung hat keine Positionen.', 'fehler');
          if (!r.kunde || !r.adresse) return meldung('Für eine Rechnung braucht es Name und Anschrift des Kunden.', 'fehler');
          const f = c.cfg; if (!f.strasse || !(f.steuernr || f.ustid)) return meldung('Bitte zuerst Anschrift und Steuernummer des Betriebs unter „Einstellungen“ eintragen.', 'fehler');
          const nr = naechsteNummer(ctxNeu(), 'rechnung');
          Store.aendere(id, { status: 'gestellt', nr, datum: c.heute, faellig: Datum.plus(c.heute, Number(c.R.p('rechnungen').ziel)) });
          (r.positionen || []).filter((p) => p.regie).forEach((p) => Store.aendere(p.regie, { status: 'abgerechnet', rechnung: nr }));
          Fenster.schliesse(); meldung(`Rechnung ${nr} gestellt`);
        },
        link: () => {
          const id = sichern(); if (!id) return; let a = Store.items.find((i) => i.id === id);
          const patch = {}; if (!a.schluessel) patch.schluessel = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
          if (a.status === 'entwurf') patch.status = 'gesendet';
          if (Object.keys(patch).length) Store.aendere(id, patch);
          a = { ...a, ...patch }; linkFenster(c, a);
        },
        'frage-erledigt': (b) => { Store.aendere(d.id, { fragen: (d.fragen || []).map((q) => (String(q.wann) === b.dataset.id ? { ...q, erledigt: Date.now() } : q)) }); b.closest('.kundenfrage').remove(); meldung('Frage als erledigt markiert'); },
        bezahlt: () => { Store.aendere(d.id, { status: 'bezahlt', bezahltAm: c.heute }); Fenster.schliesse(); meldung('Als bezahlt markiert'); },
        storno: (b) => { if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich stornieren?'; return; } Store.aendere(d.id, { status: 'storniert' }); Fenster.schliesse(); meldung('Rechnung storniert. Die Nummer bleibt belegt.'); },
        xml: () => speichern(`${d.nr}_XRechnung.xml`, new Blob([xrechnung(c, d)], { type: 'application/xml' })),
        loeschen: (b) => { if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich löschen?'; return; } Store.loesche(d.id); Fenster.schliesse(); meldung('Gelöscht'); },
      },
    });
    function zeichnen() {
      $('#pos-liste', hg).innerHTML = positionen.map((p, i) => positionZeile(p, i, gesperrt)).join('') || `<tr><td colspan="7">${leer('Noch keine Positionen.')}</td></tr>`;
      summeZeigen();
    }
    function summeZeigen() {
      const s = summen({ positionen }, mwstVon(c, d));
      $('#pos-summe', hg).innerHTML = `<span>Netto <b class="num">${Zahl.eur(s.netto)}</b></span><span>MwSt. ${mwstVon(c, d)} % <b class="num">${Zahl.eur(s.steuer)}</b></span><span class="gesamt">Gesamt <b class="num">${Zahl.eur(s.brutto)}</b></span>`;
    }
    function lesen() {
      if (gesperrt) return;
      $$('#pos-liste tr[data-pos]', hg).forEach((tr) => {
        const p = positionen[Number(tr.dataset.pos)]; if (!p) return;
        p.text = $('.p-text', tr).value; p.menge = zahl($('.p-menge', tr).value); p.einheit = $('.p-einheit', tr).value; p.preis = zahl($('.p-preis', tr).value);
      });
    }
    function sichern() {
      if (gesperrt) return d.id;
      lesen(); const w = Fenster.werte(hg);
      if (!w.kunde.trim()) { meldung('Bitte einen Kunden eintragen.', 'fehler'); return null; }
      const daten = { kunde: w.kunde.trim(), kundenart: w.kundenart, adresse: w.adresse.trim(), email: w.email.trim(), betreff: w.betreff.trim(), positionen: positionen.filter((p) => p.text.trim() || zahl(p.preis)), extra: Zusatz.lesen(hg) };
      if (istR) daten.leistung = w.leistung; else if (w.bs !== undefined) daten.bs = w.bs;
      if (d.id) { Store.aendere(d.id, daten); return d.id; }
      const neu = istR ? { typ: 'rechnung', status: 'entwurf', ...daten } : { typ: 'angebot', status: 'entwurf', nr: naechsteNummer(c, 'angebot'), datum: c.heute, gueltigBis: Datum.plus(c.heute, Number(c.R.p('angebote').gueltig)), mwst: Number(c.R.p('angebote').mwst), ...daten };
      if (d.telefon) neu.telefon = d.telefon;
      const id = d._id || Store.uid('d'); Store.neu({ ...neu, id });
      if (d._vorgang) Store.aendere(d._vorgang, { angebot: id, spalte: 'angebot' });
      d = { ...neu, id };
      return id;
    }
    $('#pos-liste', hg).addEventListener('input', (e) => {
      const tr = e.target.closest('tr[data-pos]'); if (!tr) return;
      if (e.target.classList.contains('p-text')) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }
      const g = rund(zahl($('.p-menge', tr).value) * zahl($('.p-preis', tr).value)); $('.p-gesamt', tr).textContent = Zahl.eur(g);
      lesen(); summeZeigen();
    });
    const kSel = $('#katalog', hg);
    if (kSel) kSel.addEventListener('change', () => { if (kSel.value === '') return; lesen(); const k = kat[Number(kSel.value)]; positionen.push({ text: k.text, menge: 1, einheit: k.einheit, preis: k.preis }); kSel.value = ''; zeichnen(); });
    zeichnen(); bilderNachladen(hg, Store.items);
    $$('.p-text', hg).forEach((t) => { t.style.height = t.scrollHeight + 'px'; });
  }
  function linkFenster(c, a) {
    const url = kundenLink(Store.fid, a);
    const betreff = `Ihr Angebot ${a.nr} von ${c.cfg.name}`;
    const text = `Guten Tag,\n\nanbei unser Angebot ${a.nr}${a.betreff ? ' für ' + a.betreff : ''}. Sie können es hier ansehen, ausdrucken und direkt annehmen:\n${url}\n\nBei Fragen sind wir gern für Sie da.\n\nMit freundlichen Grüßen\n${c.cfg.inhaber || c.cfg.name}`;
    Fenster.oeffne({
      titel: `Link für ${esc(a.kunde)}`, bereich: 'ui-buero-fenster',
      inhalt: `<p style="margin:0 0 12px">Mit diesem Link sieht ${esc(a.kunde)} das Angebot und die AGB und kann es mit Unterschrift verbindlich annehmen oder eine Frage stellen. Die Annahme erscheint sofort hier im Büro.</p>
        <label class="feld"><span>Link</span><input id="kunden-link" readonly value="${esc(url)}"></label>`,
      fuss: `<a class="k" style="margin-right:auto" href="mailto:${esc(a.email || '')}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}">${Icon('angebot')} Per E-Mail</a>
        <a class="k" href="${esc(url)}" target="_blank" rel="noopener">Ansehen wie der Kunde</a>
        <button class="k haupt" data-f="kopieren">Link kopieren</button>`,
      aktionen: {
        kopieren: async () => { const i = $('#kunden-link'); i.select(); try { await navigator.clipboard.writeText(url); } catch { try { document.execCommand('copy'); } catch { /* egal */ } } meldung('Link kopiert'); },
      },
    });
  }
  function leistungszeitraum(c, bs) {
    const tage = c.typ('stunden').filter((s) => s.bs === bs && s.bis).map((s) => s.datum).sort();
    if (!tage.length) return '';
    return `${Datum.kurz(tage[0])}${tage[0].slice(0, 4)} bis ${Datum.kurz(tage[tage.length - 1])}${tage[tage.length - 1].slice(0, 4)}`;
  }
  const ctxNeu = () => kontext(Store.cfg, Store.items, (Sitzung.lies('buero') || {}).pid);

  /* Aufgaben für die Übersicht */
  function aufgaben(c) {
    const out = [];
    if (c.R.hat('rechnungen')) {
      const grenze = Number(c.R.p('rechnungen').mahnung);
      const mahnen = c.typ('rechnung').filter((r) => ueberfaellig(c, r) && tageUeber(c, r) >= grenze);
      if (mahnen.length) out.push({ titel: `${mahnen.length} ${mahnen.length === 1 ? 'Rechnung' : 'Rechnungen'} überfällig`, unter: mahnen.map((r) => `${r.kunde} ${Zahl.eur(summen(r, mwstVon(c, r)).brutto)}`).join(' · '), a: 'rechnung', id: mahnen[0].id });
    }
    if (c.R.hat('angebote')) {
      c.typ('angebot').filter((a) => offeneFragen(a).length).forEach((a) => out.push({ titel: `Frage zu Angebot ${a.nr}`, unter: `${a.kunde}: „${offeneFragen(a)[0].text.slice(0, 90)}“`, a: 'angebot', id: a.id }));
      c.typ('angebot').filter((a) => a.angenommenOnline && !a.gesehen).forEach((a) => out.push({ titel: `Online angenommen: ${a.nr}`, unter: `${a.kunde} · ${a.betreff} · ${Zahl.eur(summen(a, mwstVon(c, a)).brutto)}`, a: 'angebot', id: a.id }));
      const nachfassen = c.typ('angebot').filter((a) => a.status === 'gesendet' && Datum.plus(a.datum, 10) <= c.heute);
      if (nachfassen.length) out.push({ titel: `${nachfassen.length} ${nachfassen.length === 1 ? 'Angebot' : 'Angebote'} nachfassen`, unter: nachfassen.map((a) => `${a.kunde} (seit ${Datum.kurz(a.datum)})`).join(' · '), a: 'angebot', id: nachfassen[0].id });
    }
    return out;
  }

  Buero.erweitern({
    nav: [
      { id: 'angebote', name: 'Angebote', icon: 'angebot', braucht: 'angebote', gruppe: 'Aufträge', zahl: (o, c) => c.typ('angebot').filter((a) => a.status === 'gesendet').length },
      { id: 'rechnungen', name: 'Rechnungen', icon: 'rechnung', braucht: 'rechnungen', gruppe: 'Aufträge', zahl: (o, c) => c.typ('rechnung').filter((r) => ueberfaellig(c, r)).length },
    ],
    seiten: { angebote: angeboteSeite, rechnungen: rechnungenSeite },
    aktionen: {
      'angebot-neu'(el, c) { editor(c, { typ: 'angebot', status: 'entwurf', positionen: [{ text: '', menge: 1, einheit: 'm²', preis: '' }] }); },
      angebot(el, c) { const d = c.items.find((i) => i.id === el.dataset.id); if (!d) return; if (d.angenommenOnline && !d.gesehen) Store.aendere(d.id, { gesehen: Date.now() }); editor(c, d); },
      'rechnung-neu'(el, c) { editor(c, { typ: 'rechnung', status: 'entwurf', positionen: [{ text: '', menge: 1, einheit: 'Std', preis: '' }] }); },
      rechnung(el, c) { const d = c.items.find((i) => i.id === el.dataset.id); if (d) editor(c, d); },
      'rechnung-export'(el, c) {
        const j = c.heute.slice(0, 4); const m = c.heute.slice(0, 7);
        Fenster.oeffne({ titel: 'Rechnungen für die Buchhaltung', bereich: 'ui-buero-fenster',
          inhalt: `<p style="margin:0 0 12px">Eine Liste aller gestellten Rechnungen (CSV) und zu jeder Rechnung die E-Rechnung im XRechnung-Format. Damit lassen sich die Rechnungen in Buchhaltungsprogrammen wie lexoffice oder sevDesk erfassen oder ans Steuerbüro geben.</p>
            <div class="reihe"><label class="feld"><span>Von</span><input type="date" name="von" value="${m}-01"></label><label class="feld"><span>Bis</span><input type="date" name="bis" value="${c.heute}"></label></div>
            <p style="margin:0;color:#6a726c;font-size:13px">Schnellwahl: <button class="k klein" data-f="zeit" data-von="${m}-01">Dieser Monat</button> <button class="k klein" data-f="zeit" data-von="${j}-01-01">Dieses Jahr</button></p>`,
          fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="los">${Icon('download')} Herunterladen</button>`,
          aktionen: {
            zeit: (b, hg) => { $('[name=von]', hg).value = b.dataset.von; $('[name=bis]', hg).value = c.heute; },
            los: (b, hg) => { const w = Fenster.werte(hg); Uebergabe.buchhaltungsPaket(c, w.von, w.bis); },
          } });
      },
      'auf-filter'(el) { zustand.filter = el.dataset.id; Buero.neuZeichnen(); },
    },
    aufgaben,
  });

  return { summen, xrechnung, dokumentHtml, mwstVon, ueberfaellig, baustelleAusAngebot, offeneFragen, editor, chipDoc, STATUS };
})();
