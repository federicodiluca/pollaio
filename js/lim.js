import { storage } from './storage.js';
import { creaApi } from './api.js';
import { calcola, eventiAttivi, stagioni } from './scoring.js';
import { TIPI, ORDINE_TIPI, eBoia } from './tipi.js';
import { $, el, quandoFa, giorniTesto, parametro, riduciMovimento } from './ui.js';
import { boia, sbloccaAudio } from './boia.js';
import { registraSw } from './sw-registra.js';

registraSw();

const config = storage.config();
const classeId = parametro('classe');
if (!config || !classeId) location.replace('./');

const api = creaApi(config);
const MAX_TACCHINI = 10;
const MAX_PATATINI = 6;
const INTERVALLO = 15000;

let base = null;
let stagioneVista = null; // null = stagione corrente
let visti = null; // id degli eventi già visti: null finché non arriva il primo caricamento

/* ------------------------------------------------------------------ */
/* Classifiche con animazione FLIP                                       */
/* ------------------------------------------------------------------ */

function posizioniPrima(lista) {
  const m = new Map();
  for (const li of lista.children) {
    if (li.dataset.id) m.set(li.dataset.id, li.getBoundingClientRect().top);
  }
  return m;
}

function animaSpostamenti(lista, prima, nuovi) {
  if (riduciMovimento()) return;
  for (const li of lista.children) {
    const id = li.dataset.id;
    if (!id) continue;
    if (prima.has(id)) {
      const dy = prima.get(id) - li.getBoundingClientRect().top;
      if (dy) {
        li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        });
      }
    } else {
      li.animate(
        [
          { opacity: 0, transform: 'scale(0.9)' },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: 400,
        },
      );
    }
    if (nuovi.has(id)) li.classList.add('lampo');
  }
}

function conteggi(r, categoria) {
  return ORDINE_TIPI.filter((t) => TIPI[t].categoria === categoria && r.conteggi[t])
    .map((t) => `${TIPI[t].emoji}${r.conteggi[t] > 1 ? '×' + r.conteggi[t] : ''}`)
    .join(' ');
}

function disegnaClassifica(lista, righe, campo, categoria, max, nuovi, vuoto) {
  const prima = posizioniPrima(lista);
  const top = righe.slice(0, max);
  const massimo = top.length ? top[0][campo] : 1;
  lista.replaceChildren(
    ...(top.length
      ? top.map((r) =>
          el(
            'li',
            {
              dataset: { id: r.studente.id },
              class: 'riga' + (r.posizione === 1 ? ' primo' : ''),
            },
            el(
              'span',
              { class: 'pos' },
              r.posizione === 1 ? (campo === 'neg' ? '👑' : '🌟') : r.posizione,
            ),
            el(
              'span',
              { class: 'chi' },
              el('span', { class: 'nome' }, r.studente.nomeVisualizzato),
              el('span', { class: 'dettaglio' }, conteggi(r, categoria)),
              el(
                'span',
                { class: 'barra-punti', 'aria-hidden': 'true' },
                el('span', { style: `width:${Math.round((r[campo] / massimo) * 100)}%` }),
              ),
            ),
            el('span', { class: 'punti' }, r[campo]),
          ),
        )
      : [el('li', { class: 'vuoto' }, vuoto)]),
  );
  animaSpostamenti(lista, prima, nuovi);
}

/* ------------------------------------------------------------------ */
/* Disegno                                                              */
/* ------------------------------------------------------------------ */

function disegna(nuovi = new Set()) {
  if (!base) return;
  const stagione = stagioneVista ?? base.stagione;
  const corrente = stagione === base.stagione;
  const calc = calcola(base, { stagione, perle: 6 });

  $('#messaggio').classList.add('nascosto');
  $('#nome-classe').textContent = base.classe.nome || base.classe.id;
  document.title = `${base.classe.nome || base.classe.id}: Il Pollaio`;

  // Selettore stagione
  const sel = $('#sel-stagione');
  const elenco = stagioni(base);
  sel.replaceChildren(
    ...elenco.map((s) =>
      el(
        'option',
        { value: s, selected: s === stagione },
        s === base.stagione ? `Stagione ${s} (in corso)` : `Stagione ${s}`,
      ),
    ),
  );

  // Banner per le stagioni passate
  const banner = $('#banner-storico');
  const voce = base.albo.find((a) => Number(a.stagione) === stagione);
  banner.classList.toggle('nascosto', corrente);
  if (!corrente) {
    const nomi = (l) => (l && l.length ? l.map((x) => x.nome).join(', ') : 'nessuno');
    banner.textContent = voce
      ? `Stagione ${stagione} chiusa · 🥓 Salame d'oro: ${nomi(voce.salameOro)} · 🥔 Patatino d'oro: ${nomi(voce.patatinoOro)}`
      : `Stagione ${stagione}`;
  }

  disegnaClassifica(
    $('#tacchini'),
    calc.tacchini,
    'neg',
    'neg',
    MAX_TACCHINI,
    nuovi,
    'Nessun tacchino. Sospetto.',
  );
  disegnaClassifica(
    $('#patatini'),
    calc.patatini,
    'pos',
    'pos',
    MAX_PATATINI,
    nuovi,
    'Nessun patatino ancora. Coraggio!',
  );

  // Naso rosso
  const naso = $('#naso');
  if (calc.naso) {
    naso.replaceChildren(
      el('span', { class: 'naso-emoji', 'aria-hidden': 'true' }, '🤡'),
      el('strong', { class: 'naso-nome' }, calc.naso.studente.nomeVisualizzato),
      el('span', { class: 'naso-giorni' }, giorniTesto(calc.naso.giorni)),
    );
  } else {
    naso.replaceChildren(
      el('span', { class: 'naso-emoji spento', 'aria-hidden': 'true' }, '🤡'),
      el('span', { class: 'naso-giorni' }, 'Il naso rosso è ancora nel cassetto'),
    );
  }

  // Totali della stagione
  $('#totali').replaceChildren(
    ...ORDINE_TIPI.filter((t) => calc.totali[t]).map((t) =>
      el(
        'span',
        { class: 'chip chip-' + TIPI[t].categoria },
        `${TIPI[t].emoji} ${TIPI[t].nome} ×${calc.totali[t]}`,
      ),
    ),
  );

  // Ultime perle
  $('#perle').replaceChildren(
    ...(calc.perle.length
      ? calc.perle.map((e) =>
          el(
            'li',
            { class: nuovi.has(e.id) ? 'lampo' : '' },
            el('span', { class: 'perla-emoji', 'aria-hidden': 'true' }, TIPI[e.tipo].emoji),
            el(
              'span',
              { class: 'perla-testo' },
              el('strong', {}, e.studente ? e.studente.nomeVisualizzato : '?'),
              ` ${TIPI[e.tipo].nome}`,
              e.nota && el('em', {}, ` "${e.nota}"`),
            ),
            el('span', { class: 'perla-quando' }, quandoFa(e.timestamp)),
          ),
        )
      : [el('li', { class: 'vuoto' }, 'Tutto tranquillo. Per ora.')]),
  );
}

/* ------------------------------------------------------------------ */
/* Aggiornamento ed effetti                                             */
/* ------------------------------------------------------------------ */

async function aggiorna() {
  try {
    base = await api.getState(classeId);
  } catch (e) {
    if (!base) $('#messaggio').textContent = 'Non riesco a caricare la classe: ' + e.message;
    return;
  }
  const attivi = eventiAttivi(base.eventi);
  const nuovi = new Set();
  if (visti) {
    for (const e of attivi) if (!visti.has(e.id)) nuovi.add(e.id);
  }
  visti = new Set(attivi.map((e) => e.id));

  if (stagioneVista !== null && !stagioni(base).includes(stagioneVista)) stagioneVista = null;
  disegna(nuovi);
  if (nuovi.size && (stagioneVista === null || stagioneVista === base.stagione))
    effetti(attivi, nuovi);
}

function effetti(attivi, nuovi) {
  const arrivati = attivi.filter((e) => nuovi.has(e.id));
  const pesante = arrivati
    .filter((e) => eBoia(base.config, e))
    .sort((a, b) => b.punti - a.punti)[0];
  if (pesante) {
    const s = base.studenti.find((x) => x.id === pesante.studenteId);
    boia({
      emoji: TIPI[pesante.tipo].emoji,
      sottotitolo: `${s ? s.nomeVisualizzato : '?'}: ${TIPI[pesante.tipo].nome}`,
    });
  }
  if (arrivati.some((e) => e.tipo === 'PAGLIACCIO')) {
    const p = $('.p-naso');
    p.classList.remove('scuoti');
    void p.offsetWidth;
    p.classList.add('scuoti');
  }
}

/* ------------------------------------------------------------------ */
/* Controlli                                                            */
/* ------------------------------------------------------------------ */

$('#sel-stagione').addEventListener('change', (e) => {
  const s = Number(e.target.value);
  stagioneVista = s === base.stagione ? null : s;
  disegna();
});

$('#btn-albo').addEventListener('click', () => {
  const lista = $('#albo-lista');
  const nomi = (l) =>
    l && l.length ? l.map((x) => `${x.nome} (${x.punti})`).join(', ') : 'nessuno';
  lista.replaceChildren(
    ...(base && base.albo.length
      ? base.albo
          .slice()
          .reverse()
          .map((v) =>
            el(
              'li',
              {},
              el('h3', {}, `Stagione ${v.stagione}`),
              el('p', {}, `🥓 Salame d'oro: `, el('strong', {}, nomi(v.salameOro))),
              el('p', {}, `🥔 Patatino d'oro: `, el('strong', {}, nomi(v.patatinoOro))),
              el(
                'p',
                { class: 'tenue' },
                'Chiusa il ' + new Date(v.chiusaIl).toLocaleDateString('it-IT'),
              ),
            ),
          )
      : [el('li', { class: 'tenue' }, 'Nessuna stagione chiusa. La gloria attende.')]),
  );
  $('#albo').showModal();
});

const btnAudio = $('#btn-audio');
function disegnaAudio() {
  const on = storage.audio();
  btnAudio.textContent = on ? '🔊' : '🔇';
  btnAudio.setAttribute('aria-pressed', String(on));
  btnAudio.setAttribute('aria-label', on ? 'Disattiva audio' : 'Attiva audio');
}
btnAudio.addEventListener('click', () => {
  storage.salvaAudio(!storage.audio());
  disegnaAudio();
});

$('#btn-schermo').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

document.addEventListener('pointerdown', sbloccaAudio, { once: true });

// In demo, se la vista Prof è aperta in un'altra scheda, la LIM si aggiorna subito
window.addEventListener('storage', (e) => {
  if (config.modo === 'demo' && e.key === 'pollaio.demo.db') aggiorna();
});

disegnaAudio();
aggiorna();
setInterval(() => document.visibilityState === 'visible' && aggiorna(), INTERVALLO);
setInterval(() => disegna(), 60000); // aggiorna "3 minuti fa" e i giorni del naso
