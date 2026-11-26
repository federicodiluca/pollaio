import { storage } from './storage.js';
import { creaApi, nuovoId } from './api.js';
import { creaCoda } from './queue.js';
import { calcola } from './scoring.js';
import { TIPI, ORDINE_TIPI, puntiPer, eBoia } from './tipi.js';
import { $, el, toast, quandoFa, giorniTesto, parametro, scaricaJson, nomeBackup } from './ui.js';
import { boia, sbloccaAudio } from './boia.js';
import { registraSw } from './sw-registra.js';

registraSw();

const config = storage.config();
const classeId = parametro('classe');
if (!config || !classeId) location.replace('./');

const api = creaApi(config);
let base = storage.stato(classeId);
let studenteScelto = null;

const coda = creaCoda(api, {
  onCambio: () => {
    badgeSync();
    disegna();
  },
  onInviata: (voce, out) => {
    // L'evento confermato entra nello stato base, così non sparisce quando lascia la coda
    if (base && out && out.evento && !base.eventi.some((e) => e.id === out.evento.id)) {
      base.eventi.push(out.evento);
      salvaCache();
    }
  },
  onErrore: (e) => toast('Operazione rifiutata dal server: ' + e.message, { tipo: 'errore' }),
});

function salvaCache() {
  if (config.modo === 'remoto' && base) storage.salvaStato(classeId, base);
}

/** Stato del server + le operazioni ancora in coda, così l'interfaccia risponde subito. */
function statoVisibile() {
  if (!base) return null;
  const eventi = base.eventi.slice();
  const ids = new Set(eventi.map((e) => e.id));
  for (const v of coda.voci) {
    if (v.action === 'addEvent' && v.payload.evento.classeId === classeId) {
      const ev = v.payload.evento;
      if (ids.has(ev.id)) continue;
      eventi.push({
        ...ev,
        punti: puntiPer(base.config, ev.tipo),
        stagione: base.stagione,
        inCoda: true,
      });
    } else if (v.action === 'undoEvent') {
      const id = 'undo-' + v.payload.id;
      if (ids.has(id)) continue;
      eventi.push({
        id,
        tipo: 'ANNULLA',
        nota: v.payload.id,
        timestamp: v.creata,
        classeId,
        studenteId: '',
        punti: 0,
        stagione: base.stagione,
      });
    }
  }
  return { ...base, eventi };
}

/* ------------------------------------------------------------------ */
/* Disegno                                                              */
/* ------------------------------------------------------------------ */

function badgeSync() {
  const b = $('#badge-sync');
  const n = coda.voci.length;
  b.classList.toggle('nascosto', n === 0 && !coda.offline);
  b.classList.toggle('offline', coda.offline);
  b.textContent = coda.offline ? `📴 Offline${n ? `: ${n} in coda` : ''}` : `⏳ Invio ${n}...`;
}

function riassunto(r) {
  if (!r) return '';
  const parti = [];
  if (r.neg) parti.push(`🦃 ${r.neg}`);
  if (r.pos) parti.push(`🥔 ${r.pos}`);
  return parti.join(' · ') || 'pulito';
}

function disegna() {
  const st = statoVisibile();
  if (!st) return;
  const calc = calcola(st);

  $('#nome-classe').textContent = st.classe.nome || st.classe.id;
  $('#stagione').textContent = `stagione ${st.stagione}`;
  document.title = `${st.classe.nome || st.classe.id}: Vista Prof`;

  const naso = $('#naso');
  naso.classList.toggle('nascosto', !calc.naso);
  if (calc.naso) {
    naso.textContent = `🤡 Il naso rosso ce l'ha ${calc.naso.studente.nomeVisualizzato}, ${giorniTesto(calc.naso.giorni)}`;
  }

  const attivi = st.studenti
    .filter((s) => s.attivo)
    .sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato, 'it'));
  $('#messaggio').textContent = attivi.length
    ? ''
    : 'Nessuno studente in questa classe: aggiungili da "Gestione classe" qui sotto.';

  $('#griglia').replaceChildren(
    ...attivi.map((s) => {
      const r = calc.perStudente[s.id];
      const haNaso = calc.naso && calc.naso.studente.id === s.id;
      return el(
        'li',
        {},
        el(
          'button',
          {
            type: 'button',
            class: 'studente' + (haNaso ? ' ha-naso' : ''),
            onclick: () => apriScelta(s),
          },
          el('span', { class: 'studente-nome' }, (haNaso ? '🤡 ' : '') + s.nomeVisualizzato),
          el('span', { class: 'studente-punti' }, riassunto(r)),
        ),
      );
    }),
  );

  const ultimi = calcola(st, { perle: 12 }).perle;
  $('#ultimi').replaceChildren(
    ...(ultimi.length
      ? ultimi.map((e) =>
          el(
            'li',
            { class: e.inCoda ? 'in-coda' : '' },
            el('span', { class: 'ultimi-emoji', 'aria-hidden': 'true' }, TIPI[e.tipo].emoji),
            el(
              'span',
              { class: 'ultimi-testo' },
              el('strong', {}, e.studente ? e.studente.nomeVisualizzato : '?'),
              ` ${TIPI[e.tipo].nome}`,
              e.nota && el('span', { class: 'tenue' }, ` "${e.nota}"`),
              el(
                'span',
                { class: 'tenue piccolo ultimi-quando' },
                e.inCoda ? 'in coda' : quandoFa(e.timestamp),
              ),
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'btn piccolo',
                'aria-label': `Annulla ${TIPI[e.tipo].nome} a ${e.studente?.nomeVisualizzato}`,
                onclick: () => annulla(e.id),
              },
              '↩︎',
            ),
          ),
        )
      : [el('li', { class: 'tenue' }, 'Ancora niente in questa stagione. Pace nel pollaio.')]),
  );

  $('#lista-studenti').replaceChildren(
    ...st.studenti
      .slice()
      .sort((a, b) => a.nomeVisualizzato.localeCompare(b.nomeVisualizzato, 'it'))
      .map((s) =>
        el(
          'li',
          { class: s.attivo ? '' : 'inattivo' },
          el('span', {}, s.nomeVisualizzato),
          el(
            'button',
            { type: 'button', class: 'btn piccolo', onclick: () => rinomina(s) },
            'Rinomina',
          ),
          el(
            'button',
            { type: 'button', class: 'btn piccolo', onclick: () => attiva(s, !s.attivo) },
            s.attivo ? 'Disattiva' : 'Riattiva',
          ),
        ),
      ),
  );
}

/* ------------------------------------------------------------------ */
/* Assegnazione                                                         */
/* ------------------------------------------------------------------ */

const dialogo = $('#scelta');

$('#scelta-tipi').replaceChildren(
  ...ORDINE_TIPI.map((tipo) =>
    el(
      'button',
      {
        type: 'button',
        class: 'tipo tipo-' + TIPI[tipo].categoria,
        dataset: { tipo },
        onclick: () => {
          const s = studenteScelto;
          const nota = $('#scelta-nota').value.trim();
          dialogo.close();
          if (s) assegna(s, tipo, nota);
        },
      },
      el('span', { class: 'tipo-emoji', 'aria-hidden': 'true' }, TIPI[tipo].emoji),
      el('span', { class: 'tipo-nome' }, TIPI[tipo].nome),
      el('span', { class: 'tipo-punti' }, ''),
    ),
  ),
);

function apriScelta(s) {
  studenteScelto = s;
  $('#scelta-titolo').textContent = s.nomeVisualizzato;
  $('#scelta-nota').value = '';
  for (const b of dialogo.querySelectorAll('.tipo')) {
    const t = b.dataset.tipo;
    const p = puntiPer(base.config, t);
    b.querySelector('.tipo-punti').textContent = TIPI[t].categoria === 'pos' ? `+${p} 🥔` : `+${p}`;
  }
  dialogo.showModal();
}

function assegna(s, tipo, nota) {
  const evento = {
    id: nuovoId(),
    classeId,
    studenteId: s.id,
    tipo,
    nota,
    timestamp: new Date().toISOString(),
  };
  coda.aggiungi('addEvent', { evento });
  const t = TIPI[tipo];
  const punti = puntiPer(base.config, tipo);
  if (eBoia(base.config, { tipo, punti })) {
    boia({ emoji: t.emoji, sottotitolo: `${s.nomeVisualizzato}: ${t.nome}` });
  }
  const msg =
    tipo === 'PAGLIACCIO'
      ? `🤡 Il naso rosso passa a ${s.nomeVisualizzato}: consegnalo!`
      : `${t.emoji} ${s.nomeVisualizzato}: ${t.nome} (+${punti})`;
  toast(msg, { azione: 'Annulla', durata: 6000, onAzione: () => annulla(evento.id) });
}

function annulla(id) {
  const ritirato = coda.ritira((v) => v.action === 'addEvent' && v.payload.evento.id === id);
  if (!ritirato) coda.aggiungi('undoEvent', { id });
  disegna();
  toast('Annullato. Nessun pollo è stato maltrattato.');
}

/* ------------------------------------------------------------------ */
/* Gestione                                                             */
/* ------------------------------------------------------------------ */

async function scritturaDiretta(action, payload, ok) {
  try {
    const out = await api.scrivi(action, payload);
    if (ok) toast(ok);
    await aggiorna();
    return out;
  } catch (e) {
    toast(e.message, { tipo: 'errore' });
    return null;
  }
}

$('#form-studente').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = $('#nuovo-nome').value.trim();
  if (!nome) return;
  scritturaDiretta(
    'addStudent',
    { studente: { id: nuovoId(), classeId, nomeVisualizzato: nome } },
    `Benvenuto nel pollaio, ${nome}! 🐣`,
  ).then((out) => out && e.target.reset());
});

function rinomina(s) {
  const nome = prompt('Nuovo nome visualizzato:', s.nomeVisualizzato);
  if (nome && nome.trim() && nome.trim() !== s.nomeVisualizzato) {
    scritturaDiretta('editStudent', { studente: { id: s.id, nomeVisualizzato: nome.trim() } });
  }
}

function attiva(s, attivo) {
  scritturaDiretta('editStudent', { studente: { id: s.id, attivo } });
}

$('#btn-stagione').addEventListener('click', async () => {
  if (coda.voci.length) {
    toast('Prima aspetta che la coda sia vuota (serve la rete).', { tipo: 'errore' });
    return;
  }
  if (!confirm('Chiudere la stagione e proclamare i vincitori? Non si può annullare.')) return;
  const out = await scritturaDiretta('newSeason', { classeId });
  if (out) {
    const nomi = (l) => l.map((x) => x.nome).join(', ') || 'nessuno';
    boia({
      emoji: '🏆',
      sottotitolo: `Salame d'oro: ${nomi(out.chiusa.salameOro)} · Patatino d'oro: ${nomi(out.chiusa.patatinoOro)}`,
    });
  }
});

$('#btn-backup').addEventListener('click', async () => {
  try {
    scaricaJson(await api.exportAll(), nomeBackup());
  } catch (e) {
    toast('Backup non riuscito: ' + e.message, { tipo: 'errore' });
  }
});

/* ------------------------------------------------------------------ */
/* Audio e avvio                                                        */
/* ------------------------------------------------------------------ */

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
document.addEventListener('pointerdown', sbloccaAudio, { once: true });

async function aggiorna() {
  try {
    base = await api.getState(classeId);
    salvaCache();
    disegna();
  } catch (e) {
    if (!base) $('#messaggio').textContent = 'Non riesco a caricare la classe: ' + e.message;
    else badgeSync();
  }
}

$('#link-lim').href = `lim.html?classe=${encodeURIComponent(classeId)}`;
$('#link-lim').setAttribute('aria-label', 'Apri la vista LIM');
disegnaAudio();
badgeSync();
disegna();
aggiorna();
coda.svuota();
setInterval(() => document.visibilityState === 'visible' && aggiorna(), 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    aggiorna();
    coda.svuota();
  }
});
