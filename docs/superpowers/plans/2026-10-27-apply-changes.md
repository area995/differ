# Apply Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Selezione di una differenza sposta la selezione in entrambi gli editor; pulsanti per riportare la modifica da un file all'altro; Salva.

**Architecture:** Modulo puro `core/text.ts` (offset/righe) e `core/patch.ts` (`applyEntry`, `patchSupport`) che produce un'edit testuale minima verificata con un nuovo parse. UI: `reveal()`/`replace()`/Salva nel pannello input, pulsanti nella lista risultato, wiring in `main.ts`.

**Spec:** sezione "Navigazione e riporto delle modifiche".

Nota: il codice di `patch.ts` nasce in TDD caso per caso (molti casi limite); qui sono fissati API e casi di test.

## API

```ts
// core/text.ts
toOffset(text: string, pos: Pos): number
lineStart(text: string, offset: number): number
lineEnd(text: string, offset: number): number   // indice del '\n' o text.length
indentAt(text: string, offset: number): string

// core/patch.ts
type Direction = 'aToB' | 'bToA';
type PatchDoc = { text: string; format: Format; node: Node /* root applicata */; rootPath: Path /* [] se root non applicata */ };
type Edit = { start: number; end: number; text: string };   // sul testo di destinazione originale
type PatchResult = { ok: true; text: string; edit: Edit } | { ok: false; error: string };
patchSupport(entry, a, b, ignoreArrayOrder): string | null   // null = applicabile, altrimenti motivo
applyEntry(entry, direction, a, b): PatchResult
```

## Task 1: `core/text.ts` — test `tests/text.test.ts`
toOffset (prima riga, righe successive, oltre fine testo), lineStart/lineEnd, indentAt.

## Task 2: `core/patch.ts` — test `tests/patch.test.ts`
YAML: valore scalare (selezione = valore), quoting/commenti di B preservati, scalare → mappa a blocco, mappa a blocco → scalare (`a: 5`), inserimento chiave dopo àncora / in testa / con valore a blocco, commento inline dell'àncora non spostato, eliminazione chiave con sottoalbero, inserimento/eliminazione elementi di sequenza (scalari e mappe), mappa flow (inserisci/elimina), riga whitespace, cross-format (stringa `"1"` quotata in YAML).
JSON: valore scalare, inserimento dopo àncora multi-riga / in testa single-line / in oggetto vuoto, eliminazione in mezzo / ultima / prima single-line, inserimento oggetto da YAML (indentato), elemento di array.
Rifiuti: `moved`, prima chiave di elemento compatto YAML. `patchSupport`: moved, whitespace cross-format, ignoreArrayOrder con indici.
Root: riporto con root applicata a un solo lato.

## Task 3: UI pannello input — `reveal(range | null)`, `replace(edit)` (execCommand con fallback `setRangeText`), marcatura gutter `cur`, pulsante Salva.

## Task 4: lista risultato — pulsanti `A → B` / `B → A` (disabilitati con motivo), callback `onSelect`/`onApply`; wiring `main.ts` (PatchDoc per lato, notice errori). Test integrazione in `tests/app.test.ts`: selezione in entrambi gli editor, riporto A→B e B→A, errore mostrato, Salva.

## Task 5: README, verifica finale (test, typecheck, build).
