import { storage } from './storage.js';
import { creaApi } from './api.js';
import { CATEGORIE, PER_ID, livello, podio } from './categorie.js';
import { $, el, icona, toast, parametro, scaricaJson, caricamento } from './ui.js';
import { boia, attivaScorciatoia } from './boia.js';

const config = storage.config();
const classeId = parametro('classe');
if (!config || !classeId) location.replace('./');

const api = creaApi(config);
let stato = null; // { classe, studenti }
let aperto = null; // id del ragazzo nel dialogo

const dlgRagazzo = $('#dlg-ragazzo');
const dlgMenu = $('#dlg-menu');

const VUOTI = {
  pollo: 'Nessun pollo. Per ora.',
  tacchino: 'Nessun tacchino. Sospetto.',
  salame: 'Nessun salame. Miracolo.',
  pagliaccio: 'Il naso rosso è nel cassetto.',
};

/* ------------------------------------------------------------------ */
/* Disegno                                                              */
/* ------------------------------------------------------------------ */

function barra(progresso, categoriaId) {
  return el(
    'span',
    { class: 'barra', 'aria-hidden': 'true' },
    el('span', {
      class: 'barra-piena c-' + categoriaId,
      style: `width:${Math.round(progresso * 100)}%`,
    }),
  );
}

function disegnaPodio(cat) {
  const righe = podio(stato.studenti, cat.id);
  // Disposizione classica: secondo, primo, terzo
  const gradino = (pos) =>
    righe
      .filter((r) => r.posizione === pos)
      .map((r) =>
        el(
          'li',
          { class: 'sul-podio' },
          pos === 1 && icona('corona', { classe: 'corona' }),
          el('span', { class: 'podio-nome' }, r.studente.nome),
          el('span', { class: 'podio-volte' }, r.volte),
        ),
      );
  return el(
    'article',
    { class: 'podio c-' + cat.id, 'aria-label': `Podio ${cat.plurale}` },
    el('h3', {}, icona(cat.id, { classe: 'icona-cat' }), cat.plurale),
    righe.length
      ? el(
          'div',
          { class: 'gradini' },
          ...[2, 1, 3].map((pos) =>
            el(
              'div',
              { class: `gradino g${pos}` },
              el('ol', { class: 'chi' }, ...gradino(pos)),
              el('div', { class: 'blocco' }, String(pos)),
            ),
          ),
        )
      : el('p', { class: 'vuoto' }, VUOTI[cat.id]),
  );
}

function disegnaRagazzo(s) {
  return el(
    'li',
    {},
    el(
      'button',
      { type: 'button', class: 'ragazzo', onclick: () => apri(s.id) },
      el('span', { class: 'ragazzo-nome' }, s.nome),
      s.titolo && el('span', { class: 'titolo-pill' }, s.titolo),
      el(
        'span',
        { class: 'ragazzo-livelli' },
        ...CATEGORIE.map((c) => {
          const n = s[c.id];
          const l = livello(n, c.id);
          return el(
            'span',
            { class: 'livello' + (n ? '' : ' zero') },
            icona(c.id, { classe: 'icona-cat piccola' }),
            el('span', { class: 'livello-nome' }, l.nome || c.nome),
            el('span', { class: 'livello-n' }, n),
            barra(l.progresso, c.id),
          );
        }),
      ),
    ),
  );
}

function disegna() {
  if (!stato) return;
  const nome = stato.classe.nome || stato.classe.id;
  $('#nome-classe').textContent = nome;
  document.title = `${nome}: Il Pollaio`;
  const attivi = stato.studenti
    .filter((s) => s.attivo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  $('#messaggio').replaceChildren(
    attivi.length ? '' : 'Classe vuota: aggiungi i ragazzi dal menu.',
  );
  $('#messaggio').classList.toggle('nascosto', attivi.length > 0);
  $('#podi').replaceChildren(...CATEGORIE.map(disegnaPodio));
  $('#ragazzi').replaceChildren(...attivi.map(disegnaRagazzo));
  if (aperto) disegnaDialogo();
  disegnaTolti();
}

/* ------------------------------------------------------------------ */
/* Dialogo del ragazzo                                                  */
/* ------------------------------------------------------------------ */

function apri(id) {
  aperto = id;
  const s = trova(id);
  $('#in-titolo').value = s.titolo;
  $('#in-nome').value = s.nome;
  dlgRagazzo.querySelector('details').open = false;
  disegnaDialogo();
  dlgRagazzo.showModal();
}

dlgRagazzo.addEventListener('close', () => (aperto = null));

function disegnaDialogo() {
  const s = trova(aperto);
  if (!s) return;
  $('#dlg-nome').textContent = s.nome;
  $('#dlg-titolo').textContent = s.titolo;
  $('#dlg-titolo').classList.toggle('nascosto', !s.titolo);
  $('#dlg-contatori').replaceChildren(
    ...CATEGORIE.map((c) => {
      const n = s[c.id];
      const l = livello(n, c.id);
      return el(
        'div',
        { class: 'contatore c-' + c.id },
        el(
          'button',
          {
            type: 'button',
            class: 'piu',
            'aria-label': `Più uno ${c.nome} a ${s.nome}`,
            onclick: () => conta(s.id, c.id, 1),
          },
          icona(c.id, { classe: 'icona-cat grande' }),
          el('span', { class: 'piu-testo' }, `+1 ${c.nome}`),
        ),
        el(
          'div',
          { class: 'contatore-info' },
          el('strong', {}, l.nome || 'Ancora niente'),
          barra(l.progresso, c.id),
          el(
            'span',
            { class: 'nota' },
            l.prossimo ? `${n} · ancora ${l.mancano} per ${l.prossimo}` : `${n} · livello massimo`,
          ),
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn tondo meno',
            disabled: n === 0,
            'aria-label': `Meno uno ${c.nome} a ${s.nome}`,
            onclick: () => conta(s.id, c.id, -1),
          },
          icona('meno'),
        ),
      );
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Azioni                                                               */
/* ------------------------------------------------------------------ */

const trova = (id) => stato && stato.studenti.find((s) => s.id === id);

function sostituisci(nuovo) {
  const i = stato.studenti.findIndex((s) => s.id === nuovo.id);
  if (i >= 0) stato.studenti[i] = nuovo;
  else stato.studenti.push(nuovo);
}

/** +1 / -1: si aggiorna subito, e se il server dice di no si torna indietro. */
async function conta(id, categoriaId, delta, { silenzioso = false } = {}) {
  const s = trova(id);
  if (!s || (delta < 0 && s[categoriaId] === 0)) return;
  const cat = PER_ID[categoriaId];
  const prima = livello(s[categoriaId], categoriaId);
  s[categoriaId] += delta;
  const dopo = livello(s[categoriaId], categoriaId);
  disegna();

  if (delta > 0 && !silenzioso) {
    const salito = dopo.indice > prima.indice && dopo.indice >= 2;
    toast(salito ? `${s.nome} ora è ${dopo.nome}!` : `+1 ${cat.nome} a ${s.nome}`, {
      azione: 'Annulla',
      durata: 5000,
      onAzione: () => conta(id, categoriaId, -1, { silenzioso: true }),
    });
  }

  try {
    const out = await api.scrivi('conta', { studenteId: id, categoria: categoriaId, delta });
    sostituisci(out.studente);
    disegna();
  } catch (e) {
    s[categoriaId] -= delta;
    disegna();
    toast(`Non salvato: ${e.message}. Riprova.`, { tipo: 'errore' });
  }
}

async function scrivi(action, payload, ok) {
  try {
    const out = await api.scrivi(action, payload);
    if (out.studente) sostituisci(out.studente);
    disegna();
    if (ok) toast(ok);
    return out;
  } catch (e) {
    toast(e.message, { tipo: 'errore' });
    return null;
  }
}

$('#btn-salva').addEventListener('click', async () => {
  const id = aperto;
  const out = await scrivi('editStudent', {
    studente: { id, titolo: $('#in-titolo').value.trim(), nome: $('#in-nome').value.trim() },
  });
  if (out) dlgRagazzo.querySelector('details').open = false;
});

$('#btn-disattiva').addEventListener('click', async () => {
  const s = trova(aperto);
  if (!confirm(`Togliere ${s.nome} dalla classe? Potrai rimetterlo dal menu.`)) return;
  dlgRagazzo.close();
  await scrivi('editStudent', { studente: { id: s.id, attivo: false } });
});

$('#btn-menu').addEventListener('click', () => {
  disegnaTolti();
  dlgMenu.showModal();
});

function disegnaTolti() {
  const tolti = stato ? stato.studenti.filter((s) => !s.attivo) : [];
  $('#tolti').replaceChildren(
    ...(tolti.length
      ? [
          el('p', { class: 'nota' }, 'Tolti dalla classe:'),
          ...tolti.map((s) =>
            el(
              'button',
              {
                type: 'button',
                class: 'btn piccolo',
                onclick: () => scrivi('editStudent', { studente: { id: s.id, attivo: true } }),
              },
              `Rimetti ${s.nome}`,
            ),
          ),
        ]
      : []),
  );
}

$('#btn-aggiungi').addEventListener('click', async () => {
  const nome = $('#in-nuovo').value.trim();
  if (!nome) return;
  const out = await scrivi(
    'addStudent',
    { studente: { classeId, nome } },
    `${nome} entra nel pollaio`,
  );
  if (out) $('#in-nuovo').value = '';
});

$('#btn-backup').addEventListener('click', async () => {
  try {
    scaricaJson(await api.exportAll());
  } catch (e) {
    toast('Backup non riuscito: ' + e.message, { tipo: 'errore' });
  }
});

$('#btn-azzera').addEventListener('click', async () => {
  if (!confirm('Azzerare tutti i contatori di questa classe? Prima scarico un backup.')) return;
  try {
    scaricaJson(await api.exportAll());
  } catch (e) {
    toast('Backup non riuscito, non azzero: ' + e.message, { tipo: 'errore' });
    return;
  }
  dlgMenu.close();
  await scrivi('azzera', { classeId }, 'Contatori azzerati. Si ricomincia!');
  await aggiorna();
});

/* ------------------------------------------------------------------ */
/* Boia dei matti, schermo intero, avvio                               */
/* ------------------------------------------------------------------ */

$('#btn-boia').addEventListener('click', boia);
attivaScorciatoia();

$('#btn-schermo').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () =>
  document.body.classList.toggle('lim', !!document.fullscreenElement),
);

async function aggiorna() {
  try {
    stato = await api.getClasse(classeId);
    disegna();
  } catch (e) {
    if (!stato) $('#messaggio').replaceChildren('Non riesco ad aprire la classe: ' + e.message);
  }
}

// Si aggiorna da solo (utile se la LIM e il telefono sono aperti insieme)
setInterval(() => {
  if (document.visibilityState === 'visible' && !aperto && !dlgMenu.open) aggiorna();
}, 20000);
window.addEventListener('storage', (e) => e.key === 'pollaio.demo.db' && aggiorna());

$('#messaggio').replaceChildren(caricamento('Apro il pollaio...'));
aggiorna();
