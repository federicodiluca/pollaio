/**
 * Il Pollaio: backend Google Apps Script (versione leggera).
 *
 * Da incollare nell'editor Apps Script del foglio (Estensioni > Apps Script).
 * Istruzioni complete in apps-script/README.md.
 *
 * Letture: GET  ?action=...&pin=...&classeId=...
 * Scritture: POST con corpo JSON (Content-Type text/plain) { action, pin, ... }
 * Risposta: { ok: true, data } oppure { ok: false, errore }
 */

const FOGLI = {
  Classi: ['id', 'nome'],
  Studenti: [
    'id',
    'classeId',
    'nome',
    'titolo',
    'attivo',
    'pollo',
    'tacchino',
    'salame',
    'pagliaccio',
  ],
};

const CATEGORIE = ['pollo', 'tacchino', 'salame', 'pagliaccio'];

const MAX_TENTATIVI_PIN = 20;
const FINESTRA_TENTATIVI_SEC = 15 * 60;

/* ------------------------------------------------------------------ */
/* Setup                                                                */
/* ------------------------------------------------------------------ */

/** Crea i tab mancanti con le intestazioni. Si può rieseguire senza danni. */
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
        return leggiRighe('Classi');
      case 'getClasse':
        return getClasse(richiesto(p.classeId, 'classeId'));
      case 'exportAll':
        return {
          esportatoIl: new Date().toISOString(),
          classi: leggiRighe('Classi'),
          studenti: leggiRighe('Studenti').map(normalizza),
        };
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
        case 'conta':
          return conta(richiesto(body.studenteId, 'studenteId'), body.categoria, body.delta);
        case 'addClass':
          return addClass(body.classe || {});
        case 'addStudent':
          return addStudent(body.studente || {});
        case 'editStudent':
          return editStudent(body.studente || {});
        case 'azzera':
          return azzera(richiesto(body.classeId, 'classeId'));
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
    out = { ok: true, data: fn() };
  } catch (err) {
    out = { ok: false, errore: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

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
/* Azioni                                                               */
/* ------------------------------------------------------------------ */

function getClasse(classeId) {
  const classe = leggiRighe('Classi').find(function (c) {
    return String(c.id) === classeId;
  });
  if (!classe) throw new Error('Classe non trovata: ' + classeId);
  return {
    classe: { id: String(classe.id), nome: String(classe.nome || classe.id) },
    studenti: leggiRighe('Studenti')
      .filter(function (s) {
        return String(s.classeId) === classeId;
      })
      .map(normalizza),
  };
}

/** +1 o -1 su un contatore (mai sotto zero). */
function conta(studenteId, categoria, delta) {
  if (CATEGORIE.indexOf(categoria) < 0) throw new Error('Categoria non valida: ' + categoria);
  const col = FOGLI.Studenti.indexOf(categoria) + 1;
  const d = Number(delta) === -1 ? -1 : 1;
  const sh = foglio('Studenti');
  const riga = trovaRiga(sh, studenteId);
  if (!riga) throw new Error('Studente non trovato');
  const cella = sh.getRange(riga, col);
  cella.setValue(Math.max(0, (Number(cella.getValue()) || 0) + d));
  return { studente: leggiStudente(riga) };
}

function addClass(c) {
  const id = pulisci(richiesto(c.id, 'id'), 20);
  if (trovaRiga(foglio('Classi'), id)) throw new Error('Classe già esistente: ' + id);
  const nuova = { id: id, nome: pulisci(c.nome || id, 60) };
  aggiungiRiga('Classi', nuova);
  return { classe: nuova };
}

function addStudent(s) {
  const classeId = richiesto(s.classeId, 'classeId');
  if (!trovaRiga(foglio('Classi'), classeId)) throw new Error('Classe non trovata: ' + classeId);
  const nuovo = {
    id: Utilities.getUuid(),
    classeId: classeId,
    nome: pulisci(richiesto(s.nome, 'nome'), 40),
    titolo: pulisci(s.titolo, 60),
    attivo: 'TRUE',
    pollo: 0,
    tacchino: 0,
    salame: 0,
    pagliaccio: 0,
  };
  aggiungiRiga('Studenti', nuovo);
  return { studente: normalizza(nuovo) };
}

function editStudent(s) {
  const sh = foglio('Studenti');
  const riga = trovaRiga(sh, richiesto(s.id, 'id'));
  if (!riga) throw new Error('Studente non trovato');
  const col = function (nome) {
    return FOGLI.Studenti.indexOf(nome) + 1;
  };
  if (s.nome !== undefined) {
    sh.getRange(riga, col('nome')).setValue(sicuro(pulisci(richiesto(s.nome, 'nome'), 40)));
  }
  if (s.titolo !== undefined) {
    sh.getRange(riga, col('titolo')).setValue(sicuro(pulisci(s.titolo, 60)));
  }
  if (s.attivo !== undefined) {
    sh.getRange(riga, col('attivo')).setValue(s.attivo ? 'TRUE' : 'FALSE');
  }
  return { studente: leggiStudente(riga) };
}

/** Rimette a zero tutti i contatori della classe (nomi e titoli restano). */
function azzera(classeId) {
  const sh = foglio('Studenti');
  const valori = sh.getDataRange().getValues();
  const iClasse = FOGLI.Studenti.indexOf('classeId');
  const primaCol = FOGLI.Studenti.indexOf('pollo') + 1;
  const zeri = [
    CATEGORIE.map(function () {
      return 0;
    }),
  ];
  let n = 0;
  for (let i = 1; i < valori.length; i++) {
    if (String(valori[i][iClasse]) === classeId) {
      sh.getRange(i + 1, primaCol, 1, CATEGORIE.length).setValues(zeri);
      n++;
    }
  }
  return { azzerati: n };
}

/* ------------------------------------------------------------------ */
/* Utilità foglio                                                       */
/* ------------------------------------------------------------------ */

function foglio(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('Manca il tab "' + nome + '": esegui setup()');
  return sh;
}

function leggiRighe(nome) {
  const valori = foglio(nome).getDataRange().getValues();
  const intest = valori.shift() || [];
  return valori
    .filter(function (r) {
      return r[0] !== '';
    })
    .map(function (r) {
      const o = {};
      intest.forEach(function (h, i) {
        o[h] = r[i];
      });
      return o;
    });
}

function leggiStudente(riga) {
  const valori = foglio('Studenti').getRange(riga, 1, 1, FOGLI.Studenti.length).getValues()[0];
  const o = {};
  FOGLI.Studenti.forEach(function (h, i) {
    o[h] = valori[i];
  });
  return normalizza(o);
}

function normalizza(s) {
  const o = {
    id: String(s.id),
    classeId: String(s.classeId),
    nome: String(s.nome),
    titolo: String(s.titolo || ''),
    attivo: String(s.attivo).toUpperCase() !== 'FALSE',
  };
  CATEGORIE.forEach(function (c) {
    o[c] = Number(s[c]) || 0;
  });
  return o;
}

function aggiungiRiga(nome, obj) {
  foglio(nome).appendRow(
    FOGLI[nome].map(function (h) {
      const v = obj[h] === undefined ? '' : obj[h];
      return typeof v === 'string' ? sicuro(v) : v;
    }),
  );
}

function trovaRiga(sh, id) {
  if (sh.getLastRow() < 2) return null;
  const cella = sh
    .getRange(2, 1, sh.getLastRow() - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
  return cella ? cella.getRow() : null;
}

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
function sicuro(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
