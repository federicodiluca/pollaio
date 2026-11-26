import { storage } from './storage.js';
import { ErroreRete } from './api.js';

/**
 * Coda locale delle scritture: se manca la rete le operazioni restano qui
 * (anche se si chiude la pagina) e partono appena possibile, in ordine.
 */
export function creaCoda(
  api,
  { onCambio = () => {}, onErrore = () => {}, onInviata = () => {} } = {},
) {
  let voci = storage.coda();
  let inVolo = null;
  let timer = null;
  let offline = false;

  const salva = () => {
    storage.salvaCoda(voci);
    onCambio({ voci, offline });
  };

  async function svuota() {
    if (inVolo) return;
    clearTimeout(timer);
    while (voci.length) {
      inVolo = voci[0];
      try {
        const out = await api.scrivi(inVolo.action, inVolo.payload);
        offline = false;
        onInviata(inVolo, out);
      } catch (e) {
        if (e instanceof ErroreRete) {
          inVolo = null;
          offline = true;
          timer = setTimeout(svuota, 10000);
          onCambio({ voci, offline });
          return;
        }
        onErrore(e, inVolo);
      }
      const inviata = inVolo;
      voci = voci.filter((v) => v !== inviata);
      inVolo = null;
      salva();
    }
  }

  window.addEventListener('online', svuota);

  return {
    get voci() {
      return voci;
    },
    get offline() {
      return offline;
    },
    aggiungi(action, payload) {
      voci.push({ action, payload, creata: new Date().toISOString() });
      salva();
      svuota();
    },
    /** Toglie un'operazione non ancora partita. Restituisce false se è già in viaggio o inviata. */
    ritira(pred) {
      const i = voci.findIndex((v) => v !== inVolo && pred(v));
      if (i < 0) return false;
      voci.splice(i, 1);
      salva();
      return true;
    },
    svuota,
  };
}
