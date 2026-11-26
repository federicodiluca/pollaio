/** Tipi di evento: emoji, etichette e categoria ("neg" = classifica tacchini, "pos" = patatini). */
export const TIPI = {
  POLLO: { emoji: '🐔', nome: 'Pollo', descr: 'Ci sei cascato', categoria: 'neg' },
  TACCHINO: { emoji: '🦃', nome: 'Tacchino', descr: 'Ci sei cascato di brutto', categoria: 'neg' },
  SALAME: { emoji: '🥓', nome: 'Salame', descr: 'Con tutte le scarpe', categoria: 'neg' },
  PAGLIACCIO: { emoji: '🤡', nome: 'Pagliaccio', descr: 'Prendi il naso rosso', categoria: 'neg' },
  SPIEGO_PEGGIO: {
    emoji: '🙃',
    nome: 'Mi spiego peggio',
    descr: 'Me l\u2019hai fatto dire',
    categoria: 'neg',
  },
  PORCO_ME: { emoji: '🐷', nome: 'Porco me!', descr: 'Me l\u2019hai fatto dire', categoria: 'neg' },
  PATATINO: { emoji: '🥔', nome: 'Patatino', descr: 'Bravo!', categoria: 'pos' },
};

export const ORDINE_TIPI = [
  'POLLO',
  'TACCHINO',
  'SALAME',
  'PAGLIACCIO',
  'SPIEGO_PEGGIO',
  'PORCO_ME',
  'PATATINO',
];

export const CONFIG_DEFAULT = {
  'punti.POLLO': 1,
  'punti.TACCHINO': 2,
  'punti.SALAME': 3,
  'punti.PAGLIACCIO': 2,
  'punti.SPIEGO_PEGGIO': 1,
  'punti.PORCO_ME': 2,
  'punti.PATATINO': 1,
  'boia.soglia': 3,
};

export function puntiPer(config, tipo) {
  const v = Number((config || {})['punti.' + tipo]);
  return Number.isFinite(v) ? v : CONFIG_DEFAULT['punti.' + tipo] || 0;
}

/** "Boia dei matti!" scatta con un SALAME o con un evento negativo da almeno `boia.soglia` punti. */
export function eBoia(config, evento) {
  if (!TIPI[evento.tipo] || TIPI[evento.tipo].categoria !== 'neg') return false;
  const soglia = Number((config || {})['boia.soglia']) || CONFIG_DEFAULT['boia.soglia'];
  return evento.tipo === 'SALAME' || Number(evento.punti) >= soglia;
}
