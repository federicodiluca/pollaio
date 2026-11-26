import { storage } from './storage.js';
import { creaDbDemo } from './demo-data.js';
import { CATEGORIE, PER_ID } from './categorie.js';

export class ErroreServer extends Error {}

/** Crea l'API giusta in base alla configurazione salvata. */
export function creaApi(config = storage.config()) {
  if (!config) throw new Error('Configurazione mancante');
  return config.modo === 'demo' ? apiDemo() : apiRemota(config);
}

/* ------------------------------------------------------------------ */
/* Web app Apps Script                                                  */
/* ------------------------------------------------------------------ */

function apiRemota({ url, pin }) {
  async function chiama(input, init) {
    let r;
    try {
      r = await fetch(input, init);
    } catch {
      throw new Error('Rete non disponibile');
    }
    if (!r.ok) throw new Error('Il server ha risposto ' + r.status);
    let j;
    try {
      j = await r.json();
    } catch {
      throw new ErroreServer('Risposta strana: controlla che l’URL finisca con /exec');
    }
    if (!j.ok) throw new ErroreServer(j.errore || 'Errore sconosciuto');
    return j.data;
  }

  function leggi(action, params = {}) {
    const u = new URL(url);
    Object.entries({ ...params, action, pin }).forEach(([k, v]) => u.searchParams.set(k, v));
    return chiama(u, { cache: 'no-store' });
  }

  function scrivi(action, payload) {
    return chiama(url, {
      method: 'POST',
      // text/plain evita il preflight CORS, che Apps Script non gestisce
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action, pin }),
    });
  }

  return {
    listClassi: () => leggi('listClassi'),
    getClasse: (classeId) => leggi('getClasse', { classeId }),
    exportAll: () => leggi('exportAll'),
    scrivi,
  };
}

/* ------------------------------------------------------------------ */
/* Demo: stessa logica, ma nel localStorage                             */
/* ------------------------------------------------------------------ */

const pausa = () => new Promise((r) => setTimeout(r, 100));

function apiDemo() {
  const db = () => storage.demo() || creaDbDemo();
  const trova = (d, id) => {
    const s = d.studenti.find((x) => x.id === id);
    if (!s) throw new ErroreServer('Studente non trovato');
    return s;
  };

  const scritture = {
    conta(d, { studenteId, categoria, delta }) {
      if (!PER_ID[categoria]) throw new ErroreServer('Categoria non valida: ' + categoria);
      const s = trova(d, studenteId);
      s[categoria] = Math.max(0, s[categoria] + (delta === -1 ? -1 : 1));
      return { studente: s };
    },
    addClass(d, { classe }) {
      const id = String(classe.id || '').trim();
      if (!id) throw new ErroreServer('Parametro mancante: id');
      if (d.classi.some((c) => c.id === id)) throw new ErroreServer('Classe già esistente: ' + id);
      const nuova = { id, nome: classe.nome || id };
      d.classi.push(nuova);
      return { classe: nuova };
    },
    addStudent(d, { studente }) {
      const nome = String(studente.nome || '')
        .trim()
        .slice(0, 40);
      if (!nome) throw new ErroreServer('Parametro mancante: nome');
      const nuovo = {
        id: 'demo-' + Date.now().toString(36),
        classeId: studente.classeId,
        nome,
        titolo: String(studente.titolo || '').slice(0, 60),
        attivo: true,
        ...Object.fromEntries(CATEGORIE.map((c) => [c.id, 0])),
      };
      d.studenti.push(nuovo);
      return { studente: nuovo };
    },
    editStudent(d, { studente }) {
      const s = trova(d, studente.id);
      if (studente.nome !== undefined) s.nome = String(studente.nome).trim().slice(0, 40) || s.nome;
      if (studente.titolo !== undefined) s.titolo = String(studente.titolo).trim().slice(0, 60);
      if (studente.attivo !== undefined) s.attivo = !!studente.attivo;
      return { studente: s };
    },
    azzera(d, { classeId }) {
      const della = d.studenti.filter((s) => s.classeId === classeId);
      della.forEach((s) => CATEGORIE.forEach((c) => (s[c.id] = 0)));
      return { azzerati: della.length };
    },
  };

  return {
    async listClassi() {
      await pausa();
      return db().classi;
    },
    async getClasse(classeId) {
      await pausa();
      const d = db();
      const classe = d.classi.find((c) => c.id === classeId);
      if (!classe) throw new ErroreServer('Classe non trovata: ' + classeId);
      return structuredClone({
        classe,
        studenti: d.studenti.filter((s) => s.classeId === classeId),
      });
    },
    async exportAll() {
      return { esportatoIl: new Date().toISOString(), demo: true, ...db() };
    },
    async scrivi(action, payload) {
      await pausa();
      const f = scritture[action];
      if (!f) throw new ErroreServer('Azione sconosciuta: ' + action);
      const d = db();
      const out = f(d, payload);
      storage.salvaDemo(d);
      return structuredClone(out);
    },
  };
}
