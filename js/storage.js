/** Quello che resta nel browser: collegamento e dati demo. */
const K = {
  config: 'pollaio.config',
  demo: 'pollaio.demo.db',
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
  demo: () => leggi(K.demo),
  salvaDemo: (db) => scrivi(K.demo, db),
  ripristinaDemo: () => localStorage.removeItem(K.demo),
  esci: () => localStorage.removeItem(K.config),
};
