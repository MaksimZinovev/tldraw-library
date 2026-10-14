# P01 — Local browser picker page: copy-to-clipboard snippet chooser

> Source: options post, option D. User comment: *"I like it. Create separate branch, Add in root
> folder plans/P01-local-browser-picker-page.md; include this description from user perspective
> and the task description to implement it."*

Status: plan · Branch: `p01-local-browser-picker-page` · Effort: ~2–4 h · Priority: P01

## Why

The current flow sends the user to GitHub READMEs: find category → expand a copy/paste block →
copy → switch to tldraw → paste. A local static page keeps the exact same mental model — browse,
click, paste — but offline, instant, searchable, with real previews. No server, no build tooling
beyond what the repo already runs.

## How it works for the user

1. One-time: bookmark the local page (`npx serve ~/repos/tldraw-library/out/picker`), or let a
   tiny `fp pick` command start it and open the browser.
2. The page shows a grid of all 69 symbols — five category tabs (Plan, Furniture, System, Flow,
   Interface) and a search box. Tiles render the real SVG line art, hover shows the name.
3. Click *sofa* → toast "copied sofa".
4. Switch to tldraw, press `Cmd+V`. The symbol lands at the cursor as real shapes (image + grouped
   editable label) — the verified native envelope, unchanged.

- Identical feel to today's GitHub flow, but offline, instant, searchable, with previews.
- Works for tldraw.com in a browser too — the envelope is native `application/tldraw` content.

**Needs:** a browser tab open alongside tldraw; clipboard handoff. One symbol at a time.

## Task — implement

1. **Emitter** (`scripts/emit-picker.mjs`, wired into `npm run all`): reads `out/manifest.json`
   and `out/blobs.json`, writes `out/picker/index.html` + `out/picker/app.js` + `data.js`
   (inlined manifest + envelopes as JS data — fully offline, no fetch).
2. **Page**: category tabs, search filter (name + category), tile hover state, click →
   `navigator.clipboard.writeText(envelope)` + toast. Keep the tile payload as the exact
   fenced-block HTML from the READMEs (`<meta …><div data-tldraw="">…`), so behavior matches what
   the user already verified.
3. **Serve helper**: optional `fp pick` subcommand in the P00 CLI (this plan may add a standalone
   `scripts/serve-picker.mjs` so it ships independently of P00).
4. **Fallback**: also render each category README page link (existing `library/*/README.md`) —
   the page is an upgrade, not a replacement.
5. **Verification (acceptance criteria)**
   - `python3 -m http.server` on `out/picker` → click a tile → paste into tldraw Desktop renders
     the symbol (same as manual README flow).
   - Page works fully offline (no external requests; data inlined; zero CSP surprises).
   - All 69 symbols visible, searchable by alias and category; keyboard: arrows move selection,
     Enter copies.

Notes: clipboard API needs a secure context — `localhost` qualifies; document that in README.