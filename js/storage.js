/** Tutto quello che resta nel browser. Niente esce da qui se non verso la tua web app. */
const K = {
  config: 'pollaio.config',
  coda: 'pollaio.coda',
  demo: 'pollaio.demo.db',
  stato: (id) => 'pollaio.stato.' + id,
  audio: 'pollaio.audio',
};

function leggi(k, def = null) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

function scrivi(k, v) {
  if (v === null || v === undefined) localStorage.removeItem(k);
  else localStorage.setItem(k, JSON.stringify(v));
}

export const storage = {
  /** @returns {{modo: 'remoto'|'demo', url?: string, pin?: string} | null} */
  config: () => leggi(K.config),
  salvaConfig: (c) => scrivi(K.config, c),
  coda: () => leggi(K.coda, []),
  salvaCoda: (c) => scrivi(K.coda, c),
  demo: () => leggi(K.demo),
  salvaDemo: (db) => scrivi(K.demo, db),
  stato: (id) => leggi(K.stato(id)),
  salvaStato: (id, s) => scrivi(K.stato(id), s),
  audio: () => leggi(K.audio, true),
  salvaAudio: (v) => scrivi(K.audio, v),
  /** Esce: dimentica URL, PIN, coda e stati in cache (non i dati demo). */
  esci() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pollaio.') && k !== K.demo)
      .forEach((k) => localStorage.removeItem(k));
  },
  ripristinaDemo: () => localStorage.removeItem(K.demo),
};
