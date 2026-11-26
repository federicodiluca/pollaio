/** Le quattro categorie, i livelli e i podi. Niente punti: solo contatori. */

export const CATEGORIE = [
  { id: 'pollo', nome: 'Pollo', plurale: 'Polli' },
  { id: 'tacchino', nome: 'Tacchino', plurale: 'Tacchini' },
  { id: 'salame', nome: 'Salame', plurale: 'Salami' },
  { id: 'pagliaccio', nome: 'Pagliaccio', plurale: 'Pagliacci' },
];

export const PER_ID = Object.fromEntries(CATEGORIE.map((c) => [c.id, c]));

/** Soglie dei livelli: da quante volte in su. */
export const LIVELLI = [
  { da: 1, nome: (n) => n },
  { da: 3, nome: (n) => `Super ${n}` },
  { da: 6, nome: (n) => `Turbo ${n}` },
  { da: 10, nome: (n) => `Mega ${n}` },
  { da: 15, nome: (n) => `${n} Leggendario` },
];

/**
 * Livello raggiunto con `n` volte nella categoria.
 * @returns {{indice: number, nome: string|null, prossimo: string|null, mancano: number, progresso: number}}
 */
export function livello(n, categoriaId) {
  const nomeCat = PER_ID[categoriaId].nome;
  let i = -1;
  LIVELLI.forEach((l, k) => {
    if (n >= l.da) i = k;
  });
  const attuale = LIVELLI[i];
  const succ = LIVELLI[i + 1];
  return {
    indice: i + 1,
    nome: attuale ? attuale.nome(nomeCat) : null,
    prossimo: succ ? succ.nome(nomeCat) : null,
    mancano: succ ? succ.da - n : 0,
    progresso: succ ? n / succ.da : 1,
  };
}

/** I primi tre (con pari merito) di una categoria, solo chi ha almeno 1. */
export function podio(studenti, categoriaId, quanti = 3) {
  const ordinati = studenti
    .filter((s) => s.attivo && s[categoriaId] > 0)
    .sort((a, b) => b[categoriaId] - a[categoriaId] || a.nome.localeCompare(b.nome, 'it'));
  const out = [];
  ordinati.forEach((s, i) => {
    const posizione =
      i > 0 && ordinati[i - 1][categoriaId] === s[categoriaId] ? out[i - 1].posizione : i + 1;
    out.push({ studente: s, volte: s[categoriaId], posizione });
  });
  return out.filter((r) => r.posizione <= quanti);
}
