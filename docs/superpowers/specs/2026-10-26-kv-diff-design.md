# KV Diff — Design

Data: 2026-10-26
Stato: approvato (approccio A)

## Obiettivo

Tool web per confrontare due file chiave-valore in modo semantico ("smart"), permettendo
all'utente di scegliere quali categorie di differenze evidenziare. Formati v1: JSON e YAML.

## Vincoli

- SPA statica: tutto il calcolo avviene nel browser, i file non lasciano mai il client.
  Deploy su hosting statico (GitHub Pages, Netlify, S3).
- Stack: Vite + TypeScript vanilla, test con Vitest.
- Parser unico: libreria `yaml` (eemeli) per entrambi i formati.

## Funzionalità

### Input

- Due pannelli (A e B). Ogni pannello accetta testo incollato, file da file picker o drag&drop.
- Formato per pannello: `auto` (default), `json`, `yaml`.
  - `auto`: estensione del file se disponibile (`.json` → json, `.yml`/`.yaml` → yaml);
    altrimenti, se il testo (trim) inizia con `{` o `[` e `JSON.parse` ha successo → json, altrimenti yaml.
- Confronto cross-formato ammesso (A JSON, B YAML): il confronto avviene sul modello dati.
- Ricalcolo automatico a ogni modifica di testo o opzioni, con debounce di 300 ms.

### Opzioni

| Opzione | Default | Effetto |
|---|---|---|
| Differenze chiavi | on | riporta chiavi aggiunte (`added`) e rimosse (`removed`) |
| Differenze valori | on | riporta valori diversi su path comuni (`changed`) e cambi di tipo (`type`) |
| Spazi e tabulazioni | off | riporta differenze di formattazione (`whitespace`) su nodi semanticamente uguali |
| Posizione chiavi | off | riporta chiavi comuni di un oggetto in ordine relativo diverso (`moved`) |
| Ignora ordine array | off | gli elementi degli array vengono abbinati senza considerare l'indice |
| Campo chiave array | vuoto | con "Ignora ordine array" attivo, abbina oggetti in array per valore di questo campo (es. `name`, `id`) |
| Tipi laschi | off | scalari confrontati per rappresentazione stringa normalizzata (`8080` == `"8080"`) |
| Root | vuoto | path del nodo da usare come radice del confronto nei file che lo contengono (vedi sotto) |
| Includi | vuoto | path relativi alla root, separati da virgola: confronta solo quei sottoalberi (vedi sotto) |

"Solo chiavi" = Differenze valori off. "Solo valori" = Differenze chiavi off.
Con entrambe off, restano solo eventuali `whitespace` e `moved`.

### Root del confronto

Campo di testo nella barra opzioni. Vuoto = documento intero. Per ciascun file: se il path esiste,
si confronta il suo valore; altrimenti si usa il documento intero. Esempio: A = `config: {port: 1}`,
B = `port: 2`, root `config` → si confronta `A.config` con l'intero B.

Sotto le opzioni un messaggio indica dove è stata applicata la root ("applicata a A e B",
"applicata solo a A: confrontata con l'intero file B", "non trovata: confronto tra i file interi").
Con root applicata a un solo file l'opzione "Spazi e tabulazioni" è disabilitata: l'annidamento
cambia l'indentazione di tutte le righe.

- Sintassi = quella dei path mostrati nella lista differenze (copiabili): `$` iniziale opzionale,
  `.chiave`, `[0]`, `["chiave.con.punti"]`, `[campo=valore]` (elemento di array il cui campo vale `valore`).
  `server.config` equivale a `$.server.config`. Dopo un punto è ammesso qualsiasi carattere tranne `.`, `[`, `]`.
- Path nei risultati relativi alla root (`$` = nodo root); righe ed evidenziazioni restano quelle reali del file.
- Modulo `core/select.ts`: `parsePath(text)`, `selectNode(node, path)` e `applyRoot(a, b, path)`.
  La selezione avviene nella UI prima di `diff()`, che resta invariato.

### Sottoalberi inclusi

Campo "Includi": lista di path (stessa sintassi di Root) relativi alla root già applicata a ciascun file,
separati da virgola (il parser accetta anche a capo); le virgole dentro `[...]` o tra virgolette non separano. Vuoto = tutto.

Il diff si calcola sull'intera root e poi si filtra (`core/filter.ts`, `filterEntries`). Restano:
- le differenze con path dentro un sottoalbero incluso;
- le differenze `added`, `removed`, `type` su un antenato di un path incluso (spiegano la sparizione del
  sottoalbero, es. `removed $.db` per l'include `db.pool`). `whitespace` e `moved` sugli antenati sono scartati.

Messaggi nella stessa area della root (una riga ciascuno): `Includi non valido: …` (errore, nessun diff) e
`Includi: $.x non trovato né in A né in B` (avviso). Limite: i segmenti sono confrontati come appaiono nei
path della lista, quindi con "Ignora ordine array" + campo chiave serve `users[name=alice]`, non `users[0]`.

### Navigazione e riporto delle modifiche

**Selezione.** Click su una voce della lista: oltre allo scroll dei pannelli risultato, in entrambi gli editor
di input il nodo viene selezionato e scrollato in vista, e i numeri di riga coinvolti si evidenziano nel gutter
(il browser mostra il cursore solo nel campo con focus; il focus resta sulla lista).

**Riporto.** Ogni voce ha i pulsanti `A → B` e `B → A`:

| Tipo | `A → B` | `B → A` |
|---|---|---|
| changed / type | valore di A sostituisce quello di B | viceversa |
| removed (solo in A) | inserisce in B | elimina da A |
| added (solo in B) | elimina da B | inserisce in A |
| whitespace | riga di A sostituisce riga di B (solo stesso formato) | viceversa |
| moved | non disponibile | non disponibile |

Disabilitati (con motivo nel tooltip) per `moved`, `whitespace` tra formati diversi e, con "Ignora ordine array",
per path con indici (gli indici dei due lati non coincidono).

Modifica chirurgica sul testo (`core/patch.ts`): cambia solo la porzione del nodo; il resto del file resta
identico. Stesso formato: si riusa il testo sorgente (quoting, stile) reindentato alla posizione di destinazione.
Formati diversi: JSON via `JSON.stringify` (indentato se il contenitore è su più righe); YAML con scalari
quotati se serve, collezioni flow dentro contenitori flow, a blocco altrove. Inserimento dopo la chiave/elemento
precedente (nell'ordine del sorgente) presente nella destinazione, altrimenti in testa; gli elementi di array
alla stessa posizione (o in coda se abbinati per campo). Eliminazione di righe intere o della porzione inline
con la virgola adiacente.

Dopo ogni modifica il file viene riparsato e si verifica che il nodo coincida col sorgente (o sia sparito).
Se la verifica fallisce non si applica nulla e compare "Impossibile riportare automaticamente questa modifica".
Root/Includi: i path vengono riportati a quelli reali di ciascun file.

La modifica passa dall'editor (`execCommand('insertText')` dove disponibile) così Ctrl+Z la annulla.
Pulsante **Salva** per pannello: scarica il testo corrente (nome file originale, oppure `file-a.<formato>`).

Fuori scope: riporto di chiavi spostate, eliminazione/inserimento della prima chiave di un elemento compatto
YAML (`- name: x`, rifiutato dalla verifica), "applica tutte".

## Architettura

```
src/
  core/            # puro, nessuna dipendenza dal DOM
    model.ts       # tipi: Node, Range, DiffEntry, DiffOptions
    parse.ts       # testo + formato -> Node | ParseError
    detect.ts      # auto-detect formato
    diff.ts        # diff(a, b, opts) -> DiffEntry[]
    arrays.ts      # abbinamento elementi array (per indice / deep-equal / campo chiave)
    order.ts       # rilevamento chiavi spostate (LCS)
    whitespace.ts  # confronto formattazione righe raw
  ui/
    main.ts        # bootstrap, stato, debounce
    input.ts       # pannelli input, file picker, drag&drop
    options.ts     # barra opzioni
    result.ts      # vista side-by-side + lista differenze
  styles.css
index.html
```

### Modello (`core/model.ts`)

```ts
type Pos = { line: number; col: number };          // 1-based
type Range = { start: Pos; end: Pos };

type Node =
  | { kind: 'object'; range: Range; entries: { key: string; keyRange: Range; value: Node }[] }
  | { kind: 'array'; range: Range; items: Node[] }
  | { kind: 'scalar'; range: Range; value: string | number | boolean | null };

type Path = (string | number)[];                    // visualizzato come $.server.ports[0]

type DiffKind = 'added' | 'removed' | 'changed' | 'type' | 'moved' | 'whitespace';

type DiffEntry = {
  kind: DiffKind;
  path: Path;
  a?: { value?: unknown; range: Range };            // assente per 'added'
  b?: { value?: unknown; range: Range };            // assente per 'removed'
  detail?: string;                                   // es. "tab vs spazi", "trailing spaces"
};

type DiffOptions = {
  keys: boolean; values: boolean; whitespace: boolean; keyOrder: boolean;
  ignoreArrayOrder: boolean; arrayKeyField: string; looseTypes: boolean; root: string; include: string;
};
```

`entries` di un oggetto conserva l'ordine del sorgente (necessario per `keyOrder`).

### Parsing (`core/parse.ts`)

- JSON: prima `JSON.parse` per validazione stretta (rifiuta virgole finali, commenti, ecc.;
  l'errore riporta riga/colonna calcolata dall'offset). Poi `yaml.parseDocument` per l'AST con range.
- YAML: `yaml.parseDocument` con `uniqueKeys: true`. Errori/warning del documento → `ParseError`.
- Chiavi duplicate → errore.
- Chiavi non stringa in YAML (es. `1: a`) vengono convertite a stringa.
- Alias/anchor YAML: risolti (il nodo alias viene espanso col valore dell'anchor, con il range dell'alias).
- Multi-documento YAML (`---` multipli): errore "multi-documento non supportato" in v1.
- Conversione offset → riga/colonna tramite `LineCounter` di `yaml`.

### Algoritmo diff (`core/diff.ts`)

Ricorsione su coppie di nodi (a, b) con path corrente:

1. **Tipi diversi** (object vs array vs scalar): se `values` → `type`. Non si scende.
2. **Scalari**: uguaglianza stretta (`===`, e tipo). Con `looseTypes`: `String(x)` normalizzato
   (numeri via `String(Number(...))`, bool/null in minuscolo). Diversi → `changed` se `values`.
   Se uguali e `whitespace` attivo → `whitespace.ts`.
   Uno scalare `8080` vs `"8080"` con `looseTypes` off → `type`.
3. **Oggetti**: chiavi solo in A → `removed`; solo in B → `added` (se `keys`). Chiavi comuni → ricorsione.
   Se `keyOrder` → `order.ts` sulle chiavi comuni.
4. **Array**: `arrays.ts` produce coppie abbinate + elementi non abbinati. Non abbinati in A → `removed`,
   in B → `added` (se `keys`; per gli array "chiave" = elemento). Coppie → ricorsione.

L'output è ordinato per posizione in A (poi B per gli `added`).

### Array (`core/arrays.ts`)

- Default: abbina per indice; eccedenza → added/removed.
- `ignoreArrayOrder` senza campo: abbina ogni elemento di A al primo elemento non usato di B
  deep-equal (rispettando `looseTypes`); i restanti vengono abbinati per indice relativo tra i
  non usati, in modo da riportare `changed` invece di coppie added/removed.
- `ignoreArrayOrder` con campo: elementi oggetto abbinati per valore del campo; elementi senza
  il campo ricadono nel caso senza campo. Path dell'elemento visualizzato come
  `$.users[name=alice]` invece dell'indice.

### Ordine chiavi (`core/order.ts`)

Sulle chiavi comuni a A e B, sequenza A e sequenza B (ordine sorgente). LCS: le chiavi fuori
dalla LCS vengono riportate come `moved` (detail: "posizione N → M").

### Whitespace (`core/whitespace.ts`)

Attivo solo se entrambi i pannelli hanno lo stesso formato; altrimenti l'opzione è disabilitata
in UI con tooltip esplicativo.

Per ogni coppia di nodi scalari semanticamente uguali (e per ogni chiave comune), confronta le
righe raw che contengono il nodo in A e in B:

- indentazione diversa (numero di spazi);
- tab vs spazi nell'indentazione;
- trailing whitespace;
- spaziatura interna diversa attorno a `:` o `,`.

Una differenza per riga, con `detail` descrittivo. Le righe vuote/aggiunte tra nodi non sono
riportate in v1.

## UI

- Header: titolo, selettori formato per pannello, barra opzioni (checkbox + input campo chiave).
- Area input: due textarea affiancate con numeri di riga, zone drop.
- Area risultato:
  - Contatori per tipo (es. "3 aggiunte, 1 rimossa, 2 modificate") con legenda colori.
  - Vista side-by-side: testo A e B renderizzato riga per riga, righe colorate per tipo di differenza
    (added verde in B, removed rosso in A, changed giallo in entrambi, type arancio, moved blu,
    whitespace grigio tratteggiato con caratteri invisibili resi visibili: `→` tab, `·` spazio).
  - Lista differenze: path, tipo, valore A → valore B. Click su voce → scroll a riga in entrambi
    i pannelli + evidenziazione temporanea.
  - Nessuna differenza → messaggio "File equivalenti con le opzioni correnti".
- Responsive: sotto 900 px i pannelli si impilano.
- Tema chiaro/scuro da `prefers-color-scheme`.

Lo scroll dei due pannelli del risultato non è sincronizzato in v1 (il click sulla lista porta entrambi
alla riga giusta).

## Gestione errori

- Errore di parsing → messaggio nel pannello interessato con riga/colonna e riga evidenziata;
  nessun diff calcolato.
- Pannello vuoto → nessun diff, nessun errore (stato neutro).
- File > 5 MB → avviso e conferma prima del caricamento.
- Root con sintassi non valida → messaggio "Root non valida" sotto le opzioni, nessun diff.
- Includi con sintassi non valida → messaggio "Includi non valido" sotto le opzioni, nessun diff.

## Test

- Vitest su `core/` con fixture in `tests/fixtures/`:
  - parse: JSON valido/invalido (virgola finale), YAML, chiavi duplicate, anchor/alias, multi-doc, range corretti;
  - detect: estensioni e contenuto;
  - diff per ogni opzione singolarmente e in combinazione;
  - cross-formato JSON vs YAML equivalenti → zero differenze;
  - array: per indice, deep-equal, campo chiave;
  - order: scambio chiavi, chiave spostata in mezzo;
  - whitespace: tab vs spazi, indentazione, trailing.
- UI: smoke test (jsdom) che carica due testi e verifica rendering della lista.

## Fuori scope v1

Altri formati (TOML, .properties, INI, XML — il modello comune li rende aggiungibili),
export del report, URL condivisibili, editor con syntax highlighting, scroll sincronizzato,
YAML multi-documento, persistenza delle opzioni, root diverse per A e B.
