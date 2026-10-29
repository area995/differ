---
name: Ledger
description: Confronto semantico JSON / YAML. I file restano nel browser.
colors:
  canvas: "#e6e9ee"
  signal-blue: "#3b6fd8"
  ink: "#1d2330"
  slate-muted: "#5f6878"
  paper: "#ffffff"
  bench-gray: "#f6f7f9"
  hairline: "#d9dde5"
  alarm-red: "#c42b2b"
  applied-gray: "#e3e6ea"
  added-mint: "#e3f6e8"
  added-green: "#2e9e50"
  removed-blush: "#fde7e7"
  removed-red: "#d0393e"
  changed-cream: "#fff4cc"
  changed-ochre: "#a87f00"
  type-peach: "#ffe6d1"
  type-orange: "#c55a12"
  moved-mist: "#e1ecff"
  whitespace-fog: "#eef0f3"
  whitespace-steel: "#7a8496"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.4rem"
    fontWeight: 700
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 700
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
components:
  button-small:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  icon-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "28px"
  add-file-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.signal-blue}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  tab:
    backgroundColor: "{colors.bench-gray}"
    textColor: "{colors.slate-muted}"
    padding: "2px 12px"
    typography: "{typography.label}"
  tab-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  text-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 6px"
  panel:
    backgroundColor: "{colors.bench-gray}"
    rounded: "{rounded.lg}"
    padding: "8px"
  editor:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "280px"
    typography: "{typography.code}"
  file-name-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  diff-chip:
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  notice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.alarm-red}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  status-line:
    backgroundColor: "{colors.bench-gray}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: Ledger

## Overview

**Creative North Star: "The Change Ledger"**

Every difference is an entry in a ledger. It has a kind, a color that says which kind, a path, a line number, and an action that copies it to the other file. The interface is the ledger's paper: neutral, ruled with hairlines, and quiet enough that the entries are what you read. Color is almost never decoration. A colored surface means "this is a difference of this kind", and the six kind colors stay consistent across chips, list rows, editor lines, tree nodes and matrix cells.

The tone is precise but friendly. Layouts are dense, fonts are the system's own, and the chrome sticks to the conventions engineers already know from editors and diff viewers. Softer touches (gently rounded corners, a pill around each loaded file name, a dashed "+ Aggiungi file" affordance) keep a tool built for repeated expert use from feeling hostile. Light and dark themes both ship: Auto follows the OS through `prefers-color-scheme`, Chiaro and Scuro pin one.

The ledger is still. Motion only says where to look and that something happened: a Signal Blue **wash** that dries away on editor lines where a selection lands or an apply has just written, a short arrival for each new outcome message, and pickers that unroll from their field. Nothing moves on load, while the result recomputes, or for its own sake.

**The Still Ledger Rule.** Never animate layout, entrances on load, or the recomputed result. Motion marks the user's own action and its outcome, nothing else.

**Key Characteristics:**
- Flat, bordered surfaces on three tonal levels (canvas, bench gray, paper). No shadows.
- One interactive accent, Signal Blue, for selection, focus, hover and the base file.
- A closed set of six difference-kind color pairs (a tint plus a bar), used everywhere a difference appears.
- System UI font for chrome, system monospace for anything that is data.
- Small, compact controls (2px × 8px padding on small buttons, 28px icon buttons).
- Motion as a pointer, not a performance: the wash, arrivals, unrolling pickers.

## Colors

The palette is neutral paper and ink, one Signal Blue accent, and six paired kind colors that make up the ledger's vocabulary. Every color is a CSS custom property with a light value and a dark value.

### Primary
- **Signal Blue**: the only interactive accent. Marks the base file (panel border), the focus ring, hover on buttons and selectable tree keys, the selected diff row and matrix cell (2px outline), the selected node's frame in the editor, drag-and-drop targets (2px dashed outline), the add-file text, the text caret and the wash. It is also the `moved` bar color. Dark theme: `#7aa2ff`.

### Neutral
- **Ink**: primary text. Dark theme: `#e4e7ec`.
- **Slate Muted**: secondary text such as the tagline, legends, detected format, gutter numbers, inactive tabs, tree values that are not strings, badges and notes, and the dashed border of the add-file button and the waiting box. Dark: `#98a2b3`.
- **Canvas**: the page itself, and the sticky answer bar that belongs to it. The darkest surface in light theme, so panels read as sheets laid on it. Dark: `#0e1014`.
- **Paper**: working surfaces: the editor, tree view, pickers, inputs and button fills that sit on top of panels, plus the diff list, the matrix body and the refusal notice. Dark: `#14171c`.
- **Bench Gray**: panel surfaces (options bar, file cards, gutter, matrix headers and actions bar, status line, waiting box, equal banner, theme-switch track). Dark: `#1b1f26`.
- **Hairline**: every border and divider, and the scrollbar thumbs. Dark: `#2c323c`.
- **Alarm Red**: parse errors, invalid Root / Includi / Escludi, configuration errors, the refusal notice and error lines in the gutter. Dark: `#ff6b6b`.
- **Applied Gray**: background of editor lines changed by an apply, kept until the content is replaced. Dark: `#2d323a`.

### Difference Kinds (the ledger vocabulary)
Each kind pairs a pale **tint** (row or line background) with a saturated **bar** (4px left border).
- **Added**: Added Mint tint with Added Green bar.
- **Removed**: Removed Blush tint with Removed Red bar.
- **Changed**: Changed Cream tint with Changed Ochre bar.
- **Type**: Type Peach tint with Type Orange bar.
- **Moved**: Moved Mist tint with Signal Blue bar. Moved Mist also marks the current line in the gutter and the text selection, the places it stands for selection rather than a move.
- **Whitespace**: Whitespace Fog tint with Whitespace Steel bar. On editor lines the bar is dashed rather than solid, because whitespace changes are formatting, not meaning.

Every bar keeps at least 3:1 against its own tint (WCAG non-text contrast); that is why the light-theme Ochre, Orange and Steel are deeper than their dark-theme counterparts (#c99a06, #dd6b20, #8a94a6), and why the dark Moved bar follows the dark accent (#7aa2ff). In dark theme the tints darken (added `#16351f`, removed `#3d1a1b`, changed `#3a3212`, type `#3d2614`, moved `#172a4a`, whitespace `#23272e`) while Added Green and Removed Red stay the same.

### Named Rules
**The Ledger Color Rule.** A kind color appears only where that kind of difference appears. Never use Added Green for "success", Changed Ochre for "warning" or Removed Red for "delete" in unrelated chrome. The six pairs are reserved vocabulary.

**The Tint-Plus-Bar Rule.** A difference is always shown as a pale tint with a 4px saturated left bar. Never a full-saturation fill, and never the tint without the bar.

**The One Accent Rule.** Signal Blue is the only interactive color. Selection, focus, the base file, hover and the wash all use it. Don't add a second accent.

## Typography

**Body Font:** system-ui (with -apple-system, Segoe UI, sans-serif)
**Label/Mono Font:** ui-monospace (with SFMono-Regular, Consolas, monospace)

**Character:** The pairing is entirely native. The system sans handles chrome and prose so the tool feels at home on each OS. The system monospace carries everything that is data (editors, gutters, trees, the matrix, path readouts) so columns line up and paths read exactly as typed.

### Hierarchy
- **Headline** (700, 1.4rem): the app title "Ledger" only.
- **Title** (700, 1rem): card headings such as "File A" and "File B".
- **Body** (400, 1rem): option labels, diff-list descriptions, notices.
- **Label** (400, 0.85rem): small buttons, tabs, chips, legends (600), detected format, base picker, the scope and configuration messages, the evidence line.
- **Code** (400, 13px, line-height 1.5; trees use 1.6): editors, gutters, trees, matrix cells and the evidence line's path and file lines. Matrix column headers switch back to the sans.

### Named Rules
**The Data Is Mono Rule.** Anything the user could copy into a file or a path field (keys, values, paths, line content) is set in monospace. Labels about data are set in the sans.

## Layout

A single scrolling page with 16px body padding, stacked top to bottom in task order: header (title and tagline on the left, theme switch on the right), options bar, the **answer bar**, file cards, the add-file button, the notice and status lines, then results (diff list, or the matrix). The editors carry the differences in place, so the result never repeats the files.

- **Options bar** is a three-column grid of labelled groups (1.6fr / 1fr / 1fr, 12px × 24px gap): **Ambito** (Root; Includi and Escludi, each with its Scegli button and its picker right below; the scope message), **Mostra** (the four difference-kind toggles), **Confronto** (array order with its key field, loose types). A **configuration row** spans all three columns below them, after a Hairline divider: Carica configurazione…, the file-name field, Salva configurazione and their outcome message. One column below 900px.
- **Answer bar** is sticky at the top of the viewport (Canvas, full-bleed, 1px Hairline bottom border): the summary chips, the "equal" banner or the waiting message, then the **evidence line** of the selected difference: its path, and for each file its short name, line number ("r. 12") and first line of text, or "assente". The answer and the evidence stay next to the list however far it is scrolled; selecting never scrolls the page.
- **File cards** sit in an auto-fit grid (`minmax(min(100%, 420px), 1fr)`, 12px gap). Two files sit side by side; three or more wrap onto new rows. Cards in the same row share their header, tab and editor rows (CSS subgrid), so when one header wraps (a file name, "modificato, non salvato") the editors beside it still start at the same height and line 1 faces line 1.
- **Diff list rows** use a four-column grid (kind 8em, path 1fr, description 2fr, apply actions auto) that collapses to one column below 600px.
- **Matrix** is a full-width collapsed table inside its own scroll box (up to 70vh). The header row and the path column stay in view while scrolling. Below 600px cells keep paths and values on one line and the box scrolls sideways instead of splitting them mid-word.
- **Fixed heights** keep cards aligned: editor and tree view 280px, Scegli pickers up to 260px. Each scrolls internally.
- **Rhythm:** gaps of 4, 6, 8 and 12px inside components, and 12 to 16px between major blocks. Density is deliberate: users are engineers comparing large configs.

## Elevation & Depth

The system is flat. There are no `box-shadow` elevations. Depth comes from tonal layering on three levels: the **Canvas** page holds **Bench Gray** panels (options bar, file cards), which hold **Paper** working surfaces (editor, tree, pickers, inputs, buttons). Anything that sits straight on the canvas carries its own fill (the add-file button, the list and the notice are Paper; the waiting box, the status line and the equal banner are Bench Gray), because Slate Muted and Signal Blue text need it for 4.5:1. Each layer is outlined with a 1px Hairline border. State is shown with color and outlines, never with lift: Signal Blue borders and outlines, a 2px dashed drop outline, the wash under editor lines. Inset `box-shadow` appears only as a stroke (the selected node's frame, the line above removed lines), never as a shadow.

### Named Rules
**The Flat Ledger Rule.** Surfaces never cast shadows. If something needs emphasis, change its border, tint or outline, not its elevation.

## Shapes

Corners are gently rounded on a small, consistent scale: **4px** for working surfaces and small controls (editor, tree view, text inputs, small buttons, chips, theme-switch segments), **6px** for icon buttons, the add-file button, the Scegli pickers, the notice, the status line, the matrix actions bar, the theme-switch track and tab tops, and **8px** for top-level containers (options bar, file cards, diff list, the "equal" banner and the waiting box). The only fully round shape is the **file-name pill** (999px, Paper fill, Hairline border, 600 weight), which makes the loaded file's name the friendliest object on the card. Borders are 1px Hairline everywhere; dashed borders mean "slot for more" (add file) or "nothing yet" (waiting box). The 4px left bar is the ledger's single heavy stroke.

## Components

### Buttons
Compact, bordered and quiet. They become emphatic only on hover.
- **Shape:** gently rounded (4px small buttons, 6px icon buttons).
- **Small button** (apply `A → B` / `B → A`, matrix actions, tree tools, Scegli, Carica / Salva configurazione, status actions; one shared rule): Paper fill, Ink text, Hairline border, 2px × 8px padding, label size. Hover eases the border to Signal Blue (120ms). Disabled drops to 40% opacity with a not-allowed cursor, and the tooltip explains why.
- **Icon button** (download, trash): 28px square, Paper fill, a 16px Lucide stroke icon (2px stroke), an `aria-label` and a tooltip. Hover eases the border and icon to Signal Blue (120ms); the trash button turns Alarm Red instead.
- **Add file:** Paper fill, 1px dashed Slate Muted border, Signal Blue text "+ Aggiungi file", 6px radius. Its dashed outline means "slot for more".
- **Focus:** every control shares one ring, a 2px Signal Blue outline 2px outside it; rows and cells that frame themselves draw it inset instead.

### Chips
- **Diff summary chip:** count plus kind label ("3 aggiunte"), tinted with that kind's ledger pair (tint fill, 4px bar), 4px radius, label size.
- **Matrix summary:** one group per non-base file, its short name in 600 weight followed by the same kind chips as a pair comparison, so each file's differences read with the ledger colors. A file equal to the base gets a single neutral "nessuna differenza" chip (Bench Gray fill, Hairline border, Slate Muted text, no bar).

### Cards / Containers
- **File card (panel):** Bench Gray, 1px Hairline, 8px radius, 8px padding. The **base** card swaps its border to Signal Blue, and a dragged file over it adds a 2px dashed Signal Blue outline. Its header holds the heading, an optional name field (borderless and transparent until hovered or focused, semibold; the user's label such as "prod" replaces "File B" / "B" in buttons, headers and messages), the file-name pill, the detected format, the base picker, an italic "modificato, non salvato" tag after an apply, and its actions (Apri file…, download, trash), grouped at the end so they never split across lines.
- **Options bar:** the same panel treatment, holding three borderless fieldsets whose legends are muted 600-weight labels. Controls flex-wrap inside each group (6px × 16px gap). The scope message takes a full row inside Ambito in muted text, or Alarm Red when it reports an error.
- **Notice:** Paper fill, 1px Alarm Red border and Alarm Red text, 6px radius. Used when an apply is refused; the file stays as it was.
- **Status line:** Bench Gray, 1px Hairline, 6px radius; reports the outcome of the last change and carries its way back (Annulla, Annulla tutto, Ripristina).
- **Arrivals:** the notice, the status line and the configuration message fade in over 180ms with a 3px drop (`cubic-bezier(0.16, 1, 0.3, 1)`) each time they report a new outcome; with reduced motion, only the fade.
- **Equal banner:** Bench Gray fill, 1px Hairline, 8px radius, 12px padding, 600 weight; a regular-weight second line states any partial scope (root, included and excluded subtrees, kinds turned off). Neutral on purpose: equivalence is an outcome, not a kind of difference.
- **Waiting box:** Bench Gray, 1px dashed Slate Muted border, 8px radius, muted text saying what to do next.

### Inputs / Fields
- **Text input** (Root, Includi, Escludi, array key field, configuration name): Paper fill, Hairline border, 4px radius, 4px × 6px padding (2px × 6px at label size for the configuration name). The caret is Signal Blue.
- **Scegli picker:** a Paper box (Hairline border, 6px radius, up to 260px, scrolling) under its field, holding a checkbox tree of the subtrees found in the loaded files. It unrolls from the top (`clip-path`, 200ms); with reduced motion it opens at once.
- **Editor:** read-only: it scrolls and its text can be selected for copying, but shows no caret and cannot be typed into; content arrives by opening, dropping or pasting a file, and changes only through apply. Line endings are held as LF and restored on save. A Bench Gray gutter with muted line numbers and +/− signs sits beside a transparent textarea over a backdrop that paints the lines. The current line is highlighted in Moved Mist and error lines in bold Alarm Red. The selected node is framed in the backdrop with a 2px Signal Blue stroke inside the kind bar, so it shows even when the textarea is not focused. 280px tall, monospace 13/1.5.
- **Disabled option:** 50% opacity with a not-allowed cursor; its tooltip says why.

### Navigation
- **Theme switch (Auto / Chiaro / Scuro):** a segmented control of native radios, top right of the header, in a Bench Gray track with a Hairline border (6px radius). The checked segment is Paper with Ink 600 text; the others are Slate Muted and turn Ink on hover. Auto follows `prefers-color-scheme`; Chiaro / Scuro pin `data-theme` on `<html>` and are remembered in localStorage (`ledger-theme`), applied by an inline script before the first paint.
- **Tabs (Testo / Albero):** small top-rounded (6px) tabs. Inactive tabs are Bench Gray with muted text. The selected tab (`aria-selected`) is Paper with Ink text in 600 weight, so it reads as sitting on the surface below it. ←/→ move between them.

### Diff List (signature)
The ledger itself: a bordered Paper list (8px radius) with Hairline dividers. Each row is a kind-tinted entry with a 4px kind bar and four columns: kind, path (mono, wraps anywhere), description, apply buttons. The selected row gets a 2px inset Signal Blue outline. Clicking a row (or moving to it with the keyboard) selects the node in every editor. The list is one tab stop: only the current row and its apply buttons are in the tab order; ↑/↓ or j/k move, `a` / `b` press the row's first / second apply button.

### Editor Difference Lines and the Wash (signature)
Each editor paints its own differing lines behind the text with the ledger pair of that kind: the tint as line background, the bar as a 4px left stroke (dashed for whitespace). The base editor shows every difference it has with any file; each other editor shows its differences with the base. A current difference outranks the Applied Gray of an applied change.

The **wash** is a Signal Blue layer under the text of a group of lines, held for the first quarter of its time and then dried away. Where a selection lands it is light and short (peak 22%, 600ms), so the eye finds the node after the jump. Where an apply has just written it is stronger and longer (peak 32%, 1200ms) and dries into Applied Gray, so the change visibly settles into the file; those lines drop their resolved difference mark at once. The lines are rebuilt on every recomputation, so a wash in progress resumes where it was (negative `animation-delay`) rather than restarting or cutting off. It stays under reduced motion: it is a fade in place that says where to look.

### Comparison Matrix (signature)
A collapsed monospace table with one row per differing path and one column per file. Cells use the kind ledger colors relative to the base. Cells that differ only through an ancestor keep full contrast and get a dashed bar and italics. The selected cell gets a 2px inset Signal Blue outline. An actions bar above the table shows the selected path in mono and the apply buttons for the selected cell.

### Tree
A monospace tree (13/1.6) with 16px indent, a muted toggle whose chevron rotates (120ms, instant with reduced motion) and selectable keys (Signal Blue underline on hover). Values stay outside the ledger and the accent: strings in Ink; numbers, booleans and null in Slate Muted; badges and notes muted (notes in italic, such as "solo in A"). In a Scegli picker each node carries a checkbox; the descendants of a checked node show as checked and disabled. Each box is named for its field and path ("Includi $.db", "Escludi $.db"), and an implied box explains itself ("Incluso / Escluso tramite un nodo superiore"). While a path is invalid the picker says to fix Root, Includi or Escludi instead of showing a tree. It is an ARIA tree with one tab stop: ↑/↓ move, →/← open/close or go to child/parent, Enter selects, Space checks. A focused node rings its own row (2px Signal Blue, 4px radius), not its subtree.

### Browser Surfaces
Text selection uses Moved Mist under Ink, scrollbars a Hairline thumb on a transparent track, and the caret Signal Blue (hidden in the read-only editors).

## Do's and Don'ts

### Do:
- **Do** show every difference as a tint plus a 4px left bar in that kind's ledger pair, in every view (chip, row, line, cell).
- **Do** use Signal Blue as the only signal for selection, focus, hover, the base file and the wash.
- **Do** set keys, values, paths and file content in system monospace at 13px.
- **Do** keep surfaces flat: Bench Gray panels holding Paper working surfaces on the Canvas, outlined with 1px Hairline borders.
- **Do** give icon-only buttons an `aria-label` and a tooltip, and disabled controls a tooltip that says why.
- **Do** define every new color as a CSS custom property with a dark-theme value in both dark blocks: the `prefers-color-scheme: dark` one (for Auto) and `:root[data-theme='dark']` (for Scuro).
- **Do** keep motion to the wash, arrivals and unrolling pickers, with a `prefers-reduced-motion` path for each.

### Don't:
- **Don't** use the ledger kind colors for generic success, warning or danger states in chrome.
- **Don't** add drop shadows or elevation. Emphasize with borders, tints and outlines.
- **Don't** introduce a second accent color or a web font. The system font stack is the identity.
- **Don't** set data (paths, keys, values) in the sans or as prose.
- **Don't** use full-saturation fills for differences. Tints carry the area and bars carry the signal.
- **Don't** animate the recomputed result, layout changes or the page load.
