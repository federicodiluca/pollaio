/**
 * Dati DEMO: tutti i nomi sono inventati. Nessun dato reale deve mai finire in questo file.
 */
import { CONFIG_DEFAULT } from './tipi.js';
import { vincitori } from './scoring.js';

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

const PESI = [
  ['POLLO', 6],
  ['TACCHINO', 4],
  ['SALAME', 2],
  ['PAGLIACCIO', 2],
  ['SPIEGO_PEGGIO', 3],
  ['PORCO_ME', 2],
  ['PATATINO', 5],
];

const NOTE = [
  '',
  '',
  '',
  'ha confuso = con ==',
  'for senza graffe',
  'ha chiesto se il wifi è un linguaggio',
  'ha fatto il commit sul main',
  'risposta perfetta',
  'ha aiutato il compagno',
];

/** Generatore pseudo-casuale con seme: i dati demo sono sempre gli stessi. */
function rng(seme) {
  let s = seme >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function scegliPesato(r, voci) {
  const tot = voci.reduce((a, [, p]) => a + p, 0);
  let x = r() * tot;
  for (const [v, p] of voci) {
    x -= p;
    if (x < 0) return v;
  }
  return voci[0][0];
}

export function creaDbDemo(ora = Date.now()) {
  const r = rng(42);
  const classi = [];
  const studenti = [];
  const eventi = [];
  const config = Object.fromEntries(Object.entries(CONFIG_DEFAULT).map(([k, v]) => [k, String(v)]));
  let n = 0;

  for (const [classeId, nomi] of Object.entries(CLASSI)) {
    classi.push({ id: classeId, nome: classeId });
    const ids = nomi.map((nome, i) => {
      const id = `demo-${classeId.toLowerCase()}-${String(i + 1).padStart(2, '0')}`;
      studenti.push({ id, classeId, nomeVisualizzato: nome, attivo: true });
      return id;
    });

    // La 5M ha già chiuso una stagione: c'è qualcosa nell'albo d'oro
    const stagioni = classeId === '5M' ? [1, 2] : [1];
    for (const stagione of stagioni) {
      const vecchia = stagione < stagioni.length;
      const quanti = 18 + Math.floor(r() * 14);
      for (let k = 0; k < quanti; k++) {
        const tipo = scegliPesato(r, PESI);
        const giorniFa = vecchia ? 40 + r() * 60 : r() * 21;
        eventi.push({
          id: `demo-ev-${++n}`,
          timestamp: new Date(ora - giorniFa * 864e5).toISOString(),
          classeId,
          studenteId: ids[Math.floor(r() * r() * ids.length)],
          tipo,
          punti: Number(config['punti.' + tipo]),
          nota: NOTE[Math.floor(r() * NOTE.length)],
          stagione,
        });
      }
    }
    config['stagione.' + classeId] = String(stagioni.length);
  }

  // Albo d'oro della 5M calcolato dagli eventi della stagione 1
  const stato5M = {
    studenti: studenti.filter((s) => s.classeId === '5M'),
    eventi: eventi.filter((e) => e.classeId === '5M'),
    stagione: 2,
  };
  config['albo.5M'] = JSON.stringify([
    {
      stagione: 1,
      chiusaIl: new Date(ora - 35 * 864e5).toISOString(),
      ...vincitori(stato5M, 1),
    },
  ]);

  eventi.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { classi, studenti, eventi, config };
}
