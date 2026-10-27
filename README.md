# KV Diff

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

- Schede **Testo** / **Albero**: l'albero mostra il documento con nodi comprimibili (Espandi/Comprimi tutto);
  click su un nodo per tornare al testo con il nodo selezionato.
- Icone: download per salvare il contenuto, cestino per rimuovere il file.

## Più di due file

- **+ Aggiungi file** aggiunge File C, D, …; il selettore **Base** sceglie il file di riferimento, **×** rimuove
  un file (quando sono più di due).
- Con due file resta la vista affiancata (base a sinistra). Con tre o più compare una **matrice**: una riga per
  ogni path che differisce in almeno un file, una colonna per file, celle colorate rispetto alla base.
- Click su una cella: tutti gli editor si posizionano sulla riga; la barra azioni offre `Base → File X`,
  `File X → Base` e `Base → tutti`.

## Navigare e riportare le modifiche

- Click su una differenza: il nodo viene selezionato in entrambi gli editor e le righe si evidenziano nel gutter.
- Pulsanti `A → B` / `B → A`: riportano la modifica nell'altro file toccando solo il testo di quel nodo
  (valori, chiavi o elementi aggiunti/rimossi, righe di formattazione). Il risultato viene verificato prima di
  applicarlo; se non è possibile farlo in modo sicuro compare un avviso. `Ctrl+Z` nell'editor annulla.
- Le righe cambiate da un riporto restano evidenziate in grigio nell'editor (`+` righe aggiunte, `−` righe
  rimosse) finché il testo non viene modificato a mano.
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
