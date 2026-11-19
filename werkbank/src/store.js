/* =========================================================================
   Datenspeicher
   Zwei Backends mit derselben Schnittstelle:
   - "cloud": Artifact-Datenbank (geteilt zwischen allen Geräten)
   - "lokal": localStorage + BroadcastChannel (nur dieser Browser, alle Tabs)
   Pfade:  meta/betriebe                 Liste aller Betriebe
           b/<fid>/cfg/main              Einstellungen, Team, Baukasten
           b/<fid>/items/<id>            ein Eintrag (Stunden, Beleg, ...)
           b/<fid>/dateien/<id>          ein Foto oder PDF (Data-URL)
   ========================================================================= */
const Store = (() => {
  let backend = null;
  let modus = 'lokal';

  /* ---------- lokales Backend ---------- */
  function lokalesBackend() {
    const PREFIX = 'rw1|';
    const kanal = ('BroadcastChannel' in window) ? new BroadcastChannel('richtwerk') : null;
    const beobachter = new Set();
    const lies = (k) => { try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : null; } catch { return null; } };
    const alleSchluessel = () => {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length)); } } catch { /* gesperrt */ }
      return out;
    };
    const melde = (pfad) => { beobachter.forEach((b) => b(pfad)); };
    if (kanal) kanal.onmessage = (e) => melde(e.data);
    window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith(PREFIX)) melde(e.key.slice(PREFIX.length)); });

    return {
      async get(pfad) { return lies(pfad); },
      async set(pfad, daten) {
        try { localStorage.setItem(PREFIX + pfad, JSON.stringify(daten)); }
        catch { throw new Error('Speicher dieses Browsers ist voll. Bitte kleinere Fotos verwenden.'); }
        melde(pfad); kanal && kanal.postMessage(pfad);
      },
      async del(pfad) { try { localStorage.removeItem(PREFIX + pfad); } catch { /* egal */ } melde(pfad); kanal && kanal.postMessage(pfad); },
      async list(sammlung) {
        const tiefe = sammlung.split('/').length + 1;
        return alleSchluessel()
          .filter((k) => k.startsWith(sammlung + '/') && k.split('/').length === tiefe)
          .map((k) => ({ id: k.split('/').pop(), daten: lies(k) }))
          .filter((d) => d.daten);
      },
      watchDoc(pfad, cb) {
        const f = (p) => { if (p === pfad) cb(lies(pfad)); };
        beobachter.add(f); cb(lies(pfad));
        return () => beobachter.delete(f);
      },
      watchList(sammlung, cb) {
        const tiefe = sammlung.split('/').length + 1;
        const neu = () => this.list(sammlung).then(cb);
        const f = (p) => { if (p.startsWith(sammlung + '/') && p.split('/').length === tiefe) neu(); };
        beobachter.add(f); neu();
        return () => beobachter.delete(f);
      },
    };
  }

  /* ---------- Cloud-Backend (Artifact-Datenbank) ---------- */
  function cloudBackend(db) {
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    async function mitWiederholung(fn) {
      for (let versuch = 0; ; versuch++) {
        try { return await fn(); }
        catch (e) {
          const code = e && e.code;
          if ((code === 'unavailable' || code === 'resource_exhausted') && versuch < 4) { await warte(400 * (versuch + 1) + Math.random() * 300); continue; }
          if (code === 'quota_exceeded') throw new Error('Der Speicher ist voll. Bitte alte Fotos löschen.');
          throw e;
        }
      }
    }
    const reihe = new Map(); // ein Schreibvorgang pro Dokument gleichzeitig
    function nacheinander(pfad, fn) {
      const vorher = reihe.get(pfad) || Promise.resolve();
      const jetzt = vorher.catch(() => {}).then(fn);
      reihe.set(pfad, jetzt);
      return jetzt;
    }
    return {
      async get(pfad) { const s = await mitWiederholung(() => db.doc(pfad).get()); return s.exists ? s.data() : null; },
      set(pfad, daten) { return nacheinander(pfad, () => mitWiederholung(() => db.doc(pfad).set(daten))); },
      del(pfad) { return nacheinander(pfad, () => mitWiederholung(() => db.doc(pfad).delete())); },
      async list(sammlung) {
        const s = await mitWiederholung(() => db.collection(sammlung).get());
        return s.docs.map((d) => ({ id: d.id, daten: d.data() }));
      },
      watchDoc(pfad, cb) { return db.doc(pfad).onSnapshot((s) => cb(s.exists ? s.data() : null), () => {}); },
      watchList(sammlung, cb) {
        return db.collection(sammlung).onSnapshot((s) => cb(s.docs.map((d) => ({ id: d.id, daten: d.data() }))), () => {});
      },
    };
  }

  async function init() {
    let db = null;
    if (window.claude && typeof window.claude.use === 'function') {
      db = await Promise.race([
        window.claude.use('db').catch(() => null),
        new Promise((r) => setTimeout(() => r(null), 6000)),
      ]);
    }
    if (db) { backend = cloudBackend(db); modus = 'cloud'; }
    else { backend = lokalesBackend(); modus = 'lokal'; }
    abarbeiten();
    return modus;
  }

  /* ---------- geöffneter Betrieb ---------- */
  const zustand = { fid: null, cfg: null, items: [], abos: [], hoerer: new Set() };
  const dateiCache = new Map();

  function oeffne(fid) {
    if (zustand.fid === fid) return;
    zustand.abos.forEach((u) => u());
    Object.assign(zustand, { fid, cfg: null, items: [], abos: [] });
    zustand.abos.push(backend.watchDoc(`b/${fid}/cfg/main`, (cfg) => { zustand.cfg = cfg; benachrichtige(); }));
    zustand.abos.push(backend.watchList(`b/${fid}/items`, (liste) => {
      zustand.items = liste.map((d) => ({ ...d.daten, id: d.id }));
      benachrichtige();
    }));
  }
  let geplant = false;
  function benachrichtige() {
    if (geplant) return; geplant = true;
    requestAnimationFrame(() => { geplant = false; zustand.hoerer.forEach((h) => h()); });
  }

  function uid(praefix = 'e') {
    return praefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Warteschlange für Schreibvorgänge ---------- */
  let benutzer = null;
  const WS_KEY = 'rw-warteschlange';
  let warteschlange = (() => { try { return JSON.parse(localStorage.getItem(WS_KEY) || '[]'); } catch { return []; } })();
  let laeuft = false;
  const merke = () => { try { localStorage.setItem(WS_KEY, JSON.stringify(warteschlange)); } catch { /* voll oder privat */ } };
  function schreibe(pfad, daten) {
    warteschlange = warteschlange.filter((w) => w.pfad !== pfad); // nur der letzte Stand zählt
    warteschlange.push({ pfad, daten });
    merke(); abarbeiten();
  }
  async function abarbeiten() {
    if (laeuft || !backend) return; laeuft = true;
    try {
      while (warteschlange.length) {
        const w = warteschlange[0];
        try { w.daten === null ? await backend.del(w.pfad) : await backend.set(w.pfad, w.daten); }
        catch (e) { console.warn('Später erneut:', w.pfad, e && e.message); break; }
        warteschlange.shift(); merke();
      }
    } finally { laeuft = false; benachrichtige(); }
  }
  window.addEventListener('online', abarbeiten);
  setInterval(() => { if (warteschlange.length) abarbeiten(); }, 20000);

  return {
    init,
    get modus() { return modus; },
    get fid() { return zustand.fid; },
    get cfg() { return zustand.cfg; },
    get items() { return zustand.items; },
    oeffne,
    abonniere(h) { zustand.hoerer.add(h); return () => zustand.hoerer.delete(h); },
    uid,

    /* Betriebsliste */
    async betriebe() { return (await backend.get('meta/betriebe')) || null; },
    async setzeBetriebe(liste) { await backend.set('meta/betriebe', { liste }); },
    async ladeCfg(fid) { return backend.get(`b/${fid}/cfg/main`); },

    /* Einstellungen */
    async speichereCfg(cfg, fid = zustand.fid) {
      const sauber = JSON.parse(JSON.stringify(cfg));
      if (fid === zustand.fid) { zustand.cfg = sauber; benachrichtige(); }
      await backend.set(`b/${fid}/cfg/main`, sauber);
    },

    /* Einträge. Schreiben ist optimistisch: die Anzeige ändert sich sofort,
       der Server bekommt die Änderung über die Warteschlange. Fällt das Netz
       aus (Funkloch auf der Baustelle), bleibt sie dort liegen und wird
       nachgeschickt, sobald wieder Verbindung besteht. */
    async neu(eintrag) {
      const id = eintrag.id || uid();
      const daten = { ...eintrag, erstellt: eintrag.erstellt || Date.now(), von: eintrag.von || benutzer || undefined };
      delete daten.id; if (daten.von === undefined) delete daten.von;
      zustand.items = [...zustand.items, { ...daten, id }]; benachrichtige();
      schreibe(`b/${zustand.fid}/items/${id}`, daten);
      return id;
    },
    async aendere(id, patch) {
      const alt = zustand.items.find((i) => i.id === id);
      if (!alt) return;
      const neu = { ...alt, ...patch, geaendert: Date.now() };
      const was = Object.keys(patch).filter((k) => k !== 'verlauf').join(', ');
      neu.verlauf = [...(alt.verlauf || []), { wer: benutzer || '', wann: Date.now(), was }].slice(-12);
      zustand.items = zustand.items.map((i) => (i.id === id ? neu : i)); benachrichtige();
      const daten = { ...neu }; delete daten.id;
      schreibe(`b/${zustand.fid}/items/${id}`, daten);
    },
    async loesche(id) {
      zustand.items = zustand.items.filter((i) => i.id !== id); benachrichtige();
      schreibe(`b/${zustand.fid}/items/${id}`, null);
    },
    setzeBenutzer(pid) { benutzer = pid || null; },
    get offen() { return warteschlange.length; },

    /* Dateien (Fotos, PDFs) */
    async speichereDatei(dataUrl, name) {
      if (dataUrl.length > 240000) throw new Error('Die Datei ist zu groß (max. ca. 170 KB). Fotos werden automatisch verkleinert, PDFs bitte kleiner speichern.');
      const id = uid('f');
      dateiCache.set(id, dataUrl);
      schreibe(`b/${zustand.fid}/dateien/${id}`, { daten: dataUrl, name: name || '' });
      return id;
    },
    async datei(id) {
      if (!id) return null;
      if (dateiCache.has(id)) return dateiCache.get(id);
      const d = await backend.get(`b/${zustand.fid}/dateien/${id}`);
      if (d) dateiCache.set(id, d.daten);
      return d ? d.daten : null;
    },

    /* Ganzen Betrieb ersetzen (Musterdaten / leeren) */
    async ersetzeBetrieb(fid, cfg, items, fortschritt) {
      const alt = await backend.list(`b/${fid}/items`);
      const neueIds = new Set(items.map((i) => i.id));
      const loeschen = alt.filter((d) => !neueIds.has(d.id));
      const aufgaben = [
        ...loeschen.map((d) => () => backend.del(`b/${fid}/items/${d.id}`)),
        ...items.map((i) => () => { const d = { ...i }; delete d.id; return backend.set(`b/${fid}/items/${i.id}`, d); }),
      ];
      let fertig = 0;
      const arbeiter = async () => {
        while (aufgaben.length) { await aufgaben.shift()(); fertig++; fortschritt && fortschritt(fertig); }
      };
      await backend.set(`b/${fid}/cfg/main`, cfg);
      await Promise.all([arbeiter(), arbeiter(), arbeiter()]);
      return fertig;
    },
  };
})();
