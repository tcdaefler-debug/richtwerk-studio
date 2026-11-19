/* =========================================================================
   Partnerbuch und Vernetzung zwischen Betrieben
   Ein Betrieb fragt aus einer Baustelle einen befreundeten Betrieb an
   (Elektro, Maler, Gerüst …). Adresse, Fotos, Zeitraum und Text gehen mit.
   Ist der Partner auch bei Richtwerk, landet die Anfrage direkt in seinem
   Büro, sonst geht sie als E-Mail raus. Zusagen stehen in beiden Kalendern.
   Außerdem: „Ihre Bausteine“ in den Einstellungen (an/aus + Feinregler).
   ========================================================================= */
const Netz = (() => {
  const { seitenkopf, leer } = Buero.teile;
  const zustand = { offen: null };
  const partner = (c) => c.cfg.partner || [];
  const jahr = (d) => (d ? `${Datum.kurz(d)}${d.slice(0, 4)}` : '');
  const zeitraum = (v, b) => (!v ? 'nach Absprache' : b && b !== v ? `${Datum.WT[Datum.wochentag(v)]} ${Datum.kurz(v)} bis ${Datum.WT[Datum.wochentag(b)]} ${jahr(b)}` : `${Datum.WT[Datum.wochentag(v)]} ${jahr(v)}`);
  const STATUS = { offen: ['Wartet auf Antwort', 'info'], zugesagt: ['Zugesagt', 'ok'], termin: ['Anderer Termin', 'warn'], rueckfrage: ['Rückfrage', 'warn'], abgesagt: ['Abgesagt', 'nein'], extern: ['Per E-Mail', ''] };
  const chipN = (st, n) => { const [t, k] = n && n.an === Store.fid && st === 'offen' ? ['Antwort fehlt', 'warn'] : STATUS[st] || [st, '']; return `<span class="chip ${k}">${esc(t)}</span>`; };
  const ausgehend = () => Store.netz.filter((n) => n.von === Store.fid).sort((a, b) => (b.erstellt || 0) - (a.erstellt || 0));
  const eingehend = () => Store.netz.filter((n) => n.an === Store.fid).sort((a, b) => (b.erstellt || 0) - (a.erstellt || 0));
  const brauchtAntwort = (n) => (n.an === Store.fid ? n.status === 'offen' : ['termin', 'rueckfrage'].includes(n.status));

  /* ---------- Seite „Partner“ ---------- */
  function seite(c) {
    const rein = eingehend(); const raus = ausgehend();
    return seitenkopf('Partner', 'Befreundete Betriebe anfragen. Adresse, Fotos und Zeitraum gehen mit, die Antwort kommt hierher und in den Kalender.',
      `<button class="k" data-a="partner-neu">${Icon('plus')} Partner eintragen</button><button class="k haupt" data-a="partner-anfrage">${Icon('angebot')} Partner anfragen</button>`)
      + (rein.length ? `<div class="karte"><div class="kopf"><h3>Anfragen an uns</h3><span class="chip ${rein.some(brauchtAntwort) ? 'warn' : ''}">${rein.filter(brauchtAntwort).length} offen</span></div><div class="tabelle-huelle"><table class="t"><thead><tr><th>Von</th><th>Baustelle</th><th>Zeitraum</th><th>Eingegangen</th><th>Status</th></tr></thead><tbody>
        ${rein.map((n) => `<tr class="klickbar" data-a="netz" data-id="${n.id}"><td><b>${esc(n.vonName)}</b></td><td>${esc(n.bsName)}<small style="display:block;color:#6b7280">${esc(String(n.adresse || '').replace(/\n/g, ', '))}</small></td><td>${esc(zeitraum(n.termin ? n.termin.von : n.zeitVon, n.termin ? n.termin.bis : n.zeitBis))}</td><td>${jahr(Datum.iso(n.erstellt))}</td><td>${chipN(n.status, n)}</td></tr>`).join('')}</tbody></table></div></div>` : '')
      + `<div class="karte"><div class="kopf"><h3>Partnerbuch</h3><span class="chip">${partner(c).length}</span></div>${partner(c).length ? `<div class="tabelle-huelle"><table class="t"><thead><tr><th>Betrieb</th><th>Gewerk</th><th>Ansprechpartner</th><th>Telefon</th><th>Verbindung</th><th></th></tr></thead><tbody>
        ${partner(c).map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.gewerk)}</td><td>${esc(p.ansprech || '')}</td><td class="num">${p.telefon ? `<a href="tel:${esc(p.telefon.replace(/\s+/g, ''))}">${esc(p.telefon)}</a>` : ''}</td><td>${p.fid ? '<span class="chip ok">direkt über Richtwerk</span>' : '<span class="chip">per E-Mail</span>'}</td>
          <td class="r"><button class="k klein" data-a="partner-anfrage" data-partner="${p.id}">Anfragen</button> <button class="k klein" data-a="partner-bearbeiten" data-id="${p.id}" aria-label="Bearbeiten">${Icon('stift')}</button></td></tr>`).join('')}</tbody></table></div>` : leer('Noch keine Partner. Elektriker, Maler, Gerüstbauer eintragen, mit denen Sie oft zusammenarbeiten.')}</div>`
      + `<div class="karte"><div class="kopf"><h3>Unsere Anfragen</h3></div>${raus.length ? `<div class="tabelle-huelle"><table class="t"><thead><tr><th>An</th><th>Baustelle</th><th>Zeitraum</th><th>Gesendet</th><th>Status</th></tr></thead><tbody>
        ${raus.map((n) => `<tr class="klickbar" data-a="netz" data-id="${n.id}"><td><b>${esc(n.anName)}</b><small style="display:block;color:#6b7280">${esc(n.gewerk || '')}</small></td><td>${esc(n.bsName)}</td><td>${esc(zeitraum(n.termin ? n.termin.von : n.zeitVon, n.termin ? n.termin.bis : n.zeitBis))}</td><td>${jahr(Datum.iso(n.erstellt))}</td><td>${chipN(n.status)}</td></tr>`).join('')}</tbody></table></div>` : leer('Noch keine Anfragen gesendet.')}</div>`;
  }

  function partnerFenster(c, p = {}) {
    const gewerke = c.R.liste('partner', 'gewerke');
    Fenster.oeffne({
      titel: p.id ? esc(p.name) : 'Partner eintragen', bereich: 'ui-buero-fenster',
      inhalt: `<div class="reihe"><label class="feld"><span>Betrieb</span><input name="name" value="${esc(p.name || '')}" placeholder="z. B. Elektro Brinkmann"></label><label class="feld"><span>Gewerk</span><input name="gewerk" list="gewerk-liste" value="${esc(p.gewerk || '')}"><datalist id="gewerk-liste">${gewerke.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label></div>
        <div class="reihe"><label class="feld"><span>Ansprechpartner</span><input name="ansprech" value="${esc(p.ansprech || '')}"></label><label class="feld"><span>Telefon</span><input name="telefon" type="tel" value="${esc(p.telefon || '')}"></label></div>
        <label class="feld"><span>E-Mail</span><input name="email" type="email" value="${esc(p.email || '')}"></label>
        <label class="feld"><span>Richtwerk-Kennung (falls der Partner auch Richtwerk nutzt)</span><input name="fid" class="mono" value="${esc(p.fid || '')}" placeholder="leer = Anfrage geht per E-Mail"></label>`,
      fuss: `${p.id ? `<button class="k nein" data-f="weg" style="margin-right:auto">${Icon('muell')} Entfernen</button>` : ''}<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: {
        weg: (b) => { if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich entfernen?'; return; } Store.speichereCfg({ ...Store.cfg, partner: partner(c).filter((x) => x.id !== p.id) }); Fenster.schliesse(); },
        ok: (b, hg) => {
          const w = Fenster.werte(hg); if (!w.name.trim()) return meldung('Bitte den Namen des Betriebs eintragen.', 'fehler');
          const neu = { id: p.id || Store.uid('pa'), name: w.name.trim(), gewerk: w.gewerk.trim(), ansprech: w.ansprech.trim(), telefon: w.telefon.trim(), email: w.email.trim(), fid: w.fid.trim().toLowerCase() };
          Store.speichereCfg({ ...Store.cfg, partner: p.id ? partner(c).map((x) => (x.id === p.id ? neu : x)) : [...partner(c), neu] });
          Fenster.schliesse(); meldung('Gespeichert');
        },
      },
    });
  }

  /* ---------- Anfrage stellen ---------- */
  function anfrageFenster(c, { partnerId = '', bs = '' } = {}) {
    if (!partner(c).length) { meldung('Bitte zuerst einen Partner eintragen.'); return partnerFenster(c); }
    const offen = c.baustellenOffen(); const bsWahl = bs || (offen[0] || {}).id || '';
    const fotosVon = (id) => c.typ('tagebuch').filter((t) => t.bs === id).sort((a, b) => b.datum.localeCompare(a.datum)).flatMap((t) => t.fotos || []).slice(0, 8);
    const textFuer = (p, b) => `Moin ${p && p.ansprech ? p.ansprech.split(' ')[0] : ''},\n\nwir sind gerade auf der Baustelle ${b ? b.name : ''}${b && b.kunde ? ` (${b.kunde})` : ''} und brauchen euch für:\n\n\nFotos und Adresse hängen dran. Passt euch der Zeitraum? Sonst schlagt gern einen anderen vor.\n\nViele Grüße\n${c.ich ? c.ich.name : c.cfg.name}\n${c.cfg.name}${c.cfg.telefon ? ', Tel. ' + c.cfg.telefon : ''}`;
    const start = Datum.plus(Datum.montag(Datum.plus(c.heute, 7)), 0);
    const hg = Fenster.oeffne({
      titel: 'Partner anfragen', breit: true, bereich: 'ui-buero-fenster',
      inhalt: `<div class="reihe"><label class="feld"><span>Partner</span><select name="partner">${partner(c).map((p) => `<option value="${p.id}" ${p.id === partnerId ? 'selected' : ''}>${esc(p.name)} · ${esc(p.gewerk)}</option>`).join('')}</select></label>
          <label class="feld"><span>Baustelle</span><select name="bs">${offen.map((b) => `<option value="${b.id}" ${b.id === bsWahl ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label></div>
        <div class="reihe"><label class="feld"><span>Gewünscht ab</span><input type="date" name="von" value="${start}"></label><label class="feld"><span>bis</span><input type="date" name="bis" value="${Datum.plus(start, 2)}"></label></div>
        <label class="feld"><span>Was soll gemacht werden?</span><textarea name="text" rows="9"></textarea></label>
        ${c.R.an('partner', 'fotos') ? '<div class="feld"><span>Fotos aus dem Bautagebuch (antippen zum Weglassen)</span><div class="netz-fotos" id="na-fotos"></div></div>' : ''}
        <p class="r-hinweis" id="na-weg"></p>`,
      fuss: `<button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">${Icon('angebot')} Anfrage senden</button>`,
      aktionen: {
        ok: () => {
          const w = Fenster.werte(hg); const p = partner(c).find((x) => x.id === w.partner); const b = c.baustelle(w.bs);
          if (!p || !b) return meldung('Bitte Partner und Baustelle wählen.', 'fehler');
          if (!w.text.trim()) return meldung('Bitte kurz beschreiben, was gemacht werden soll.', 'fehler');
          const fotos = $$('#na-fotos .netz-foto.an', hg).map((f) => f.dataset.id);
          const id = Store.uid('n');
          const daten = { von: Store.fid, vonName: c.cfg.name, vonTelefon: c.cfg.telefon || '', an: p.fid || '', anName: p.name, partnerId: p.id, gewerk: p.gewerk, bs: b.id, bsName: b.name, adresse: b.adresse || b.ort || '', kunde: b.kunde || '', zeitVon: w.von, zeitBis: w.bis || w.von, text: w.text.trim(), fotos, status: p.fid ? 'offen' : 'extern', verlauf: [{ wer: 'von', art: 'anfrage', text: w.text.trim(), wann: Date.now(), name: c.ich ? c.ich.name : '' }], erstellt: Date.now(), frist: Datum.plus(c.heute, Number(c.R.p('partner').frist) || 3) };
          Store.netzSchreibe(id, daten);
          Fenster.schliesse();
          if (p.fid) meldung(`Anfrage an ${p.name} gesendet. Die Antwort erscheint unter „Partner“${c.R.an('partner', 'imKalender') ? ' und im Kalender' : ''}.`);
          else { location.href = `mailto:${encodeURIComponent(p.email || '')}?subject=${encodeURIComponent(`Anfrage ${b.name}, ${zeitraum(w.von, w.bis)}`)}&body=${encodeURIComponent(`${w.text.trim()}\n\nBaustelle: ${b.name}\n${String(b.adresse || '').replace(/\n/g, ', ')}\nZeitraum: ${zeitraum(w.von, w.bis)}`)}`; meldung(`${p.name} nutzt Richtwerk nicht. Ihr E-Mail-Programm öffnet sich mit dem Text, Fotos bitte anhängen.`); }
        },
      },
    });
    const neu = () => {
      const p = partner(c).find((x) => x.id === $('[name=partner]', hg).value); const b = c.baustelle($('[name=bs]', hg).value);
      $('[name=text]', hg).value = textFuer(p, b);
      $('#na-weg', hg).textContent = p && p.fid ? `${p.name} nutzt Richtwerk: Die Anfrage landet direkt im Büro des Partners, die Antwort kommt hierher zurück.` : `${p ? p.name : 'Der Partner'} nutzt Richtwerk nicht: Die Anfrage geht als E-Mail raus.`;
      const box = $('#na-fotos', hg);
      if (box) { const f = fotosVon(b ? b.id : ''); box.innerHTML = f.map((id, i) => `<button type="button" class="netz-foto ${i < 4 ? 'an' : ''}" data-id="${esc(id)}"><img data-datei="${esc(id)}" alt="Foto"></button>`).join('') || '<small>Noch keine Fotos zu dieser Baustelle.</small>'; bilderNachladen(box, Store.items); }
    };
    hg.addEventListener('change', (e) => { if (['partner', 'bs'].includes(e.target.name)) neu(); });
    hg.addEventListener('click', (e) => { const f = e.target.closest('.netz-foto'); if (f) f.classList.toggle('an'); });
    neu();
    const t = $('[name=text]', hg); const pos = t.value.indexOf('für:\n\n') + 6; t.focus(); t.setSelectionRange(pos, pos);
  }

  /* ---------- Anfrage ansehen und beantworten (beide Seiten) ---------- */
  function netzFenster(c, n) {
    const ichBinPartner = n.an === Store.fid;
    const verlauf = (n.verlauf || []).map((v) => `<div class="netz-msg ${(v.wer === 'an') === ichBinPartner ? 'eigen' : ''}"><small>${esc(v.wer === 'von' ? n.vonName : n.anName)}${v.name ? ' · ' + esc(v.name) : ''} · ${jahr(Datum.iso(v.wann))} ${Datum.uhr(v.wann)}</small>
      <b>${esc({ anfrage: 'Anfrage', zusage: 'Zusage', termin: 'Anderer Termin', rueckfrage: 'Rückfrage', antwort: 'Antwort', absage: 'Absage', angenommen: 'Termin bestätigt' }[v.art] || '')}${v.zeitVon ? ': ' + esc(zeitraum(v.zeitVon, v.zeitBis)) : ''}</b>${v.text ? `<p>${esc(v.text)}</p>` : ''}</div>`).join('');
    const adr = String(n.adresse || '').replace(/\n/g, ', ');
    const kopf = `<dl class="daten netz-daten"><dt>${ichBinPartner ? 'Von' : 'An'}</dt><dd><b>${esc(ichBinPartner ? n.vonName : n.anName)}</b>${ichBinPartner && n.vonTelefon ? ` · <a href="tel:${esc(n.vonTelefon.replace(/\s+/g, ''))}">${esc(n.vonTelefon)}</a>` : ''}</dd>
      <dt>Baustelle</dt><dd>${esc(n.bsName)}${n.kunde ? ` · Kunde ${esc(n.kunde)}` : ''}</dd>
      <dt>Adresse</dt><dd>${esc(adr)}${adr ? ` · <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}" target="_blank" rel="noopener">Route</a>` : ''}</dd>
      <dt>Zeitraum</dt><dd>${n.termin ? `<b>${esc(zeitraum(n.termin.von, n.termin.bis))}</b> (fest)` : `${esc(zeitraum(n.zeitVon, n.zeitBis))} (Wunsch)`}</dd>
      <dt>Status</dt><dd>${chipN(n.status)}</dd></dl>
      ${(n.fotos || []).length ? `<div class="netz-fotos">${n.fotos.map((f) => `<span class="netz-foto an"><img data-netz="${esc(n.von)}|${esc(f)}" alt="Foto der Baustelle"></span>`).join('')}</div>` : ''}`;
    let formular = '';
    if (ichBinPartner && ['offen', 'rueckfrage', 'termin'].includes(n.status)) {
      formular = `<div class="netz-antwort"><h4>Antworten</h4><div class="fr-wahl netz-art">${[['zusage', 'Zusage'], ['termin', 'Anderer Termin'], ['rueckfrage', 'Rückfrage'], ['absage', 'Absage']].map(([v, t], i) => `<label><input type="radio" name="art" value="${v}" ${i === 0 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
        <div class="reihe" id="na-zeit"><label class="feld"><span>von</span><input type="date" name="von" value="${esc(n.zeitVon || '')}"></label><label class="feld"><span>bis</span><input type="date" name="bis" value="${esc(n.zeitBis || '')}"></label></div>
        <label class="feld"><span>Nachricht (optional)</span><textarea name="text" rows="3" placeholder="z. B. Wir kommen mit zwei Mann, Strom muss auf der Baustelle sein."></textarea></label>
        ${c.R.hat('baustellen') ? '<label class="v-haken"><input type="checkbox" name="alsBs" checked>Bei Zusage als Baustelle bei uns anlegen</label>' : ''}</div>`;
    } else if (!ichBinPartner && n.status === 'termin') {
      formular = `<div class="netz-antwort"><h4>${esc(n.anName)} schlägt einen anderen Termin vor</h4><p>${esc(zeitraum(n.vorschlag && n.vorschlag.von, n.vorschlag && n.vorschlag.bis))}</p><label class="feld"><span>Nachricht (optional)</span><textarea name="text" rows="2"></textarea></label></div>`;
    } else if (!ichBinPartner && n.status === 'rueckfrage') {
      formular = '<div class="netz-antwort"><h4>Rückfrage beantworten</h4><label class="feld"><span>Antwort</span><textarea name="text" rows="3"></textarea></label></div>';
    } else if (!ichBinPartner && n.status === 'extern') {
      formular = `<div class="netz-antwort"><h4>Antwort per Telefon oder E-Mail bekommen?</h4><p class="klein">${esc(n.anName)} nutzt Richtwerk nicht. Tragen Sie die Zusage hier ein, dann steht sie im Kalender.</p><div class="reihe"><label class="feld"><span>von</span><input type="date" name="von" value="${esc(n.zeitVon || '')}"></label><label class="feld"><span>bis</span><input type="date" name="bis" value="${esc(n.zeitBis || '')}"></label></div></div>`;
    }
    const knoepfe = ichBinPartner ? (formular ? `<button class="k haupt" data-f="antwort">Antwort senden</button>` : '')
      : n.status === 'termin' ? `<button class="k" data-f="nein">Passt nicht</button><button class="k haupt" data-f="annehmen">${Icon('haken')} Termin annehmen</button>`
        : n.status === 'rueckfrage' ? `<button class="k haupt" data-f="antworten">Antwort senden</button>`
          : n.status === 'extern' ? `<button class="k haupt" data-f="extern">${Icon('haken')} Zusage eintragen</button>` : '';
    const ich = c.ich ? c.ich.name : '';
    const hg = Fenster.oeffne({
      titel: ichBinPartner ? `Anfrage von ${esc(n.vonName)}` : `Anfrage an ${esc(n.anName)}`, breit: true, bereich: 'ui-buero-fenster',
      inhalt: `<div class="netz-fenster"><div>${kopf}</div><div><div class="netz-verlauf">${verlauf}</div>${formular}</div></div>`,
      fuss: `<button class="k" data-f="zu" style="margin-right:auto">Schließen</button>${knoepfe}`,
      aktionen: {
        antwort: () => {
          const w = Fenster.werte(hg); const art = $('[name=art]:checked', hg).value;
          if ((art === 'rueckfrage' || art === 'absage') && !w.text.trim() && art === 'rueckfrage') return meldung('Bitte die Rückfrage eintragen.', 'fehler');
          if ((art === 'zusage' || art === 'termin') && !w.von) return meldung('Bitte das Datum eintragen.', 'fehler');
          const v = { wer: 'an', art, text: w.text.trim(), wann: Date.now(), name: ich, ...(art === 'zusage' || art === 'termin' ? { zeitVon: w.von, zeitBis: w.bis || w.von } : {}) };
          const patch = { verlauf: [...(n.verlauf || []), v], status: { zusage: 'zugesagt', termin: 'termin', rueckfrage: 'rueckfrage', absage: 'abgesagt' }[art] };
          if (art === 'zusage') patch.termin = { von: w.von, bis: w.bis || w.von };
          if (art === 'termin') patch.vorschlag = { von: w.von, bis: w.bis || w.von };
          if (art === 'zusage' && w.alsBs && !n.partnerBs) {
            const id = Store.uid('b'); patch.partnerBs = id;
            Store.speichereCfg({ ...Store.cfg, baustellen: [...(Store.cfg.baustellen || []), { id, name: `${n.bsName} (für ${n.vonName})`, ort: adr.split(',').pop().trim(), adresse: n.adresse, kunde: n.vonName, telefon: n.vonTelefon || '', arbeit: n.text.split('\n').find((z) => z.trim() && !/^(moin|hallo|guten)/i.test(z.trim())) || '', status: 'geplant', notiz: `Über das Partnerbuch von ${n.vonName}` }] });
          }
          Store.netzSchreibe(n.id, patch); Fenster.schliesse(); meldung(`Antwort an ${n.vonName} gesendet`);
        },
        annehmen: () => { const w = Fenster.werte(hg); Store.netzSchreibe(n.id, { status: 'zugesagt', termin: n.vorschlag, verlauf: [...(n.verlauf || []), { wer: 'von', art: 'angenommen', text: (w.text || '').trim(), wann: Date.now(), name: ich, zeitVon: n.vorschlag.von, zeitBis: n.vorschlag.bis }] }); Fenster.schliesse(); meldung('Termin bestätigt. Er steht jetzt im Kalender.'); },
        nein: () => { const w = Fenster.werte(hg); Store.netzSchreibe(n.id, { status: 'offen', verlauf: [...(n.verlauf || []), { wer: 'von', art: 'antwort', text: (w.text || '').trim() || 'Der Termin passt leider nicht. Geht es auch im ursprünglichen Zeitraum?', wann: Date.now(), name: ich }] }); Fenster.schliesse(); meldung('Antwort gesendet'); },
        antworten: () => { const w = Fenster.werte(hg); if (!w.text.trim()) return meldung('Bitte eine Antwort eintragen.', 'fehler'); Store.netzSchreibe(n.id, { status: 'offen', verlauf: [...(n.verlauf || []), { wer: 'von', art: 'antwort', text: w.text.trim(), wann: Date.now(), name: ich }] }); Fenster.schliesse(); meldung('Antwort gesendet'); },
        extern: () => { const w = Fenster.werte(hg); if (!w.von) return meldung('Bitte das Datum eintragen.', 'fehler'); Store.netzSchreibe(n.id, { status: 'zugesagt', termin: { von: w.von, bis: w.bis || w.von }, verlauf: [...(n.verlauf || []), { wer: 'an', art: 'zusage', text: 'telefonisch zugesagt (eingetragen)', wann: Date.now(), name: ich, zeitVon: w.von, zeitBis: w.bis || w.von }] }); Fenster.schliesse(); meldung('Zusage eingetragen'); },
      },
    });
    const zeitAn = () => { const r = $('[name=art]:checked', hg); const z = $('#na-zeit', hg); if (r && z) z.hidden = !['zusage', 'termin'].includes(r.value); };
    hg.addEventListener('change', zeitAn); zeitAn();
    bilderNachladen(hg, Store.items);
    const v = $('.netz-verlauf', hg); if (v) v.scrollTop = v.scrollHeight;
  }

  /* ---------- Kalender, Baustellenakte, App ---------- */
  function tageVon(t) { const out = []; let d = t.von; while (d <= (t.bis || t.von) && out.length < 30) { if (Datum.istArbeitstag(d)) out.push(d); d = Datum.plus(d, 1); } return out; }
  function kalender(c, d) {
    if (!c.R.hat('partner') || !c.R.an('partner', 'imKalender')) return [];
    return Store.netz.filter((n) => n.status === 'zugesagt' && n.termin && n.termin.von <= d && (n.termin.bis || n.termin.von) >= d && Datum.istArbeitstag(d))
      .map((n) => (n.an === Store.fid ? { art: 'partner', text: `Einsatz für ${n.vonName}: ${n.bsName}`, a: 'netz', id: n.id } : { art: 'partner', text: `${n.anName} (${n.gewerk}): ${n.bsName}`, a: 'netz', id: n.id }));
  }
  function akteKarte(c, b) {
    if (!c.R.hat('partner')) return '';
    const liste = ausgehend().filter((n) => n.bs === b.id);
    return `<div class="karte"><div class="kopf"><h3>Partner auf dieser Baustelle</h3><button class="k klein" data-a="partner-anfrage" data-bs="${b.id}">${Icon('plus')} Partner anfragen</button></div>
      ${liste.map((n) => `<div class="liste-zeile klickbar" data-a="netz" data-id="${n.id}"><div class="text"><b>${esc(n.anName)} · ${esc(n.gewerk || '')}</b><small>${esc(zeitraum(n.termin ? n.termin.von : n.zeitVon, n.termin ? n.termin.bis : n.zeitBis))}</small></div>${chipN(n.status)}</div>`).join('') || leer('Elektriker, Maler oder Gerüstbauer mit einem Klick anfragen. Adresse und Fotos gehen mit.')}</div>`;
  }
  function appKarte(c, bs) {
    if (!bs) return '';
    const bis = Datum.plus(c.heute, 14);
    const liste = Store.netz.filter((n) => n.von === Store.fid && n.bs === bs && n.status === 'zugesagt' && n.termin && (n.termin.bis || n.termin.von) >= c.heute && n.termin.von <= bis);
    return liste.length ? `<div class="a-titel">Andere Gewerke auf der Baustelle</div><div class="a-karte">${liste.map((n) => `<div class="a-zeile"><span class="sym">${Icon('team')}</span><span class="text"><b>${esc(n.anName)}</b><small>${esc(n.gewerk || '')} · ${esc(zeitraum(n.termin.von, n.termin.bis))}</small></span></div>`).join('')}</div>` : '';
  }

  /* ---------- Einstellungen: Ihre Bausteine ---------- */
  const KERN = ['app'];
  function bausteinKarte(c) {
    const kn = c.cfg.baukasten.knoten.filter((k) => BAUSTEINE[k.typ] && BAUSTEINE[k.typ].gruppe !== 'geplant' && !KERN.includes(k.typ));
    const reihenfolge = Object.keys(GRUPPEN);
    kn.sort((a, b) => reihenfolge.indexOf(BAUSTEINE[a.typ].gruppe) - reihenfolge.indexOf(BAUSTEINE[b.typ].gruppe));
    return `<div class="karte bausteine-karte"><div class="kopf"><h3>Ihre Bausteine</h3><span class="chip">${kn.filter((k) => !k.aus).length} von ${kn.length} an</span></div>
      <p class="legende" style="padding:10px 16px 0;margin:0">Jeder Baustein lässt sich aus- und wieder einschalten. Ausgeschaltet bleiben alle Daten erhalten. Mit „Einstellen“ ändern Sie Fristen, Zuschläge, Texte und was Ihre Mitarbeiter sehen.</p>
      <div class="baustein-liste">${kn.map((k) => { const B = BAUSTEINE[k.typ]; const an = !k.aus;
        return `<div class="baustein-zeile ${an ? '' : 'aus'}"><span class="b-sym" style="--g:${GRUPPEN[B.gruppe].farbe}">${Icon(B.icon)}</span><div class="text"><b>${esc(c.R.name(k.typ))}</b><small>${esc(B.kurz)}</small></div>
          <button class="k klein" data-a="baustein-einstellen" data-id="${k.typ}" ${an ? '' : 'disabled'}>Einstellen</button>
          <button class="kipp-knopf ${an ? 'an' : ''}" role="switch" aria-checked="${an}" aria-label="${esc(B.name)} ${an ? 'ausschalten' : 'einschalten'}" data-a="baustein-schalten" data-id="${k.typ}"><i></i></button></div>`; }).join('')}</div></div>`;
  }
  bausteinKarte.vorne = true;
  function bausteinAendern(fn) { const cfg = JSON.parse(JSON.stringify(Store.cfg)); fn(cfg.baukasten); return Store.speichereCfg(cfg); }
  function einstellFenster(c, typ) {
    const B = BAUSTEINE[typ]; const R = c.R;
    const mitApp = B.ein.includes('app') && R.hat('app');
    const hg = Fenster.oeffne({
      titel: `${Icon(B.icon)} ${esc(R.name(typ))} einstellen`, breit: Object.values(B.p).some((d) => d.typ === 'langtext'), bereich: 'ui-buero-fenster',
      inhalt: `${mitApp ? `<div class="fr-liste"><label class="fr-zeile fr-schalter"><span class="fr-name">In der Mitarbeiter-App sichtbar</span><span class="kipp"><input type="checkbox" id="fr-app" ${R.imApp(typ) ? 'checked' : ''}><i></i></span></label></div>` : ''}${Feinregler.html(typ, R.p(typ))}
        ${(ABLAEUFE[typ] || []).length ? `<p class="legende" style="margin-top:14px">Ablauf: ${ABLAEUFE[typ].map((s) => esc(s.name)).join(' → ')}</p>` : ''}`,
      fuss: `<button class="k" data-f="standard" style="margin-right:auto">Standardwerte</button><button class="k" data-f="zu">Abbrechen</button><button class="k haupt" data-f="ok">Speichern</button>`,
      aktionen: {
        standard: () => { const std = {}; Object.entries(B.p).forEach(([n, d]) => { std[n] = d.wert; }); $('.koerper', hg).querySelectorAll('[data-bp]').forEach((el) => { const v = std[el.dataset.bp]; if (el.dataset.art === 'schalter') el.checked = v === 'ja'; else if (el.dataset.art === 'wahl') el.checked = el.value === v; else el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }); },
        ok: () => {
          const p = Feinregler.lesen(hg, typ); const app = $('#fr-app', hg);
          bausteinAendern((bk) => {
            const x = bk.knoten.find((y) => y.typ === typ); x.p = { ...(x.p || {}), ...p };
            if (app) { const da = bk.kanten.some((e) => e.von === 'app' && e.zu === typ); if (app.checked && !da) bk.kanten.push({ von: 'app', zu: typ }); if (!app.checked && da) bk.kanten = bk.kanten.filter((e) => !(e.von === 'app' && e.zu === typ)); }
          });
          Fenster.schliesse(); meldung(`${R.name(typ)} gespeichert. Büro und App zeigen es sofort.`);
        },
      },
    });
  }

  Buero.erweitern({
    nav: [{ id: 'partner', name: 'Partner', icon: 'team', braucht: 'partner', gruppe: 'Aufträge', zahl: () => Store.netz.filter(brauchtAntwort).length }],
    seiten: { partner: seite },
    aktionen: {
      'partner-neu'(el, c) { partnerFenster(c); },
      'partner-bearbeiten'(el, c) { partnerFenster(c, partner(c).find((p) => p.id === el.dataset.id)); },
      'partner-anfrage'(el, c) { anfrageFenster(c, { partnerId: el.dataset.partner, bs: el.dataset.bs }); },
      netz(el, c) { const n = Store.netz.find((x) => x.id === el.dataset.id); if (n) netzFenster(c, n); },
      'baustein-schalten'(el, c) { const typ = el.dataset.id; const an = el.classList.contains('an'); bausteinAendern((bk) => { const x = bk.knoten.find((y) => y.typ === typ); if (an) x.aus = true; else delete x.aus; }); meldung(`${c.R.name(typ)} ${an ? 'ausgeschaltet. Die Daten bleiben erhalten.' : 'eingeschaltet'}`); },
      'baustein-einstellen'(el, c) { einstellFenster(c, el.dataset.id); },
    },
    aufgaben: (c) => (c.R.hat('partner') ? Store.netz.filter(brauchtAntwort).map((n) => (n.an === Store.fid ? { titel: `Anfrage von ${n.vonName}`, unter: `${n.bsName} · ${zeitraum(n.zeitVon, n.zeitBis)}`, a: 'netz', id: n.id } : { titel: `${n.anName}: ${STATUS[n.status][0]}`, unter: n.bsName, a: 'netz', id: n.id })) : []),
    einstellungen: bausteinKarte,
    akte: akteKarte,
  });
  return { kalender, appKarte, zeitraum };
})();
