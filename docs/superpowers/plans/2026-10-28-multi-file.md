# Multi-file Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Confronto tra N file con un file base: vista a coppie per 2 file, matrice per 3 o più.

**Architecture:** `core/multi.ts` (`buildMatrix`) raggruppa per path i diff base↔file_i (riusa `diff`, `locateEntry`, `selectNode`, `startsWith`). UI: pannelli dinamici in `main.ts` (lista di slot con lettera, base, rimozione), `ui/matrix.ts` per la tabella e la barra azioni; la vista a coppie (`ui/result.ts`) resta invariata.

**Spec:** sezione "Confronto tra N file".

## Task 1: `core/multi.ts` — test `tests/multi.test.ts`
- righe ordinate per posizione nella base, celle uguale/modificata/rimossa/aggiunta con valori e `—`;
- stato ereditato da un antenato (`db` rimosso → riga `db.pool`);
- riga per nodo assente dalla base (valore base assente, file uguali assenti).

## Task 2: pannello input — controlli Base (radio) e Rimuovi, `setControls({ base, removable })`.

## Task 3: `main.ts` a slot dinamici + `index.html` (`#inputs`, `#add-file`); vista a coppie con base a sinistra; messaggi root/includi generalizzati (testi per 2 file invariati). Test esistenti adattati solo nel markup di partenza.

## Task 4: `ui/matrix.ts` + wiring: tabella, conteggi, selezione cella/path con posizionamento editor, barra azioni (`Base → X`, `X → Base`, `Base → tutti`). Test di integrazione: aggiunta file → matrice, selezione, riporti, cambio base, rimozione → ritorno a coppie.

## Task 5: stile, README, verifica finale.
