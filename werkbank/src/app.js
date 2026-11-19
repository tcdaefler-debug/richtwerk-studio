/* =========================================================================
   Start, Anmeldung, Umschalten zwischen den Bereichen
   #          Startseite (Richtwerk intern) mit drei Einträgen
   #buero     Betriebszentrale (Computer)
   #app       Mitarbeiter-App (Handy)
   #studio    Entwickler-Tool
   Jeder Bereich hat seine eigene Anmeldung. So kann in einem Tab das Büro
   und im zweiten Tab (oder am Handy) die App offen sein.
   ========================================================================= */
const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0C1424"/><path d="M21 50V14.5H34a9.5 9.5 0 010 19H21" fill="none" stroke="#6F94FF" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 34L46 50" fill="none" stroke="#FF6B3D" stroke-width="8.5" stroke-linecap="round"/></svg>`;

const Sitzung = {
  lies(bereich) { try { return JSON.parse(localStorage.getItem('rw-sitzung-' + bereich) || 'null'); } catch { return null; } },
  setze(bereich, wert) { try { wert ? localStorage.setItem('rw-sitzung-' + bereich, JSON.stringify(wert)) : localStorage.removeItem('rw-sitzung-' + bereich); } catch { /* privat */ } },
};

/* ---------- Fenster (Dialog) ---------- */
const Fenster = {
  oeffne({ titel, inhalt, fuss = '', breit = false, bereich = '', aktionen = {} }) {
    Fenster.schliesse();
    const hg = document.createElement('div');
    hg.className = 'fenster-hg ' + bereich; hg.id = 'fenster';
    hg.innerHTML = `<div class="fenster ${breit ? 'breit' : ''}" role="dialog" aria-modal="true">
      <div class="kopf"><h3>${titel}</h3><button data-f="zu" aria-label="Schließen">${Icon('x')}</button></div>
      <div class="koerper">${inhalt}</div>${fuss ? `<div class="fuss">${fuss}</div>` : ''}</div>`;
    hg.addEventListener('click', (e) => {
      if (e.target === hg) return Fenster.schliesse();
      const el = e.target.closest('[data-f]'); if (!el) return;
      const name = el.dataset.f;
      if (name === 'zu') return Fenster.schliesse();
      if (aktionen[name]) aktionen[name](el, hg);
    });
    document.body.appendChild(hg);
    const erstes = hg.querySelector('input:not([type=hidden]), select, textarea'); if (erstes && window.innerWidth > 700) erstes.focus();
    return hg;
  },
  schliesse() { const f = $('#fenster'); if (f) f.remove(); },
  werte(hg) {
    const out = {}; $$('[name]', hg).forEach((el) => { out[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return out;
  },
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Fenster.schliesse(); });

/* Drucken: nur den übergebenen Inhalt (Nachweis, Regiezettel, Plan) aufs Papier */
function drucken(inhalt) {
  let z = $('#druck'); if (!z) { z = document.createElement('div'); z.id = 'druck'; document.body.appendChild(z); }
  z.innerHTML = inhalt; bilderNachladen(z, Store.items);
  document.body.classList.add('druckt');
  const fertig = () => { document.body.classList.remove('druckt'); z.innerHTML = ''; window.removeEventListener('afterprint', fertig); };
  window.addEventListener('afterprint', fertig);
  setTimeout(() => { try { window.print(); } catch { fertig(); } }, 250);
}

/* ---------- Bereiche ---------- */
const Wurzel = () => $('#wurzel');
let aktiverBereich = null;

function zeige() {
  const ziel = (location.hash || '#').slice(1);
  Fenster.schliesse();
  document.body.className = '';
  if (ziel === 'buero') return Buero.start();
  if (ziel === 'app') return Handy.start();
  if (ziel === 'studio') return Studio.start();
  aktiverBereich = null;
  return startseite();
}
window.addEventListener('hashchange', zeige);
Store.abonniere(() => { if (aktiverBereich && aktiverBereich.neuZeichnen) aktiverBereich.neuZeichnen(); });

function startseite() {
  const basis = location.href.split('#')[0];
  const eintrag = (nr, ziel, wer, titel, text) => `
    <div class="bereich">
      <span class="nr">${nr}</span>
      <a href="#${ziel}" style="color:inherit;text-decoration:none">
        <div class="wer">${wer}</div><h2>${titel}</h2><p>${text}</p>
      </a>
      <div class="aktionen">
        <a class="knopf-rand" href="${esc(basis)}#${ziel}" target="_blank" rel="noopener">Neuer Tab</a>
        <a class="knopf-voll" href="#${ziel}">Öffnen</a>
      </div>
    </div>`;
  Wurzel().innerHTML = `<div class="ui-start">
    <header class="start-kopf"><div class="marke">${LOGO}Richtwerk <small>Intern</small></div><span class="stand">Arbeitsstand ${Datum.kurz(Datum.heute())}${Datum.heute().slice(0, 4)}</span></header>
    <main class="start-inhalt">
      <h1>Bereich wählen</h1>
      <p class="unter">Die drei Teile laufen unabhängig voneinander. Die Betriebszentrale läuft am Computer im Büro, die Mitarbeiter-App auf jedem Handy oder Tablet. Was in der App erfasst wird, steht sofort in der Betriebszentrale.</p>
      <div class="bereiche">
        ${eintrag('01', 'buero', 'Für Inhaber und Büro', 'Betriebszentrale', 'Stunden prüfen, Urlaub freigeben, Belege und Lieferscheine, Tagelöhner, Paket für das Steuerbüro.')}
        ${eintrag('02', 'app', 'Für die Mitarbeiter am Handy', 'Mitarbeiter-App', 'Stempeln, Belege und Lieferscheine abfotografieren, Urlaub beantragen, Lohnzettel ansehen.')}
        ${eintrag('03', 'studio', 'Nur Richtwerk', 'Entwickler-Tool', 'Betriebe aus Bausteinen zusammenstellen, Verbindungen ziehen, Werte pro Betrieb einstellen.')}
      </div>
    </main>
    <footer class="start-fuss">
      <div><b>Daten</b><span class="datenmodus">${Store.modus === 'cloud' ? 'Geteilt über alle Geräte' : 'Nur in diesem Browser (Offline-Modus)'}</span></div>
      <div><b>Anmeldung</b>Betriebskennung und persönlicher Zugangscode</div>
      <div><b>Version</b><span class="mono">1.0</span></div>
    </footer>
  </div>`;
}

/* Betrieb über seine Kennung finden */
async function findeBetrieb(kennung) {
  const k = String(kennung || '').trim().toLowerCase();
  const meta = await Store.betriebe();
  const eintrag = meta && meta.liste.find((b) => b.kennung.toLowerCase() === k);
  if (!eintrag) return null;
  const cfg = await Store.ladeCfg(eintrag.id);
  return cfg ? { fid: eintrag.id, cfg } : null;
}

/* ---------- Anmeldung Büro (und Studio nutzt eine eigene Variante) ---------- */
function bueroAnmeldung(fehler = '') {
  Wurzel().innerHTML = `<div class="ui-start anmeldung">
    <div class="links">
      <div class="marke">${LOGO}Richtwerk <small>Betriebszentrale</small></div>
      <div><h1>Der Betrieb auf einen Blick.</h1><p>Stunden, Urlaub, Belege und Lieferscheine aus der Mitarbeiter-App laufen hier zusammen.</p></div>
      <div class="fuss">Verbindung verschlüsselt · Daten gehören dem Betrieb</div>
    </div>
    <div class="rechts">
      <form class="formular" id="f-login" autocomplete="off">
        <h2>Anmelden</h2>
        <p class="hinweis">Mit der Betriebskennung und Ihrem persönlichen Zugangscode.</p>
        <label class="feld"><span>Betriebskennung</span><input name="kennung" autocapitalize="none" spellcheck="false" required></label>
        <label class="feld"><span>Zugangscode</span><input name="code" class="code" inputmode="numeric" type="password" maxlength="8" required></label>
        <div class="fehlertext">${esc(fehler)}</div>
        <button class="knopf-voll" type="submit">Anmelden</button>
        <a class="zurueck" href="#">${Icon('zurueck')} Bereich wählen</a>
      </form>
    </div></div>`;
  $('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const w = Object.fromEntries(new FormData(e.target));
    const b = await findeBetrieb(w.kennung);
    if (!b) return bueroAnmeldung('Diese Betriebskennung ist nicht bekannt.');
    const p = b.cfg.personen.find((x) => x.code === String(w.code).trim());
    if (!p) return bueroAnmeldung('Der Zugangscode stimmt nicht.');
    if (!['chef', 'buero'].includes(p.rolle)) return bueroAnmeldung('Dieser Zugang gilt für die Mitarbeiter-App am Handy.');
    Sitzung.setze('buero', { fid: b.fid, pid: p.id });
    Buero.start();
  });
}

/* ---------- Start ---------- */
async function boot() {
  Wurzel().innerHTML = `<div class="laden"><div>Richtwerk wird geladen<div class="balken"><i></i></div></div></div>`;
  await Store.init();
  try {
    const meta = await Store.betriebe();
    if (!meta) {
      const t = $('.laden > div');
      if (t) t.firstChild.textContent = 'Betriebe werden eingerichtet … ';
      await Muster.einrichten((n) => { if (t) t.firstChild.textContent = `Betriebe werden eingerichtet … ${n}`; });
    } else {
      // Musterbetrieb auf den neuen Stand bringen (neue Funktionen brauchen neue Daten)
      const cfg = await Store.ladeCfg('ahlers');
      if (cfg && (cfg.version || 1) < 2) {
        const t = $('.laden > div');
        await Muster.zuruecksetzen('ahlers', (n) => { if (t) t.firstChild.textContent = `Daten werden aktualisiert … ${n}`; });
      }
    }
  } catch (e) { console.error(e); }
  zeige();
}
boot();
