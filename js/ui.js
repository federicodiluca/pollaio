/** Piccoli aiutanti per il DOM. Il testo passa sempre da textContent: niente innerHTML con dati. */

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...figli) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const f of figli.flat()) {
    if (f === null || f === undefined || f === false) continue;
    n.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return n;
}

const SVG = 'http://www.w3.org/2000/svg';
const SPRITE = new URL('../assets/icone.svg', import.meta.url).pathname;

/** Icona dallo sprite SVG. Senza `etichetta` è decorativa (nascosta agli screen reader). */
export function icona(id, { classe = 'icona', etichetta } = {}) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', classe);
  if (etichetta) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', etichetta);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `${SPRITE}#${id}`);
  svg.append(use);
  return svg;
}

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */

let contenitore;

/** Messaggio in basso; con `azione` compare un pulsante (es. "Annulla"). */
export function toast(messaggio, { azione, onAzione, durata = 4000, tipo = '' } = {}) {
  if (!contenitore) {
    contenitore = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(contenitore);
  }
  const t = el('div', { class: 'toast ' + tipo }, el('span', {}, messaggio));
  let chiuso = false;
  const chiudi = () => {
    if (chiuso) return;
    chiuso = true;
    t.classList.add('via');
    setTimeout(() => t.remove(), 250);
  };
  if (azione) {
    t.append(
      el(
        'button',
        {
          type: 'button',
          class: 'toast-azione',
          onclick: () => {
            chiudi();
            onAzione && onAzione();
          },
        },
        azione,
      ),
      el('span', { class: 'toast-barra', style: `animation-duration:${durata}ms` }),
    );
  }
  contenitore.append(t);
  setTimeout(chiudi, durata);
}

/* ------------------------------------------------------------------ */
/* Varie                                                                */
/* ------------------------------------------------------------------ */

export function scaricaJson(dati, prefisso = 'pollaio-backup') {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const nome = `${prefisso}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export const parametro = (nome) => new URLSearchParams(location.search).get(nome);

export const riduciMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
