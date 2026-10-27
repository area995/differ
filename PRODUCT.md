# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ops/DevOps engineers on an internal team. Typical situation: comparing configuration files (probe configs, deployment manifests, environment- or customer-specific YAML/JSON) across environments or customers, during deploys, migrations or troubleshooting. The job is to find out quickly what really differs between two or more config files, ignore what doesn't matter, and copy the right changes from one file to another.

## Product Purpose

Ledger (formerly KV Diff) is a semantic diff tool for key-value files (JSON and YAML) that runs in the browser. It compares the data model, not the text, so engineers see real differences (added or removed keys, changed values, type changes) without noise from formatting, key order or array order, unless they ask for it. Success means an engineer can tell at once whether two configs are equivalent, find each real difference, and fix it in place with confidence.

## Positioning

- Compares meaning, not lines. Mixed JSON vs YAML comparisons work, and loose typing (`8080` == `"8080"`) and order-insensitive arrays (optionally matched by a key field) are opt-in.
- Scoping: a **Root** path lines up a nested file with a flat one, and **Includi** limits the comparison to chosen subtrees.
- More than two files: a base-vs-many matrix shows every path that differs in any file.
- Safe apply: changes are copied `A → B` / `B → A` / `Base → tutti` by editing only the target node's text. The result is checked before it is applied, and the action is refused with a warning when it can't be done safely.
- Files never leave the browser.

## Operating Context

- Internal team tool, not a public product.
- Input: file picker, drag-and-drop or paste, one card per file (A, B, then C, D, …). The file text is read-only (scroll and select only, decided 2026-10-27): it changes only through apply actions, each undoable from the status line. Each card has **Testo** / **Albero** tabs.
- Diffs recompute automatically as the user types (300 ms debounce).
- Common neighbors in the workflow: text-diff tools, editors, Git, deploy pipelines. Ledger sits beside them to answer whether two configs mean the same thing.

## Capabilities and Constraints

- Static SPA: Vite + vanilla TypeScript, no framework. Vitest + jsdom for tests. A single parser (`yaml` by eemeli) for both formats.
- All computation runs on the client. No backend, no upload, no telemetry. Deployable to any static host, with relative paths in `dist/`.
- Formats: JSON and YAML (auto-detected per file, can be overridden).
- Difference categories: `added`, `removed`, `changed`, `type`, `whitespace`, `moved`. Each is toggled from the options bar.
- Path syntax (shared by the result list, Root and Includi): `$.a.b`, `[0]`, `["key.with.dots"]`, `[field=value]`.
- Language: the UI and docs are in Italian today. English or i18n support is a planned future need, so new UI text should be easy to extract (no Italian text built into logic or layout assumptions).
- Terminology in the UI: Base, File A/B/C…, Root, Includi, Scegli, riporto (applying a change), Differenze chiavi / valori, Spazi e tabulazioni, Posizione chiavi, Ignora ordine array, Tipi laschi.

## Brand Commitments

- Name: **Ledger** (renamed from KV Diff on 2026-10-27; the name echoes the "Change Ledger" design idea: every difference is an entry to locate and copy).
- Tagline in use: "Confronto semantico JSON / YAML. I file restano nel browser."
- Voice: plain, technical, terse Italian. Describes what the tool does and makes no marketing claims.

## Evidence on Hand

- Feature documentation: `README.md`, `docs/superpowers/specs/2026-10-26-kv-diff-design.md`, plans in `docs/superpowers/plans/`.
- Test suite in `tests/`.
- No user feedback, usage metrics or testimonials exist. Do not invent any.

## Product Principles

1. **Signal over noise.** Show only the differences the engineer asked for. Formatting and ordering differences stay hidden unless turned on.
2. **Trust before speed.** Edits to files are minimal, checked before they are applied, and reversible. Refusing an unsafe edit is better than corrupting a config.
3. **Local by default.** Config files may contain secrets. Nothing leaves the browser.
4. **Precise paths everywhere.** One path syntax links the result list, the editors, Root and Includi, so a difference can always be located, copied and scoped.
5. **Built for repeated expert use.** Dense, keyboard-friendly and predictable. Users are engineers who come back often, not first-time visitors.
