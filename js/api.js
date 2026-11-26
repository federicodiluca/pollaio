import { storage } from './storage.js';
import { creaDbDemo } from './demo-data.js';
import { TIPI, puntiPer } from './tipi.js';
import { vincitori } from './scoring.js';

/** La rete non risponde: l'operazione si può riprovare. */
export class ErroreRete extends Error {}
/** Il server ha risposto con un errore: riprovare non serve. */
export class ErroreServer extends Error {}

export function nuovoId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Crea l'API giusta in base alla configurazione salvata. */
export function creaApi(config = storage.config()) {
  if (!config) throw new Error('Configurazione mancante');
  return config.modo === 'demo' ? apiDemo() : apiRemota(config);
}

/* ------------------------------------------------------------------ */

function apiRemota({ url, pin }) {
  async function chiama(input, init) {
    let r;
    try {
      r = await fetch(input, init);
    } catch (e) {
      throw new ErroreRete('Rete non disponibile: ' + e.message);
    }
    if (!r.ok) throw new ErroreRete('Risposta HTTP ' + r.status);
    let j;
    try {
      j = await r.json();
    } catch {
      throw new ErroreServer(
        'Risposta non valida: controlla che l’URL sia quello della web app (/exec)',
      );
    }
    if (!j.ok) throw new ErroreServer(j.errore || 'Errore sconosciuto');
    return j.data;
  }

  function leggi(action, params = {}) {
    const u = new URL(url);
    u.searchParams.set('action', action);
    u.searchParams.set('pin', pin);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return chiama(u, { redirect: 'follow', cache: 'no-store' });
  }

  function scrivi(action, payload) {
    return chiama(url, {
      method: 'POST',
      redirect: 'follow',
      // text/plain evita il preflight CORS, che Apps Script non gestisce
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action, pin }),
    });
  }

  return {
    modo: 'remoto',
    listClassi: () => leggi('listClassi'),
    getState: (classeId) => leggi('getState', { classeId }),
    exportAll: () => leggi('exportAll'),
    scrivi,
  };
}

/* ------------------------------------------------------------------ */
/* Modalità demo: stessa logica del server, ma su localStorage          */
/* ------------------------------------------------------------------ */

const pausa = () => new Promise((r) => setTimeout(r, 120));

function apiDemo() {
  const db = () => {
    let d = storage.demo();
    if (!d) {
      d = creaDbDemo();
      storage.salvaDemo(d);
    }
    return d;
  };
  const stagioneDi = (d, classeId) => Number(d.config['stagione.' + classeId]) || 1;
  const albo = (d, classeId) => JSON.parse(d.config['albo.' + classeId] || '[]');

  function stato(d, classeId) {
    const classe = d.classi.find((c) => c.id === classeId);
    if (!classe) throw new ErroreServer('Classe non trovata: ' + classeId);
    return {
      classe,
      studenti: d.studenti.filter((s) => s.classeId === classeId),
      eventi: d.eventi.filter((e) => e.classeId === classeId),
      config: Object.fromEntries(
        Object.entries(d.config)
          .filter(([k]) => k.startsWith('punti.') || k.startsWith('boia.'))
          .map(([k, v]) => [k, Number(v)]),
      ),
      stagione: stagioneDi(d, classeId),
      albo: albo(d, classeId),
    };
  }

  const scritture = {
    addEvent(d, { evento: ev }) {
      const gia = d.eventi.find((e) => e.id === ev.id);
      if (gia) return { evento: gia, duplicato: true };
      if (!TIPI[ev.tipo]) throw new ErroreServer('Tipo di evento non valido: ' + ev.tipo);
      const s = d.studenti.find((x) => x.id === ev.studenteId);
      if (!s || s.classeId !== ev.classeId) throw new ErroreServer('Studente non trovato');
      const nuovo = {
        id: ev.id || nuovoId(),
        timestamp: ev.timestamp || new Date().toISOString(),
        classeId: s.classeId,
        studenteId: s.id,
        tipo: ev.tipo,
        punti: puntiPer(d.config, ev.tipo),
        nota: String(ev.nota || '').slice(0, 200),
        stagione: stagioneDi(d, s.classeId),
      };
      d.eventi.push(nuovo);
      return { evento: nuovo };
    },
    undoEvent(d, { id }) {
      const idAnnulla = 'undo-' + id;
      const gia = d.eventi.find((e) => e.id === idAnnulla);
      if (gia) return { evento: gia, duplicato: true };
      const o = d.eventi.find((e) => e.id === id);
      if (!o) throw new ErroreServer('Evento da annullare non trovato');
      const nuovo = {
        ...o,
        id: idAnnulla,
        tipo: 'ANNULLA',
        punti: 0,
        nota: o.id,
        timestamp: new Date().toISOString(),
      };
      d.eventi.push(nuovo);
      return { evento: nuovo };
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
      const nome = String(studente.nomeVisualizzato || '')
        .trim()
        .slice(0, 40);
      if (!nome) throw new ErroreServer('Parametro mancante: nomeVisualizzato');
      if (!d.classi.some((c) => c.id === studente.classeId)) {
        throw new ErroreServer('Classe non trovata: ' + studente.classeId);
      }
      const nuovo = {
        id: studente.id || nuovoId(),
        classeId: studente.classeId,
        nomeVisualizzato: nome,
        attivo: true,
      };
      d.studenti.push(nuovo);
      return { studente: nuovo };
    },
    editStudent(d, { studente }) {
      const s = d.studenti.find((x) => x.id === studente.id);
      if (!s) throw new ErroreServer('Studente non trovato');
      if (studente.nomeVisualizzato !== undefined) {
        s.nomeVisualizzato = String(studente.nomeVisualizzato).trim().slice(0, 40);
      }
      if (studente.attivo !== undefined) s.attivo = !!studente.attivo;
      return { studente: s };
    },
    newSeason(d, { classeId }) {
      const st = stato(d, classeId);
      const voce = { stagione: st.stagione, chiusaIl: new Date().toISOString(), ...vincitori(st) };
      d.config['albo.' + classeId] = JSON.stringify([...st.albo, voce]);
      d.config['stagione.' + classeId] = String(st.stagione + 1);
      return { chiusa: voce, nuovaStagione: st.stagione + 1 };
    },
  };

  return {
    modo: 'demo',
    async listClassi() {
      await pausa();
      return db().classi;
    },
    async getState(classeId) {
      await pausa();
      return structuredClone(stato(db(), classeId));
    },
    async exportAll() {
      return { esportatoIl: new Date().toISOString(), demo: true, ...structuredClone(db()) };
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
