import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livello, podio } from '../js/categorie.js';
import { creaDbDemo } from '../js/demo-data.js';

test('livelli: nomi e soglie', () => {
  assert.equal(livello(0, 'tacchino').nome, null);
  assert.equal(livello(1, 'tacchino').nome, 'Tacchino');
  assert.equal(livello(3, 'tacchino').nome, 'Super Tacchino');
  assert.equal(livello(6, 'tacchino').nome, 'Turbo Tacchino');
  assert.equal(livello(10, 'pollo').nome, 'Mega Pollo');
  assert.equal(livello(99, 'salame').nome, 'Salame Leggendario');
});

test('livelli: barra di avanzamento verso il prossimo', () => {
  const l = livello(4, 'tacchino');
  assert.equal(l.prossimo, 'Turbo Tacchino');
  assert.equal(l.mancano, 2);
  assert.ok(Math.abs(l.progresso - 4 / 6) < 1e-9);
  assert.equal(livello(0, 'pollo').progresso, 0);
  const max = livello(20, 'pollo');
  assert.equal(max.prossimo, null);
  assert.equal(max.progresso, 1);
});

const s = (nome, tacchino, attivo = true) => ({ id: nome, nome, tacchino, attivo });

test('podio: primi tre, pari merito, esclusi zero e inattivi', () => {
  const studenti = [
    s('Anna', 5),
    s('Bruno', 7),
    s('Carlo', 5),
    s('Dino', 2),
    s('Ezio', 0),
    s('Furio', 9, false),
  ];
  assert.deepEqual(
    podio(studenti, 'tacchino').map((r) => [r.studente.nome, r.posizione]),
    [
      ['Bruno', 1],
      ['Anna', 2],
      ['Carlo', 2],
    ],
  );
  assert.equal(podio([s('Ezio', 0)], 'tacchino').length, 0);
});

test('dati demo deterministici e inventati', () => {
  const a = creaDbDemo();
  assert.deepEqual(a, creaDbDemo());
  assert.equal(a.classi.length, 4);
  assert.ok(a.studenti.every((x) => x.id.startsWith('demo-')));
  assert.ok(a.studenti.some((x) => x.titolo));
});
