# P00 — Lightweight CLI + agent skill: paste Ferroprint symbols into tldraw

> Source: options post "Ferroprint snippets into tldraw offline" (sideshow session), option C,
> refined by user comments: *"I like it — we can create lightweight cli and accompanying agent
> skill (instructions + scripts) so agent or user can invoke skill and let agent use it efficiently."*

Status: plan · Branch: `p00-lcli-shapes-library` · Effort: ~1–2 h CLI, +~0.5 d skill · Priority: P00

## Why

`tldraw-library` already holds 69 verified paste-snippets (`out/blobs.json`, ~230 KB and
`out/manifest.json`). Today each one is a manual find-and-copy from a README. This plan turns
insertion into a single command — usable by a human at a terminal and, via the accompanying skill,
by any agent without re-deriving the machinery each session.

## How it works for the user

1. tldraw Desktop is open (it usually is) with the board being drawn on.
2. In a terminal: `fp paste sofa` — the whole command. Add `--doc offload --x 420 --y 300` to pick
   a board and a spot; default is the focused window near the current viewport.
3. It prints `sofa → offload.tldraw (420, 300)` and the symbol is already on the canvas — real
   shapes, grouped editable label, saved (`helpers.saveDoc()`).

- Runs whether or not tldraw has focus — the user never leaves the keyboard.
- Batch mode: `fp paste plan --grid` lays out all seven plan symbols in a row;
  `fp paste server db firewall --stack horizontal --gap 40` composes.
- `fp list [category]` prints the vocabulary with ids and sizes.

**Agent view:** the skill teaches the agent the same verbs (`list`, `paste`, plus verify/save via
the existing `tq` helper), so "put a sofa there" in a session becomes two tool calls, not a
re-discovery of the agent API. The skill's scripts do the heavy lifting; the SKILL.md carries the
operating instructions (when the app is down, error recovery, avoid raw clipboard guessing).

**Needs:** tldraw Desktop running (agent API on :7236), a local doc with a file path.

## Task — implement

1. **Read inputs**: load `out/manifest.json` (category, name/id, default w/h) and
   `out/blobs.json` (native `TLContent` per symbol id). No rebuild needed; these are the verified
   artifacts of the last session.
2. **Agent-API helper**: reuse the pattern of `$HOME/skills/tldraw-offline/tq.mjs` — read
   `port`/`token` from `~/Library/Application Support/tldraw/server.json` every call (fresh-shell
   safe). Vendor a copy into `scripts/lib/tq.mjs` (repo-local, no external dependency).
3. **CLI** (`scripts/fp.mjs`, exposed via `package.json` bin `fp`):
   - `fp list [category] [--json]`
   - `fp paste <symbol...> [--doc <name>] [--x N --y N] [--grid|--stack h|v --gap N]`
   - resolution: doc by name via `api.getDocs()`; default = focused doc (error if none or remote/
     server-owned for saving); paste via `/api/doc/:id/exec` with
     `editor.putContentOntoCurrentPage(content, { x, y })`, then `await helpers.saveDoc()`.
   - errors: app not running → hint to start it; unknown symbol → closest names from manifest.
4. **Agent skill** at `skills/tldraw-ferroprint/`:
   - `SKILL.md`: when to use (filling tldraw boards with Ferroprint symbols), command cheatsheet,
     verification steps (screenshot via `api.getScreenshot` only when visual check needed;
     `helpers.getLints()` after connective edits), and recovery (stale server.json, window closed).
   - `scripts/`: the same `fp.mjs` + `tq.mjs` so the skill is self-contained; install note says to
     symlink into `~/.pi/agent/skills/` (matching the existing tldraw-offline skill pattern).
5. **Verification (acceptance criteria)**
   - `fp paste sofa` on a scratch doc → shapes exist and are saved; screenshot confirms render.
   - `fp paste plan --grid` places 7 symbols in a tidy row without overlaps.
   - Unknown name returns the 3 closest ids; missing app yields actionable error, exit code ≠ 0.
   - Agent run: fresh session reads SKILL.md and completes "add a bed and stairs to <doc>" with no
     additional human hints.
6. **Non-goals**: no daemon, no config files; MCP wrapping is P03 (thin layer over this).

Notes: keep zero runtime deps (node ≥ 20); LZ-string not needed here (blobs are already content).