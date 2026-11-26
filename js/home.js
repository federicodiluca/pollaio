import { storage } from './storage.js';
import { creaApi, ErroreServer } from './api.js';
import { $, el, toast, scaricaJson, nomeBackup } from './ui.js';
import { registraSw } from './sw-registra.js';

registraSw();

function mostra(id) {
  for (const v of ['vista-setup', 'vista-classi'])
    $('#' + v).classList.toggle('nascosto', v !== id);
}

function badge(config) {
  const b = $('#badge-modo');
  b.classList.toggle('nascosto', !config);
  b.classList.toggle('demo', config?.modo === 'demo');
  b.textContent = config?.modo === 'demo' ? 'Modalità demo' : 'Collegato';
}

/* ---------- Setup ---------- */

$('#form-setup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#url').value.trim();
  const pin = $('#pin').value;
  const err = $('#errore-setup');
  err.textContent = '';
  if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(url)) {
    err.textContent = 'L’URL deve essere quello della web app Apps Script e finire con /exec.';
    return;
  }
  if (!pin) {
    err.textContent = 'Inserisci il PIN.';
    return;
  }
  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = 'Controllo...';
  try {
    const config = { modo: 'remoto', url, pin };
    await creaApi(config).listClassi();
    storage.salvaConfig(config);
    avvia();
  } catch (ex) {
    err.textContent =
      ex instanceof ErroreServer
        ? ex.message
        : 'Non riesco a raggiungere la web app. Controlla l’URL e la connessione.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Collega';
  }
});

$('#btn-demo').addEventListener('click', () => {
  storage.salvaConfig({ modo: 'demo' });
  avvia();
});

/* ---------- Classi ---------- */

async function caricaClassi(api) {
  const stato = $('#stato-classi');
  const lista = $('#lista-classi');
  stato.textContent = 'Carico le classi...';
  try {
    const classi = await api.listClassi();
    lista.replaceChildren(
      ...classi.map((c) =>
        el(
          'li',
          { class: 'carta classe' },
          el('h2', {}, c.nome || c.id),
          el(
            'div',
            { class: 'riga-btn' },
            el(
              'a',
              { class: 'btn primario', href: `prof.html?classe=${encodeURIComponent(c.id)}` },
              '📱 Prof',
            ),
            el(
              'a',
              { class: 'btn', href: `lim.html?classe=${encodeURIComponent(c.id)}` },
              '📺 LIM',
            ),
          ),
        ),
      ),
    );
    stato.textContent = classi.length
      ? ''
      : 'Nessuna classe: aggiungine una qui sotto o direttamente nel foglio.';
  } catch (ex) {
    stato.textContent = 'Errore: ' + ex.message;
  }
}

$('#form-classe').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#classe-id').value.trim();
  if (!id) return;
  try {
    await creaApi().scrivi('addClass', { classe: { id, nome: $('#classe-nome').value.trim() } });
    e.target.reset();
    toast(`Classe ${id} aggiunta. Che il pollaio abbia inizio! 🐔`);
    caricaClassi(creaApi());
  } catch (ex) {
    toast(ex.message, { tipo: 'errore' });
  }
});

$('#btn-backup').addEventListener('click', async () => {
  try {
    scaricaJson(await creaApi().exportAll(), nomeBackup());
  } catch (ex) {
    toast('Backup non riuscito: ' + ex.message, { tipo: 'errore' });
  }
});

$('#btn-ripristina-demo').addEventListener('click', () => {
  if (!confirm('Ripristinare i dati demo? Le modifiche fatte in demo si perdono.')) return;
  storage.ripristinaDemo();
  caricaClassi(creaApi());
  toast('Dati demo ripristinati.');
});

$('#btn-esci').addEventListener('click', () => {
  const coda = storage.coda().length;
  const msg = coda
    ? `Ci sono ${coda} operazioni non ancora inviate: andranno perse. Continuare?`
    : 'Scollegare questo dispositivo? URL e PIN verranno dimenticati.';
  if (!confirm(msg)) return;
  storage.esci();
  avvia();
});

/* ---------- Avvio ---------- */

function avvia() {
  const config = storage.config();
  badge(config);
  if (!config) {
    mostra('vista-setup');
    return;
  }
  $('#btn-ripristina-demo').classList.toggle('nascosto', config.modo !== 'demo');
  mostra('vista-classi');
  caricaClassi(creaApi(config));
}

avvia();
