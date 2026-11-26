/**
 * Dati DEMO: tutti i nomi sono inventati. Nessun dato reale deve mai finire in questo file.
 */
import { CATEGORIE } from './categorie.js';

const CLASSI = {
  '1M': [
    'Gino P.',
    'Ada T.',
    'Bruno S.',
    'Carla Z.',
    'Dario F.',
    'Elsa M.',
    'Fabio R.',
    'Greta L.',
  ],
  '3J': ['Ivo C.', 'Lara B.', 'Mirko D.', 'Nina G.', 'Otto V.', 'Pia S.', 'Quinto A.', 'Rita E.'],
  '4M': ['Sandro N.', 'Tea O.', 'Ugo P.', 'Vera Q.', 'Walter U.', 'Zoe I.', 'Aldo K.', 'Bice J.'],
  '5M': ['Ciro H.', 'Dora W.', 'Enzo X.', 'Flora Y.', 'Gigi T.', 'Ines R.', 'Leo M.', 'Mara C.'],
};

const TITOLI = ['Re del copia-incolla', 'Commit sul main', 'Ha confuso = con ==', 'Wi-fi umano'];

/** Generatore pseudo-casuale con seme: i dati demo sono sempre gli stessi. */
function rng(seme) {
  let x = seme >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

export function creaDbDemo() {
  const r = rng(42);
  const classi = [];
  const studenti = [];
  let t = 0;
  for (const [classeId, nomi] of Object.entries(CLASSI)) {
    classi.push({ id: classeId, nome: classeId });
    nomi.forEach((nome, i) => {
      const s = {
        id: `demo-${classeId.toLowerCase()}-${String(i + 1).padStart(2, '0')}`,
        classeId,
        nome,
        titolo: i === 1 || i === 5 ? TITOLI[t++ % TITOLI.length] : '',
        attivo: true,
      };
      for (const c of CATEGORIE) s[c.id] = Math.floor(r() * r() * (c.id === 'pollo' ? 14 : 9));
      studenti.push(s);
    });
  }
  return { classi, studenti };
}
