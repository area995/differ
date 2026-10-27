# Ledger

Confronto semantico tra file chiave-valore (JSON, YAML) nel browser. I file non lasciano mai il client.

## Opzioni

- **Differenze chiavi**: chiavi aggiunte o rimosse
- **Differenze valori**: valori o tipi diversi sulle stesse chiavi
- **Spazi e tabulazioni**: differenze di formattazione su contenuti uguali (solo file dello stesso formato)
- **Posizione chiavi**: chiavi comuni in ordine diverso
- **Ignora ordine array**: abbina gli elementi per uguaglianza, o per un campo chiave (es. `name`)
- **Tipi laschi**: `8080` uguale a `"8080"`
- **Root**: path (es. `config`, `$.spec.template`, `users[name=alice]`) il cui valore viene usato al posto del documento nei file che lo contengono; utile per confrontare un file annidato con uno non annidato
- **Includi**: path relativi alla root separati da virgola (es. `server, db.pool`): confronta solo quei sottoalberi.
  **Scegli** apre l'albero dei sottoalberi presenti nei file (unione) per spuntarli

## Card dei file

- Il testo è in sola lettura: si scorre e si seleziona per copiarlo, ma non si scrive. Il contenuto arriva da
  **Apri file…**, dal trascinamento di un file sulla card o incollandolo (`Ctrl+V` con la card attiva), che
  sostituisce tutto il contenuto.
- Più file insieme: **Apri file…** accetta una selezione multipla e si possono trascinare più file. Il primo va
  nella card, gli altri nelle card vuote successive, aggiungendone se servono; le card già piene non vengono
  sovrascritte. I file rilasciati fuori dalle card vanno nelle prime card vuote.
- Schede **Testo** / **Albero**: l'albero mostra il documento con nodi comprimibili (Espandi/Comprimi tutto);
  click su un nodo per tornare al testo con il nodo selezionato.
- Icone: download per salvare il contenuto, cestino per rimuovere il file.

## Più di due file

- **+ Aggiungi file** aggiunge File C, D, …; il selettore **Base** sceglie il file di riferimento, l'icona cestino rimuove
  un file (quando sono più di due).
- Con due file resta la vista affiancata (base a sinistra). Con tre o più compare una **matrice**: una riga per
  ogni path che differisce in almeno un file, una colonna per file, celle colorate rispetto alla base.
- Click su una cella: tutti gli editor si posizionano sulla riga; la barra azioni offre `Base → File X`,
  `File X → Base` e `Base → tutti`.

## Navigare e riportare le modifiche

- Click su una differenza: il nodo viene selezionato in entrambi gli editor e le righe si evidenziano nel gutter.
- Pulsanti `A → B` / `B → A`: riportano la modifica nell'altro file toccando solo il testo di quel nodo
  (valori, chiavi o elementi aggiunti/rimossi, righe di formattazione). Il risultato viene verificato prima di
  applicarlo; se non è possibile farlo in modo sicuro compare un avviso. **Annulla** nella riga di stato lo
  ripristina.
- Le righe cambiate da un riporto restano evidenziate in grigio nell'editor (`+` righe aggiunte, `−` righe
  rimosse) finché il contenuto non viene sostituito.
- **Salva** su ogni pannello scarica il contenuto attuale.

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm test         # test
npm run build    # build statica in dist/
```

## Deploy

`dist/` è un sito statico con percorsi relativi: pubblicabile su GitHub Pages, Netlify, S3 o qualsiasi web server.

### Docker

L'immagine compila ed esegue i test (una build fallisce se un test fallisce), poi serve `dist/` con nginx
non-root sulla porta 8080.

```bash
docker compose up --build        # Docker Desktop: poi apri http://localhost:8080
LEDGER_PORT=8090 docker compose up --build   # se la 8080 è occupata (PowerShell: $env:LEDGER_PORT=8090)
# oppure
docker build -t ledger .
docker run --rm -p 8080:8080 ledger
```
