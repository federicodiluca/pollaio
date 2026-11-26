/**
 * "Boia dei matti!" a tutto schermo, solo a comando: pulsantino o tasto B.
 * Si chiude toccando lo schermo, con Esc o premendo di nuovo B. Niente audio.
 */
import { el, icona, riduciMovimento } from './ui.js';

const ICONE = ['pollo', 'tacchino', 'salame', 'pagliaccio'];
let schermo = null;

export function chiudiBoia() {
  if (!schermo) return;
  schermo.remove();
  schermo = null;
}

export function boia() {
  if (schermo) return chiudiBoia();
  // I dialoghi aperti stanno sopra a tutto: si chiudono per lasciare la scena
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const pioggia = riduciMovimento()
    ? []
    : Array.from({ length: 28 }, (_, i) => {
        const g = el('span', {
          class: 'boia-goccia',
          style: [
            `left:${Math.random() * 95}%`,
            `animation-delay:${(Math.random() * 3).toFixed(2)}s`,
            `animation-duration:${(2.5 + Math.random() * 2).toFixed(2)}s`,
            `width:${(3 + Math.random() * 4).toFixed(1)}rem`,
          ].join(';'),
        });
        g.append(icona(ICONE[i % ICONE.length], { classe: 'icona-piena' }));
        return g;
      });
  schermo = el(
    'div',
    { class: 'boia', role: 'alert' },
    ...pioggia,
    el('div', { class: 'boia-testo' }, el('strong', {}, 'Boia dei matti!')),
  );
  schermo.addEventListener('click', chiudiBoia);
  document.body.append(schermo);
}

/** Tasto B (fuori dai campi di testo) per aprire e chiudere, Esc per chiudere. */
export function attivaScorciatoia() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return chiudiBoia();
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      boia();
    }
  });
}
