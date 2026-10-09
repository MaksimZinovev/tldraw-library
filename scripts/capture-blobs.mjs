#!/usr/bin/env node
// Phase B — capture native tldraw clipboard content for each symbol.
//
// Uses the running tldraw Desktop agent API (port/token from server.json):
//   1. create or reuse the staging doc in staging/
//   2. per symbol: createAsset(SVG data URL) + image shape [+ text shape for its label],
//      capture editor.getContentFromCurrentPage(ids), then delete shapes + asset
//   3. save the (now empty) staging doc
//
// Output: out/blobs.json  { "<cat>/<id>": TLContent }
// Run AFTER scripts/build.mjs (needs out/manifest.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_JSON = path.join(process.env.HOME || '', 'Library', 'Application Support', 'tldraw', 'server.json');
const CHUNK = 12;

const { port, token } = JSON.parse(fs.readFileSync(SERVER_JSON, 'utf8'));
const API = `http://localhost:${port}`;
const H = { 'content-type': 'text/plain', authorization: `Bearer ${token}` };

async function call(method, p, body) {
	const res = await fetch(`${API}${p}`, {
		method,
		headers: H,
		body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
		signal: AbortSignal.timeout(120000),
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}: ${text.slice(0, 300)}`);
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function exec(docId, code) {
	const r = await call('POST', `/api/doc/${docId}/exec`, code);
	if (r && r.success === false) throw new Error(`exec failed: ${JSON.stringify(r.error).slice(0, 500)}`);
	return r && r.result !== undefined ? r.result : r;
}

// Runs inside the tldraw renderer for one chunk of symbols (CHUNK_JSON is replaced).
// Each symbol: asset + image shape (+ label text), grouped, content captured, cleaned up.
function chunkCode() {
	return String.raw`const { createShapeId, toRichText } = await import('tldraw');
const syms = CHUNK_JSON;
const out = [];
for (const s of syms) {
  const tag = s.cat + '-' + s.id;
  try {
    const assetId = 'asset:fp-' + tag;
    try { editor.deleteAssets([assetId]); } catch (e) {}
    editor.createAssets([{ typeName: 'asset', id: assetId, type: 'image', props: { src: 'data:image/svg+xml;base64,' + s.b64, w: s.w, h: s.h, name: 'Ferroprint ' + s.name, isAnimated: false, mimeType: 'image/svg+xml' }, meta: {} }]);
    const imgId = createShapeId('fp-img-' + tag);
    editor.createShapes([{ id: imgId, type: 'image', x: 0, y: 0, props: { assetId, w: s.w, h: s.h } }]);
    let ids = [imgId], g = null;
    if (s.label) {
      const txtId = createShapeId('fp-txt-' + tag);
      editor.createShapes([{ id: txtId, type: 'text', x: 0, y: 0, props: { richText: toRichText(String(s.label).toUpperCase()) } }]);
      const tb = editor.getShapePageBounds(txtId);
      let tx, ty;
      if (s.below) { tx = s.w / 2 - tb.w / 2; ty = s.h + 8; }
      else if (s.anchor === 'start' && s.labelX != null) { tx = s.labelX; ty = (s.labelY != null ? s.labelY : s.h / 2) - tb.h / 2; }
      else { tx = s.w / 2 - tb.w / 2; ty = (s.labelY != null ? s.labelY : s.h / 2) - tb.h / 2; }
      editor.updateShapes([{ id: txtId, x: tx, y: ty }]);
      ids.push(txtId);
    }
    if (ids.length > 1) {
      try {
        editor.groupShapes(ids);
        const sel = editor.getSelectedShapeIds();
        if (sel.length === 1) g = sel[0];
      } catch (e) { /* grouping optional */ }
    }
    const content = editor.getContentFromCurrentPage(g ? [g] : ids);
    out.push({ id: s.id, cat: s.cat, grouped: !!g, content });
    if (g) editor.deleteShapes([g]); else editor.deleteShapes(ids);
    editor.deleteAssets([assetId]);
  } catch (err) {
    out.push({ id: s.id, cat: s.cat, error: String(err && err.message || err).slice(0, 300) });
  }
}
return out;
`;
}

async function main() {
	const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'manifest.json'), 'utf8'));
	console.log(`manifest: ${manifest.length} symbols`);

	// 1. staging doc (reuse if present)
	const slugName = 'staging-2';
	const found = await call('POST', '/api/search', {
		code: `return (await api.getDocs({ name: ${JSON.stringify(slugName)} })).map(d => ({ id: d.id, name: d.name, filePath: d.filePath }))`,
	});
	let doc = found && found.result && found.result[0];
	if (!doc) {
		fs.mkdirSync(path.join(ROOT, 'staging'), { recursive: true });
		const created = await call('POST', '/api/docs/create', { name: slugName, directory: path.join(ROOT, 'staging') });
		doc = (created && created.result) || created;
		if (!doc || !doc.id) throw new Error('staging doc create failed: ' + JSON.stringify(created).slice(0, 300));
	}
	console.log('staging doc:', doc.id);

	// 2. chunked capture
	const blobs = {};
	const errors = [];
	for (let i = 0; i < manifest.length; i += CHUNK) {
		const chunk = manifest.slice(i, i + CHUNK);
		const payload = chunk.map(s => {
			const svg = fs.readFileSync(path.join(ROOT, s.svg), 'utf8');
			return {
				id: s.id, cat: s.cat, name: s.name, w: s.width, h: s.height, b64: Buffer.from(svg).toString('base64'),
				label: s.label, below: !!s.below, anchor: s.labelPos ? s.labelPos.anchor : null,
				labelX: s.labelPos ? s.labelPos.cx : null, labelY: s.labelPos ? s.labelPos.cy : null,
			};
		});
		const code = chunkCode().replace('CHUNK_JSON', JSON.stringify(payload));
		const res = await exec(doc.id, code);
		if (!Array.isArray(res)) throw new Error('unexpected exec result: ' + JSON.stringify(res).slice(0, 400));
		for (const r of res) {
			if (r.error) errors.push({ cat: r.cat, id: r.id, error: r.error });
			else blobs[`${r.cat}/${r.id}`] = r.content;
		}
		console.log(`  chunk ${Math.floor(i / CHUNK)}: ${res.length} symbols (${errors.length} errors so far)`);
	}

	// 3. save staging (now empty) and write output
	await exec(doc.id, 'await helpers.saveDoc()');
	const outPath = path.join(ROOT, 'out', 'blobs.json');
	fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
	fs.writeFileSync(outPath, JSON.stringify(blobs, null, "\t"));
	const sizes = Object.values(blobs).map(b => b ? JSON.stringify(b).length : 0);
	console.log(`captured ${Object.keys(blobs).length}/${manifest.length} blobs -> ${outPath}; avg ${Math.round(sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1))} B, total ${sizes.reduce((a, b) => a + b, 0)} B`);
	for (const e of errors) console.error(`  ERROR ${e.cat}/${e.id}: ${e.error}`);
	if (errors.length) process.exitCode = 2;
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});