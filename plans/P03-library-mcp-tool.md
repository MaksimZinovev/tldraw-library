# P03 — MCP tool: Ferroprint symbol placement for agent sessions

> Source: options post, option G. User comment: *"I like it. Create separate branch, Add in root
> folder plans/P03-library-mcp-tool.md; include this description from user perspective and the
> task description to implement it."*

Status: plan · Branch: `p03-library-mcp-tool` · Effort: ~0.5–1 d · Priority: P03 · Depends on: shares core with P00 (or standalone)

## Why

The CLI (P00) already lets an agent stamp symbols; wrapping the same core as MCP tools makes it
first-class: typed arguments, automatic discovery in every MCP client, clean errors instead of
shell quoting, and a manifest-driven vocabulary.

## How it works for the user

1. In a session with any MCP-capable agent, new tools appear:
   `ferroprint_list_symbols`, `ferroprint_get_symbol`, `ferroprint_place_symbol`,
   `ferroprint_place_symbols`.
2. The user says: *"put a server, a database and a firewall on the offload board"* — the agent
   calls `place_symbols` with names and a layout; shapes land as real tldraw shapes, positioned
   and saved.
3. Typos die politely: `sofaa` returns the closest names instead of failing silently.

- Same machinery as the CLI (agent API on :7236), wrapped as typed tools — no shell quoting,
  discoverable by every peer agent; the manifest doubles as the tool vocabulary.
- **Needs:** same as C (tldraw Desktop running, local docs) plus one-time MCP wiring with the
  user's `mcporter`/gateway setup. **Ideal for:** agent-driven diagram sessions — the user's
  current workflow.

## Task — implement

1. **Server** (`mcp/ferroprint-mcp.mjs`, node stdio MCP server, zero deps):
   - reads `port`/`token` from `~/Library/Application Support/tldraw/server.json` per call (same
     fresh-read discipline as `tq.mjs`);
   - loads `out/blobs.json` + `out/manifest.json` at startup.
2. **Tools**:
   - `list_symbols(category?)` → ids, names, sizes, categories;
   - `place_symbol(name, { doc?, x?, y? })` → pastes one symbol, saves, returns placed ids;
   - `place_symbols([{name, x, y}], { doc?, layout?: 'grid'|'stack-h'|'stack-v', gap? })` → batch;
   - `get_symbol(name)` → metadata + preview data-URL-sized SVG for agent-side sanity checks.
   - Error contract: unknown name → 3 closest suggestions; app down → actionable message.
3. **Registration**: document wiring for the user's MCP gateway (`mcporter`-style config) and a
   smoke test one-liner; keep the server standalone so any client can register it.
4. **Verification (acceptance criteria)**
   - From a real agent session: "add bed and stairs to <scratch doc>" completes with shapes present
     and archive saved — no bash calls needed by the agent.
   - Batch layout produces non-overlapping arrangements.
   - Server down / stale server.json → tools return the recovery hint (start app, relaunch doc).
5. **Non-goals**: no diagram layout intelligence (agent composes coordinates; can use
   `--grid/--stack` presets); no read tools beyond previews (the tldraw-offline skill already
   covers inspection).