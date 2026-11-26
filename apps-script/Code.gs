/**
 * Il Pollaio: backend Google Apps Script.
 *
 * Da incollare nell'editor Apps Script del foglio (Estensioni > Apps Script).
 * Istruzioni complete in apps-script/README.md.
 *
 * Letture: GET  ?action=...&pin=...&classeId=...
 * Scritture: POST con corpo JSON (Content-Type text/plain) { action, pin, ... }
 * Risposta: { ok: true, data } oppure { ok: false, errore }
 */

const VERSIONE = 1;

const FOGLI = {
  Classi: ['id', 'nome'],
  Studenti: ['id', 'classeId', 'nomeVisualizzato', 'attivo'],
  Eventi: ['id', 'timestamp', 'classeId', 'studenteId', 'tipo', 'punti', 'nota', 'stagione'],
  Config: ['chiave', 'valore'],
};

/** Tipi validi e categoria. "neg" finisce nella classifica tacchini, "pos" in quella patatini. */
const TIPI = {
  POLLO: 'neg',
  TACCHINO: 'neg',
  SALAME: 'neg',
  PAGLIACCIO: 'neg',
  SPIEGO_PEGGIO: 'neg',
  PORCO_ME: 'neg',
  PATATINO: 'pos',
};

const CONFIG_DEFAULT = {
  'punti.POLLO': 1,
  'punti.TACCHINO': 2,
  'punti.SALAME': 3,
  'punti.PAGLIACCIO': 2,
  'punti.SPIEGO_PEGGIO': 1,
  'punti.PORCO_ME': 2,
  'punti.PATATINO': 1,
  'boia.soglia': 3,
};

const MAX_TENTATIVI_PIN = 20;
const FINESTRA_TENTATIVI_SEC = 15 * 60;

/* ------------------------------------------------------------------ */
/* Setup                                                                */
/* ------------------------------------------------------------------ */

/** Crea i tab mancanti con le intestazioni e i valori di Config di default. Si può rieseguire. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(FOGLI).forEach(function (nome) {
    let sh = ss.getSheetByName(nome);
    if (!sh) sh = ss.insertSheet(nome);
    const intestazioni = FOGLI[nome];
    if (sh.getLastRow() === 0) {
      sh.appendRow(intestazioni);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, intestazioni.length).setFontWeight('bold');
    }
    // Tutto come testo: evita che Sheets trasformi id e date in numeri
    sh.getRange(1, 1, sh.getMaxRows(), intestazioni.length).setNumberFormat('@');
  });
  const presenti = leggiConfig();
  Object.keys(CONFIG_DEFAULT).forEach(function (k) {
    if (!(k in presenti)) foglio('Config').appendRow([k, String(CONFIG_DEFAULT[k])]);
  });
  const pin = PropertiesService.getScriptProperties().getProperty('PIN');
  Logger.log(
    pin
      ? 'Setup completato. PIN già impostato.'
      : 'Setup completato. ATTENZIONE: imposta la proprietà di script PIN (Impostazioni progetto > Proprietà script).',
  );
}

/* ------------------------------------------------------------------ */
/* Ingresso HTTP                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return gestisci(function () {
    const p = (e && e.parameter) || {};
    controllaPin(p.pin);
    switch (p.action) {
      case 'listClassi':
        return listClassi();
      case 'getState':
        return getState(richiesto(p.classeId, 'classeId'));
      case 'exportAll':
        return exportAll();
      default:
        throw new Error('Azione di lettura sconosciuta: ' + p.action);
    }
  });
}

function doPost(e) {
  return gestisci(function () {
    let body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch {
      throw new Error('JSON non valido');
    }
    controllaPin(body.pin);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Foglio occupato, riprova tra poco');
    try {
      switch (body.action) {
        case 'addEvent':
          return addEvent(body.evento || {});
        case 'undoEvent':
          return undoEvent(richiesto(body.id, 'id'));
        case 'addStudent':
          return addStudent(body.studente || {});
        case 'editStudent':
          return editStudent(body.studente || {});
        case 'addClass':
          return addClass(body.classe || {});
        case 'newSeason':
          return newSeason(richiesto(body.classeId, 'classeId'));
        default:
          throw new Error('Azione di scrittura sconosciuta: ' + body.action);
      }
    } finally {
      lock.releaseLock();
    }
  });
}

function gestisci(fn) {
  let out;
  try {
    out = { ok: true, versione: VERSIONE, data: fn() };
  } catch (err) {
    out = { ok: false, versione: VERSIONE, errore: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* ------------------------------------------------------------------ */
/* Sicurezza                                                            */
/* ------------------------------------------------------------------ */

function controllaPin(pin) {
  const atteso = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!atteso) throw new Error('PIN non configurato sul server');
  const cache = CacheService.getScriptCache();
  const falliti = Number(cache.get('pinFalliti') || 0);
  if (falliti >= MAX_TENTATIVI_PIN) {
    throw new Error('Troppi tentativi con PIN errato: riprova tra 15 minuti');
  }
  if (String(pin || '') !== atteso) {
    cache.put('pinFalliti', String(falliti + 1), FINESTRA_TENTATIVI_SEC);
    throw new Error('PIN errato');
  }
}

/* ------------------------------------------------------------------ */
/* Letture                                                              */
/* ------------------------------------------------------------------ */

function listClassi() {
  return leggiRighe('Classi');
}

function getState(classeId) {
  const classe = leggiRighe('Classi').find(function (c) {
    return c.id === classeId;
  });
  if (!classe) throw new Error('Classe non trovata: ' + classeId);
  const config = leggiConfig();
  return {
    classe: classe,
    studenti: leggiRighe('Studenti')
      .filter(function (s) {
        return s.classeId === classeId;
      })
      .map(normalizzaStudente),
    eventi: leggiRighe('Eventi')
      .filter(function (ev) {
        return ev.classeId === classeId;
      })
      .map(normalizzaEvento),
    config: configPubblica(config),
    stagione: stagioneCorrente(config, classeId),
    albo: leggiAlbo(config, classeId),
  };
}

function exportAll() {
  return {
    esportatoIl: new Date().toISOString(),
    versione: VERSIONE,
    classi: leggiRighe('Classi'),
    studenti: leggiRighe('Studenti').map(normalizzaStudente),
    eventi: leggiRighe('Eventi').map(normalizzaEvento),
    config: leggiConfig(),
  };
}

/* ------------------------------------------------------------------ */
/* Scritture                                                            */
/* ------------------------------------------------------------------ */

function addEvent(ev) {
  const id = String(ev.id || Utilities.getUuid());
  const esistente = trovaEvento(id);
  if (esistente) return { evento: esistente, duplicato: true };

  const tipo = String(ev.tipo || '');
  if (!TIPI[tipo]) throw new Error('Tipo di evento non valido: ' + tipo);
  const studente = trovaStudente(richiesto(ev.studenteId, 'studenteId'));
  if (!studente) throw new Error('Studente non trovato');
  if (studente.classeId !== ev.classeId) throw new Error('Lo studente non è di questa classe');

  const config = leggiConfig();
  const nuovo = {
    id: id,
    timestamp: timestampValido(ev.timestamp),
    classeId: studente.classeId,
    studenteId: studente.id,
    tipo: tipo,
    punti: Number(config['punti.' + tipo] || 0),
    nota: pulisci(ev.nota, 200),
    stagione: stagioneCorrente(config, studente.classeId),
  };
  aggiungiRiga('Eventi', nuovo);
  return { evento: nuovo };
}

/** Eventi in sola aggiunta: annullare significa aggiungere un evento ANNULLA che punta all'originale. */
function undoEvent(idOriginale) {
  const idAnnulla = 'undo-' + idOriginale;
  const gia = trovaEvento(idAnnulla);
  if (gia) return { evento: gia, duplicato: true };
  const orig = trovaEvento(idOriginale);
  if (!orig) throw new Error('Evento da annullare non trovato');
  if (orig.tipo === 'ANNULLA') throw new Error('Non si annulla un annullamento');
  const nuovo = {
    id: idAnnulla,
    timestamp: new Date().toISOString(),
    classeId: orig.classeId,
    studenteId: orig.studenteId,
    tipo: 'ANNULLA',
    punti: 0,
    nota: orig.id,
    stagione: orig.stagione,
  };
  aggiungiRiga('Eventi', nuovo);
  return { evento: nuovo };
}

function addClass(c) {
  const id = pulisci(richiesto(c.id, 'id'), 20);
  if (
    leggiRighe('Classi').some(function (x) {
      return x.id === id;
    })
  ) {
    throw new Error('Classe già esistente: ' + id);
  }
  const nuova = { id: id, nome: pulisci(c.nome || id, 60) };
  aggiungiRiga('Classi', nuova);
  return { classe: nuova };
}

function addStudent(s) {
  const classeId = richiesto(s.classeId, 'classeId');
  if (
    !leggiRighe('Classi').some(function (c) {
      return c.id === classeId;
    })
  ) {
    throw new Error('Classe non trovata: ' + classeId);
  }
  const id = String(s.id || Utilities.getUuid());
  const gia = trovaStudente(id);
  if (gia) return { studente: gia, duplicato: true };
  const nuovo = {
    id: id,
    classeId: classeId,
    nomeVisualizzato: pulisci(richiesto(s.nomeVisualizzato, 'nomeVisualizzato'), 40),
    attivo: true,
  };
  aggiungiRiga('Studenti', nuovo);
  return { studente: nuovo };
}

function editStudent(s) {
  const sh = foglio('Studenti');
  const riga = trovaRiga(sh, richiesto(s.id, 'id'));
  if (!riga) throw new Error('Studente non trovato');
  if (s.nomeVisualizzato !== undefined) {
    sh.getRange(riga, 3).setValue(sicuroPerFoglio(pulisci(s.nomeVisualizzato, 40)));
  }
  if (s.attivo !== undefined) sh.getRange(riga, 4).setValue(s.attivo ? 'TRUE' : 'FALSE');
  return { studente: trovaStudente(s.id) };
}

/** Chiude la stagione corrente: proclama Salame d'oro e Patatino d'oro e passa alla successiva. */
function newSeason(classeId) {
  const config = leggiConfig();
  const stagione = stagioneCorrente(config, classeId);
  const studenti = leggiRighe('Studenti').map(normalizzaStudente);
  const nomi = {};
  studenti.forEach(function (s) {
    nomi[s.id] = s.nomeVisualizzato;
  });

  const eventi = leggiRighe('Eventi')
    .map(normalizzaEvento)
    .filter(function (ev) {
      return ev.classeId === classeId && ev.stagione === stagione;
    });
  const annullati = {};
  eventi.forEach(function (ev) {
    if (ev.tipo === 'ANNULLA') annullati[ev.nota] = true;
  });
  const neg = {};
  const pos = {};
  eventi.forEach(function (ev) {
    if (annullati[ev.id] || !TIPI[ev.tipo]) return;
    const bucket = TIPI[ev.tipo] === 'pos' ? pos : neg;
    bucket[ev.studenteId] = (bucket[ev.studenteId] || 0) + ev.punti;
  });

  const voce = {
    stagione: stagione,
    chiusaIl: new Date().toISOString(),
    salameOro: vincitori(neg, nomi),
    patatinoOro: vincitori(pos, nomi),
  };
  const albo = leggiAlbo(config, classeId);
  albo.push(voce);
  scriviConfig('albo.' + classeId, JSON.stringify(albo));
  scriviConfig('stagione.' + classeId, String(stagione + 1));
  return { chiusa: voce, nuovaStagione: stagione + 1 };
}

function vincitori(punteggi, nomi) {
  let max = 0;
  Object.keys(punteggi).forEach(function (id) {
    if (punteggi[id] > max) max = punteggi[id];
  });
  if (max <= 0) return [];
  return Object.keys(punteggi)
    .filter(function (id) {
      return punteggi[id] === max;
    })
    .map(function (id) {
      return { studenteId: id, nome: nomi[id] || '?', punti: max };
    });
}

/* ------------------------------------------------------------------ */
/* Utilità foglio                                                      */
/* ------------------------------------------------------------------ */

function foglio(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('Manca il tab "' + nome + '": esegui setup()');
  return sh;
}

function leggiRighe(nome) {
  const sh = foglio(nome);
  const valori = sh.getDataRange().getValues();
  const intest = valori.shift() || [];
  return valori
    .filter(function (r) {
      return r[0] !== '';
    })
    .map(function (r) {
      const o = {};
      intest.forEach(function (h, i) {
        o[h] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]);
      });
      return o;
    });
}

function aggiungiRiga(nome, obj) {
  const sh = foglio(nome);
  sh.appendRow(
    FOGLI[nome].map(function (h) {
      return sicuroPerFoglio(obj[h] === undefined ? '' : String(obj[h]));
    }),
  );
}

function trovaRiga(sh, id) {
  const cella = sh
    .getRange(1, 1, sh.getLastRow(), 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
  return cella && cella.getRow() > 1 ? cella.getRow() : null;
}

function leggiRigaObj(nome, riga) {
  const intest = FOGLI[nome];
  const valori = foglio(nome).getRange(riga, 1, 1, intest.length).getValues()[0];
  const o = {};
  intest.forEach(function (h, i) {
    o[h] = valori[i] instanceof Date ? valori[i].toISOString() : String(valori[i]);
  });
  return o;
}

function trovaEvento(id) {
  const riga = trovaRiga(foglio('Eventi'), id);
  return riga ? normalizzaEvento(leggiRigaObj('Eventi', riga)) : null;
}

function trovaStudente(id) {
  const riga = trovaRiga(foglio('Studenti'), id);
  return riga ? normalizzaStudente(leggiRigaObj('Studenti', riga)) : null;
}

function normalizzaStudente(s) {
  return {
    id: s.id,
    classeId: s.classeId,
    nomeVisualizzato: s.nomeVisualizzato,
    attivo: String(s.attivo).toUpperCase() !== 'FALSE',
  };
}

function normalizzaEvento(ev) {
  return {
    id: ev.id,
    timestamp: ev.timestamp,
    classeId: ev.classeId,
    studenteId: ev.studenteId,
    tipo: ev.tipo,
    punti: Number(ev.punti) || 0,
    nota: ev.nota,
    stagione: Number(ev.stagione) || 1,
  };
}

function leggiConfig() {
  const o = {};
  leggiRighe('Config').forEach(function (r) {
    o[r.chiave] = r.valore;
  });
  return o;
}

function scriviConfig(chiave, valore) {
  const sh = foglio('Config');
  const riga = trovaRiga(sh, chiave);
  if (riga) sh.getRange(riga, 2).setValue(valore);
  else sh.appendRow([chiave, valore]);
}

/** Solo le chiavi utili al client (punti e soglie), non l'albo grezzo. */
function configPubblica(config) {
  const o = {};
  Object.keys(config).forEach(function (k) {
    if (k.indexOf('punti.') === 0 || k.indexOf('boia.') === 0) o[k] = Number(config[k]);
  });
  return o;
}

function stagioneCorrente(config, classeId) {
  return Number(config['stagione.' + classeId]) || 1;
}

function leggiAlbo(config, classeId) {
  try {
    return JSON.parse(config['albo.' + classeId] || '[]');
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Validazione                                                          */
/* ------------------------------------------------------------------ */

function richiesto(v, nome) {
  if (v === undefined || v === null || String(v).trim() === '') {
    throw new Error('Parametro mancante: ' + nome);
  }
  return String(v).trim();
}

function pulisci(v, max) {
  return (
    String(v === undefined || v === null ? '' : v)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f]/g, ' ')
      .trim()
      .slice(0, max)
  );
}

/** Evita che un testo venga interpretato come formula dal foglio. */
function sicuroPerFoglio(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** Accetta il timestamp del client (utile per la coda offline) solo se plausibile. */
function timestampValido(ts) {
  const ora = Date.now();
  const t = Date.parse(ts);
  if (!isNaN(t) && t <= ora + 5 * 60 * 1000 && t >= ora - 30 * 24 * 3600 * 1000) {
    return new Date(t).toISOString();
  }
  return new Date(ora).toISOString();
}
