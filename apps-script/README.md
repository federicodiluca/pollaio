# Backend: Google Sheet + Apps Script

Il Pollaio salva tutto in un Google Sheet **tuo e privato**. Un piccolo script pubblicato come
"App web" fa da ponte tra il foglio e il sito. Niente Google Cloud Console, niente OAuth.

## 1. Crea il foglio

1. Vai su [sheets.new](https://sheets.new) e crea un foglio vuoto, per esempio "Pollaio".
2. Non condividerlo con nessuno: lo script gira con il tuo account.

## 2. Incolla lo script

1. Nel foglio: **Estensioni > Apps Script**.
2. Cancella il contenuto di `Codice.gs` (o `Code.gs`) e incolla tutto il file
   [`Code.gs`](Code.gs) di questa cartella.
3. Salva (icona del dischetto).

## 3. Crea i tab

1. Nella barra in alto scegli la funzione **`setup`** e premi **Esegui**.
2. La prima volta Google chiede le autorizzazioni: **Rivedi autorizzazioni**, scegli il tuo
   account, poi **Avanzate > Vai a ... (non sicuro)** e **Consenti**. È il tuo script, sul tuo
   foglio: l'avviso compare perché non è verificato da Google.
3. Nel foglio compaiono i tab `Classi`, `Studenti`, `Eventi`, `Config`.

`setup` si può rieseguire senza danni: crea solo ciò che manca.

## 4. Imposta il PIN

1. Nell'editor Apps Script: **Impostazioni progetto** (ingranaggio a sinistra).
2. In fondo, **Proprietà script > Aggiungi proprietà script**.
3. Proprietà: `PIN`, Valore: il tuo PIN (consigliato almeno 6 caratteri).
4. **Salva proprietà script**.

Il PIN non sta nel foglio né nel codice: è controllato a ogni richiesta, in lettura e in
scrittura. Dopo 20 tentativi sbagliati in 15 minuti il server rifiuta tutto per un po'.

## 5. Pubblica come App web

1. In alto a destra: **Esegui il deployment > Nuovo deployment**.
2. Tipo (ingranaggio): **App web**.
3. **Esegui come: Io**, **Chi ha accesso: Chiunque**.
4. **Esegui il deployment** e copia l'**URL dell'app web** (finisce con `/exec`).

"Chiunque" significa che chiunque abbia l'URL può _chiamare_ lo script, ma senza PIN riceve
solo "PIN errato".

## 6. Aggiungi classi e studenti

Puoi farlo dall'app (vista Prof > Gestione), oppure a mano nel foglio:

- `Classi`: una riga per classe, per esempio `1M | 1M`.
- `Studenti`: `id` univoco (anche solo `1m-01`), `classeId`, `nomeVisualizzato`, `attivo` = `TRUE`.

Consiglio per la privacy: usa nomi brevi o soprannomi (es. "Marco B."), non nomi e cognomi completi.

## 7. Collega il sito

Apri il sito, incolla l'URL `/exec` e il PIN. Restano salvati solo nel browser (localStorage).

## Aggiornare lo script

Se incolli una nuova versione di `Code.gs`: **Esegui il deployment > Gestisci deployment >**
matita **> Versione: Nuova versione > Esegui il deployment**. L'URL resta lo stesso.

## Config

| chiave                | default | significato                                     |
| --------------------- | ------- | ----------------------------------------------- |
| `punti.POLLO`         | 1       | ci sei cascato                                  |
| `punti.TACCHINO`      | 2       | ci sei cascato di brutto                        |
| `punti.SALAME`        | 3       | ci sei cascato con tutte le scarpe              |
| `punti.PAGLIACCIO`    | 2       | passaggio del naso rosso                        |
| `punti.SPIEGO_PEGGIO` | 1       | mi hai fatto dire "mi spiego peggio"            |
| `punti.PORCO_ME`      | 2       | mi hai fatto dire "porco me"                    |
| `punti.PATATINO`      | 1       | bravo! (classifica separata)                    |
| `boia.soglia`         | 3       | da quanti punti scatta "Boia dei matti!"        |
| `stagione.<classe>`   | 1       | stagione corrente della classe (gestita da app) |
| `albo.<classe>`       | `[]`    | albo d'oro (gestito dall'app, non toccare)      |

I punti valgono per gli eventi **nuovi**: ogni evento salva i punti del momento.

## API

Tutte le risposte: `{ "ok": true, "data": ... }` oppure `{ "ok": false, "errore": "..." }`.

**Letture** (`GET`): `?action=...&pin=...`

- `listClassi`
- `getState&classeId=1M`: classe, studenti, eventi (tutte le stagioni), config, stagione, albo
- `exportAll`: tutto il foglio

**Scritture** (`POST`, corpo JSON, `Content-Type: text/plain` per evitare il preflight CORS):

- `{ action: "addEvent", pin, evento: { id, classeId, studenteId, tipo, nota?, timestamp? } }`
- `{ action: "undoEvent", pin, id }`: aggiunge un evento `ANNULLA` (il foglio Eventi è in sola aggiunta)
- `{ action: "addClass", pin, classe: { id, nome } }`
- `{ action: "addStudent", pin, studente: { id?, classeId, nomeVisualizzato } }`
- `{ action: "editStudent", pin, studente: { id, nomeVisualizzato?, attivo? } }`
- `{ action: "newSeason", pin, classeId }`: proclama Salame d'oro e Patatino d'oro

Gli `id` degli eventi li genera il client: se la coda offline rimanda lo stesso evento, il
server lo riconosce e non lo duplica.
