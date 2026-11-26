/**
 * "Boia dei matti!": animazione e suono per gli eventi pesanti.
 *
 * Il suono viene da assets/boia-dei-matti.mp3 se c'è (sostituiscilo con la tua voce!),
 * altrimenti parte un "wah wah wah" sintetizzato con Web Audio.
 */
import { el, icona, riduciMovimento } from './ui.js';
import { storage } from './storage.js';

const FILE_AUDIO = new URL('../assets/boia-dei-matti.mp3', import.meta.url).href;

let ctx = null;
let fileDisponibile = null; // null = non ancora verificato

/** I browser bloccano l'audio finché l'utente non tocca la pagina: chiamala in un click. */
export function sbloccaAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

async function suonaFile() {
  if (fileDisponibile === null) {
    try {
      const r = await fetch(FILE_AUDIO, { method: 'HEAD' });
      fileDisponibile = r.ok;
    } catch {
      fileDisponibile = false;
    }
  }
  if (!fileDisponibile) return false;
  try {
    await new Audio(FILE_AUDIO).play();
    return true;
  } catch {
    return false;
  }
}

/** Trombone triste: tre note che scendono e l'ultima che trema. */
function suonaSintetizzato() {
  sbloccaAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 1400;
  const volume = ctx.createGain();
  volume.gain.value = 0.18;
  filtro.connect(volume).connect(ctx.destination);

  const note = [
    [392, 0.0, 0.32],
    [370, 0.36, 0.32],
    [349, 0.72, 0.32],
    [330, 1.08, 0.9],
  ];
  note.forEach(([f, inizio, durata], i) => {
    const osc = ctx.createOscillator();
    const inv = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, t0 + inizio);
    if (i === note.length - 1) {
      const lfo = ctx.createOscillator();
      const prof = ctx.createGain();
      lfo.frequency.value = 6;
      prof.gain.value = 9;
      lfo.connect(prof).connect(osc.frequency);
      lfo.start(t0 + inizio);
      lfo.stop(t0 + inizio + durata);
      osc.frequency.linearRampToValueAtTime(f * 0.92, t0 + inizio + durata);
    }
    inv.gain.setValueAtTime(0, t0 + inizio);
    inv.gain.linearRampToValueAtTime(1, t0 + inizio + 0.04);
    inv.gain.setValueAtTime(1, t0 + inizio + durata - 0.08);
    inv.gain.linearRampToValueAtTime(0, t0 + inizio + durata);
    osc.connect(inv).connect(filtro);
    osc.start(t0 + inizio);
    osc.stop(t0 + inizio + durata + 0.02);
  });
}

export async function suono() {
  if (!storage.audio()) return;
  if (!(await suonaFile())) suonaSintetizzato();
}

/**
 * Mostra l'animazione a tutto schermo, con una pioggia dell'icona indicata.
 * @param {{icona?: string, titolo?: string, sottotitolo?: string}} opzioni
 */
export function boia({ icona: id = 'salame', titolo = 'Boia dei matti!', sottotitolo = '' } = {}) {
  suono();
  const pioggia = riduciMovimento()
    ? []
    : Array.from({ length: 22 }, () => {
        const g = el('span', {
          class: 'boia-goccia',
          style: `left:${Math.random() * 95}%;animation-delay:${Math.random() * 0.8}s;width:${3 + Math.random() * 4}rem`,
        });
        g.append(icona(id, { classe: 'icona-piena' }));
        return g;
      });
  const ov = el(
    'div',
    { class: 'boia', role: 'alert' },
    ...pioggia,
    el(
      'div',
      { class: 'boia-testo' },
      el('strong', {}, titolo),
      sottotitolo && el('span', {}, sottotitolo),
    ),
  );
  const chiudi = () => ov.remove();
  ov.addEventListener('click', chiudi);
  document.body.append(ov);
  setTimeout(chiudi, 2800);
}
