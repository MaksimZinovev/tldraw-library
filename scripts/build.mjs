#!/usr/bin/env node
// Phase A — convert Ferroprint's 69 library symbols into standalone SVGs.
//
// Transpiles ../ferroprint/src/library.jsx with esbuild (JSX → our stub runtime),
// renders every symbol with the white ("blueprint ink on paper") theme at its
// natural size, and writes:
//   library/<category>/<symbol>.svg
//   out/manifest.json                                  (symbol metadata + label geometry)
//
// Source of truth: the ferroprint repo (default ../ferroprint, override with FERROPRINT_DIR).
// Upstream has no LICENSE yet (commit recorded in ORIGIN.md), so no upstream source is
// committed here — only generated output.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { svgFor } from './ferroprint-lib/serialize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FERRO = process.env.FERROPRINT_DIR || path.join(ROOT, '..', 'ferroprint');
const OUT = path.join(ROOT, 'out');
const LIB = path.join(ROOT, 'library');

// White theme (engine.js), paper remapped to #ffffff so paper-filled parts blend on tldraw.
const THEME = {
	ink: '#24398a',
	tint: 'rgba(36,57,138,0.07)',
	paper: '#ffffff',
	line: 'rgba(36,57,138,0.30)',
	hatch: 'rgba(36,57,138,0.38)',
};

async function loadLibrary(dir) {
	const stubDir = path.join(ROOT, 'scripts', 'jsx-stub');
	const res = await esbuild.build({
		entryPoints: [path.join(dir, 'src', 'library.jsx')],
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'neutral',
		mainFields: [],
		jsx: 'automatic',
		alias: { 'fpjsxstub/jsx-runtime': path.join(ROOT, 'scripts', 'jsx-stub', 'jsx-runtime.mjs') },
		jsxImportSource: 'fpjsxstub',
		loader: { '.jsx': 'jsx', '.js': 'js' },
		outdir: 'bundle',
	});
	const code = res.outputFiles[0].text;
	return { mod: await import('data:text/javascript;charset=utf-8;base64,' + Buffer.from(code).toString('base64')), bytes: code.length };
}

// Ferroprint pen: tile look (icon:false keeps sheet stroke weights) with wall cuts dropped.
function drawSymbol(sym, mod) {
	const P = mod.makePen(THEME, 'none', undefined, false);
	P.cutLine = () => null;
	P.cutRect = () => null;
	const els = sym.draw(sym.w, sym.h, P);
	return svgFor(els, { w: sym.w, h: sym.h, theme: THEME });
}

run().catch(err => {
	console.error(err);
	process.exit(1);
});
async function run() {
	if (!fs.existsSync(path.join(FERRO, 'src', 'library.jsx'))) {
		throw new Error(`ferroprint not at ${FERRO} — set FERROPRINT_DIR`);
	}
	const { mod, bytes } = await loadLibrary(FERRO);
	console.log(`bundled library.jsx (esm ${bytes} B) — symbol categories: ${mod.CATEGORIES.map(c => c.id).join(', ')}`);

	fs.mkdirSync(OUT, { recursive: true });
	const manifest = [];
	const failures = [];

	for (const cat of mod.CATEGORIES) {
		const catDir = path.join(LIB, cat.id);
		fs.mkdirSync(catDir, { recursive: true });
		for (const s of cat.items) {
			try {
				const { svg, width, height } = drawSymbol(s, mod);
				fs.writeFileSync(path.join(catDir, `${s.id}.svg`), svg);
				// Label geometry from the placement (AT.*) closure, in unpadded symbol-space.
				let labelPos = null;
				if (s.label && s.lab) {
					const p = s.lab(s.w, s.h);
					// center/plate: vertically centered at cy; below: top offset + 6 from bottom
					const fsPx = 16; // SIZES.m
					labelPos = {
						cx: p.dx + (p.anchor === 'start' ? 0 : (p.anchor === 'end' ? 0 : 0)) || p.dx,
						cy: p.cy != null ? p.cy : p.top != null ? p.top + fsPx / 2 : s.h / 2,
						anchor: p.anchor || 'middle',
					};
				}
				manifest.push({
					cat: cat.id,
					catName: cat.name,
					id: s.id,
					name: s.name,
					w: s.w,
					h: s.h,
					keys: s.keys || '',
					label: s.label || '',
					below: !!s.below || false,
					turn: !!s.turn || false,
					width, height,
					svg: `library/${cat.id}/${s.id}.svg`,
					labelPos,
				});
			} catch (err) {
				failures.push({ cat: cat.id, id: s.id, name: s.name, error: String(err && err.message || err) });
			}
		}
	}

	fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, "\t"));
	console.log(`converted ${manifest.length} symbols; failures: ${failures.length}`);
	for (const f of failures) console.error(`  FAIL ${f.cat}/${f.id}: ${f.error}`);
	if (failures.length) process.exitCode = 2;
}