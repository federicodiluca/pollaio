import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcola, eventiAttivi, vincitori, stagioni } from '../js/scoring.js';
import { eBoia } from '../js/tipi.js';
import { creaDbDemo } from '../js/demo-data.js';

const ORA = Date.parse('2026-11-20T10:00:00Z');
const s = (id, nome, attivo = true) => ({ id, classeId: 'X', nomeVisualizzato: nome, attivo });
let n = 0;
const ev = (studenteId, tipo, punti, giorno, extra = {}) => ({
  id: 'e' + ++n,
  timestamp: `2026-11-${String(giorno).padStart(2, '0')}T09:00:00.000Z`,
  classeId: 'X',
  studenteId,
  tipo,
  punti,
  nota: '',
  stagione: 1,
  ...extra,
});

function statoBase() {
  n = 0;
  return {
    stagione: 1,
    studenti: [s('a', 'Anna'), s('b', 'Bruno'), s('c', 'Carlo'), s('d', 'Dino', false)],
    eventi: [
      ev('a', 'POLLO', 1, 1),
      ev('a', 'SALAME', 3, 2),
      ev('b', 'TACCHINO', 2, 3),
      ev('b', 'PORCO_ME', 2, 4),
      ev('c', 'PATATINO', 1, 5),
      ev('c', 'PAGLIACCIO', 2, 6),
      ev('b', 'PAGLIACCIO', 2, 10),
      ev('c', 'PATATINO', 1, 11),
    ],
  };
}

test('eventiAttivi toglie gli annullati e gli ANNULLA', () => {
  const st = statoBase();
  st.eventi.push({ ...ev('a', 'ANNULLA', 0, 12), nota: 'e2' });
  const attivi = eventiAttivi(st.eventi);
  assert.equal(attivi.length, 7);
  assert.ok(!attivi.some((e) => e.id === 'e2'));
});

test('classifica tacchini con pari merito', () => {
  const { tacchini } = calcola(statoBase(), { ora: ORA });
  assert.deepEqual(
    tacchini.map((r) => [r.studente.nomeVisualizzato, r.neg, r.posizione]),
    [
      ['Bruno', 6, 1],
      ['Anna', 4, 2],
      ['Carlo', 2, 3],
    ],
  );
  const st = statoBase();
  st.eventi.push(ev('a', 'TACCHINO', 2, 12));
  const t2 = calcola(st, { ora: ORA }).tacchini;
  assert.deepEqual(
    t2.map((r) => r.posizione),
    [1, 1, 3],
  );
});

test('classifica patatini separata', () => {
  const { patatini } = calcola(statoBase(), { ora: ORA });
  assert.equal(patatini.length, 1);
  assert.equal(patatini[0].studente.id, 'c');
  assert.equal(patatini[0].pos, 2);
});

test('naso rosso: ultimo pagliaccio e giorni', () => {
  const { naso } = calcola(statoBase(), { ora: ORA });
  assert.equal(naso.studente.id, 'b');
  assert.equal(naso.giorni, 10);
});

test('annullare il pagliaccio restituisce il naso al precedente', () => {
  const st = statoBase();
  st.eventi.push({ ...ev('b', 'ANNULLA', 0, 12), nota: 'e7' });
  assert.equal(calcola(st, { ora: ORA }).naso.studente.id, 'c');
});

test('il naso passa tra le stagioni, la classifica no', () => {
  const st = statoBase();
  st.stagione = 2;
  const r = calcola(st, { ora: ORA });
  assert.equal(r.tacchini.length, 0);
  assert.equal(r.naso.studente.id, 'b');
  assert.deepEqual(stagioni(st), [2, 1]);
});

test('totali per tipo e perle in ordine dal più recente', () => {
  const r = calcola(statoBase(), { ora: ORA, perle: 3 });
  assert.equal(r.totali.PAGLIACCIO, 2);
  assert.equal(r.totali.PORCO_ME, 1);
  assert.deepEqual(
    r.perle.map((p) => p.id),
    ['e8', 'e7', 'e6'],
  );
});

test('studente non attivo compare solo se ha punti', () => {
  const st = statoBase();
  assert.ok(!calcola(st).tacchini.some((r) => r.studente.id === 'd'));
  st.eventi.push(ev('d', 'POLLO', 1, 12));
  assert.ok(calcola(st).tacchini.some((r) => r.studente.id === 'd'));
});

test('vincitori: salame e patatino d oro', () => {
  const v = vincitori(statoBase());
  assert.deepEqual(v.salameOro, [{ studenteId: 'b', nome: 'Bruno', punti: 6 }]);
  assert.deepEqual(v.patatinoOro, [{ studenteId: 'c', nome: 'Carlo', punti: 2 }]);
});

test('eBoia: salame sempre, altri sopra soglia, mai patatino', () => {
  const cfg = { 'boia.soglia': 3 };
  assert.ok(eBoia(cfg, { tipo: 'SALAME', punti: 1 }));
  assert.ok(!eBoia(cfg, { tipo: 'POLLO', punti: 1 }));
  assert.ok(eBoia(cfg, { tipo: 'PORCO_ME', punti: 3 }));
  assert.ok(!eBoia(cfg, { tipo: 'PATATINO', punti: 10 }));
});

test('dati demo deterministici e con albo calcolato', () => {
  const a = creaDbDemo(ORA);
  const b = creaDbDemo(ORA);
  assert.deepEqual(a, b);
  assert.equal(a.classi.length, 4);
  assert.ok(a.studenti.every((x) => x.id.startsWith('demo-')));
  const albo = JSON.parse(a.config['albo.5M']);
  assert.equal(albo[0].stagione, 1);
  assert.ok(albo[0].salameOro.length >= 1);
});
