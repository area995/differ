# KV Diff

Confronto semantico tra file chiave-valore (JSON, YAML) nel browser. I file non lasciano mai il client.

## Opzioni

- **Differenze chiavi**: chiavi aggiunte o rimosse
- **Differenze valori**: valori o tipi diversi sulle stesse chiavi
- **Spazi e tabulazioni**: differenze di formattazione su contenuti uguali (solo file dello stesso formato)
- **Posizione chiavi**: chiavi comuni in ordine diverso
- **Ignora ordine array**: abbina gli elementi per uguaglianza, o per un campo chiave (es. `name`)
- **Tipi laschi**: `8080` uguale a `"8080"`

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm test         # test
npm run build    # build statica in dist/
```

## Deploy

`dist/` è un sito statico con percorsi relativi: pubblicabile su GitHub Pages, Netlify, S3 o qualsiasi web server.
