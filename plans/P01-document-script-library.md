# P01 — Document-script library: alias-paste + in-canvas palette

> Source: options post + "Option E deep dive" sideshow post. User comment: *"I like it. Create
> separate branch, Add in root folder plans/P01-document-script-library.md; include this
> description from user perspective and the task description to implement it."*
>
> ⚠ Note: two user comments both requested "P01". Kept literal per instruction; if a single
> `plans/` queue is wanted at merge time, rename this file to `P02-document-script-library.md`.

Status: plan · Branch: `p01-document-script-library` · Effort: ~1 day · Priority: E-rank (the "real fix")

## Why

tldraw Desktop embeds **board scripts** (`script/main.js` + `script/config.js`) inside the
.tldraw archive; they re-run every open. A self-contained script can therefore make the symbol
library live *inside the file*: an alias-paste handler and a clickable palette, fully offline, no
server, nothing else running.

## How it works for the user

1. **Click the palette.** A small locked strip of symbol tiles sits in a corner of the board (or
   on its own "Library" page). Click *sofa* → the symbol appears right there, selected, ready to
   drag. Tiles never get selected themselves — they always insert.
2. **Paste an alias.** Copy the text `fp:sofa` from anywhere (a cheat-sheet note, another app),
   click the canvas, `Cmd+V` → the script intercepts it and expands it into the real symbol at the
   cursor. Plain `fp:` text is never left behind. Everything else pastes exactly as before.
3. **Composed with espanso (future option F).** Type `:fpsofa` — espanso pastes the alias and the
   script expands it. One action, zero apps touched.

- New docs start from the **Ferroprint starter template** (`Ferroprint-starter.tldraw`, script
  baked in); existing docs get the script injected once on demand.
- Send the file to someone and the palette travels with it (their app asks once to trust the
  script digest).
- The 69-symbol table is inlined (~230 KB from `out/blobs.json`) — no network, no server.

## Task — implement

1. **Spikes first (10 min each, gate the rest):**
   a. `editor.registerExternalContentHandler('text', …)` fires on Cmd+V of plain text in Desktop;
      confirm `defaultHandleExternalTextContent(editor, content)` keeps normal paste intact.
   b. Expand alias at paste point via `putContentOntoCurrentPage(content, { x, y })`.
   c. Locked tile (locked control) click → insert via the `clickable-card-or-button-ui` recipe;
      press-state writes need `editor.run(fn, { ignoreShapeLock: true })` (tracker #102).
2. **Bundle** (`scripts/emit-board-script.mjs`): reads `out/blobs.json` + manifest, emits a single
   self-contained `script/main.js` (~230 KB data + runtime):
   - alias table: `fp:<id>` → envelope; handler expansion at cursor/fallback center;
   - palette: grouped preview tiles per category, locked, fixed corner or optional own page;
   - **self-contained** — no sibling imports (tracker #107: such scripts never run on saved boards);
     bundle lz-string via esbuild, same as P00's zero-dep stance otherwise.
   - run-on-mount logic only in `main.js` (never `config.js`).
3. **Distribution**:
   - produce `Ferroprint-starter.tldraw` via `POST /api/docs/create` + `/script-workspace` + save
     (app running; scripted, repeatable);
   - document one-shot injection for existing docs (same API path) — and expose it as
     `fp script install <doc>` if P00 exists by then (nice-to-have).
4. **Verification (acceptance criteria)**
   - Paste `fp:sofa` → symbol at cursor; undo returns to pre-paste state; repeated aliases never
     stack text debris.
   - Paste a *full envelope* (from README) → unchanged behavior (regression guard).
   - Palette click inserts at viewport center, tiles stay locked across save/reopen.
   - Save → reopen → alias and palette still work (script re-runs); file size delta reported.
   - Works with zero network (offline Mac).
5. **Caveats to honor**: #107 self-contained, #102 locked writes, script digest trust is
   per-machine (first open on a new machine prompts once), every participant on a shared board
   runs the same script — palette is view-shared, insertion is a guarded write.

Notes: baked-image symbols (current blobs) are accepted for v1; replacing them with a true custom
shape type (ShapeUtil option H) is a separate future plan, not in scope here.