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

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */

let contenitore;

/**
 * Mostra un messaggio in basso. Con `azione` compare un pulsante (es. "Annulla").
 * @returns {() => void} funzione per chiudere il toast
 */
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
    const b = el('button', { type: 'button', class: 'toast-azione' }, azione);
    b.addEventListener('click', () => {
      chiudi();
      onAzione && onAzione();
    });
    const barra = el('span', { class: 'toast-barra', style: `animation-duration:${durata}ms` });
    t.append(b, barra);
  }
  contenitore.append(t);
  setTimeout(chiudi, durata);
  return chiudi;
}

/* ------------------------------------------------------------------ */
/* Varie                                                                */
/* ------------------------------------------------------------------ */

const RTF = new Intl.RelativeTimeFormat('it', { numeric: 'auto' });

export function quandoFa(iso, ora = Date.now()) {
  const sec = Math.round((Date.parse(iso) - ora) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return 'adesso';
  if (abs < 3600) return RTF.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return RTF.format(Math.round(sec / 3600), 'hour');
  return RTF.format(Math.round(sec / 86400), 'day');
}

export function giorniTesto(n) {
  if (n === 0) return 'da oggi';
  if (n === 1) return 'da 1 giorno';
  return `da ${n} giorni`;
}

export function scaricaJson(dati, nomeFile) {
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: nomeFile });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export function nomeBackup() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `pollaio-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export function parametro(nome) {
  return new URLSearchParams(location.search).get(nome);
}

export const riduciMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
