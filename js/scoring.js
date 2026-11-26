import { TIPI } from './tipi.js';

const GIORNO = 24 * 3600 * 1000;

/** Eventi validi: senza gli ANNULLA e senza gli eventi annullati. */
export function eventiAttivi(eventi) {
  const annullati = new Set(eventi.filter((e) => e.tipo === 'ANNULLA').map((e) => e.nota));
  return eventi.filter((e) => e.tipo !== 'ANNULLA' && !annullati.has(e.id) && TIPI[e.tipo]);
}

function perTempo(a, b) {
  return String(a.timestamp).localeCompare(String(b.timestamp));
}

function ordinaEPosiziona(righe, campo) {
  const ordinate = righe
    .filter((r) => r[campo] > 0)
    .map((r) => ({ ...r }))
    .sort(
      (a, b) =>
        b[campo] - a[campo] ||
        a.studente.nomeVisualizzato.localeCompare(b.studente.nomeVisualizzato, 'it'),
    );
  ordinate.forEach((r, i) => {
    r.posizione = i > 0 && ordinate[i - 1][campo] === r[campo] ? ordinate[i - 1].posizione : i + 1;
  });
  return ordinate;
}

/** Elenco delle stagioni presenti, dalla più recente. */
export function stagioni(stato) {
  const s = new Set(stato.eventi.map((e) => Number(e.stagione) || 1));
  s.add(stato.stagione);
  return [...s].sort((a, b) => b - a);
}

/**
 * Calcola tutto quello che serve alle viste.
 * @returns {{tacchini, patatini, naso, perle, totali, perStudente}}
 */
export function calcola(stato, { stagione = stato.stagione, ora = Date.now(), perle = 8 } = {}) {
  const studenti = new Map(stato.studenti.map((s) => [s.id, s]));
  const tutti = eventiAttivi(stato.eventi);
  const ev = tutti.filter((e) => (Number(e.stagione) || 1) === stagione);

  const righe = new Map();
  const riga = (id) => {
    if (!righe.has(id)) {
      const s = studenti.get(id);
      if (!s) return null;
      righe.set(id, { studente: s, neg: 0, pos: 0, conteggi: {} });
    }
    return righe.get(id);
  };
  stato.studenti.filter((s) => s.attivo).forEach((s) => riga(s.id));

  const totali = {};
  for (const e of ev) {
    totali[e.tipo] = (totali[e.tipo] || 0) + 1;
    const r = riga(e.studenteId);
    if (!r) continue;
    r[TIPI[e.tipo].categoria] += Number(e.punti) || 0;
    r.conteggi[e.tipo] = (r.conteggi[e.tipo] || 0) + 1;
  }

  // Il naso rosso passa di mano in mano anche tra una stagione e l'altra
  const ultimoNaso = tutti
    .filter((e) => e.tipo === 'PAGLIACCIO')
    .sort(perTempo)
    .pop();
  let naso = null;
  if (ultimoNaso && studenti.has(ultimoNaso.studenteId)) {
    naso = {
      studente: studenti.get(ultimoNaso.studenteId),
      dal: ultimoNaso.timestamp,
      giorni: Math.max(0, Math.floor((ora - Date.parse(ultimoNaso.timestamp)) / GIORNO)),
    };
  }

  return {
    tacchini: ordinaEPosiziona([...righe.values()], 'neg'),
    patatini: ordinaEPosiziona([...righe.values()], 'pos'),
    naso,
    perle: ev
      .slice()
      .sort(perTempo)
      .reverse()
      .slice(0, perle)
      .map((e) => ({ ...e, studente: studenti.get(e.studenteId) || null })),
    totali,
    perStudente: Object.fromEntries([...righe].map(([id, r]) => [id, r])),
  };
}

/** Salame d'oro e Patatino d'oro di una stagione (a pari merito vincono tutti). */
export function vincitori(stato, stagione = stato.stagione) {
  const { tacchini, patatini } = calcola(stato, { stagione });
  const primi = (lista, campo) =>
    lista
      .filter((r) => r.posizione === 1)
      .map((r) => ({
        studenteId: r.studente.id,
        nome: r.studente.nomeVisualizzato,
        punti: r[campo],
      }));
  return { salameOro: primi(tacchini, 'neg'), patatinoOro: primi(patatini, 'pos') };
}
