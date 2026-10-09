// Walks Ferroprint JSX stub elements and emits an SVG string.
// Ferroprint's makePen returns React elements with camelCase attrs (non-icon mode),
// which React maps to kebab-case SVG attributes at DOM level — we do that mapping here.

const KEBAB = {
	strokeWidth: 'stroke-width',
	strokeLinejoin: 'stroke-linejoin',
	strokeLinecap: 'stroke-linecap',
	strokeDasharray: 'stroke-dasharray',
	fillOpacity: 'fill-opacity',
	fillRule: 'fill-rule',
	textAnchor: 'text-anchor',
	dominantBaseline: 'dominant-baseline',
	fontFamily: 'font-family',
	fontWeight: 'font-weight',
	fontSize: 'font-size',
	letterSpacing: 'letter-spacing',
	vectorEffect: 'vector-effect',
	smartRounding: 'smart-rounding',
};

const SKIP = new Set(['key', 'children', 'style', 'ref']);

function attrsToString(props) {
	const out = [];
	for (const [k, v] of Object.entries(props)) {
		if (SKIP.has(k)) continue;
		if (v == null || v === false) continue;
		const name = KEBAB[k] || k;
		const val = typeof v === 'number' ? String(v) : String(v);
		out.push(`${name}="${val.replace(/"/g, '&quot;').replace(/&/g, '&amp;')}"`);
	}
	return out.join(' ');
}

// Depth-first walk; children strings become text content of a <text>.
function renderNodes(node, parts) {
	if (node == null || typeof node === 'boolean') return;
	if (Array.isArray(node)) {
		for (const n of node) renderNodes(n, parts);
		return;
	}
	if (typeof node === 'string' || typeof node === 'number') {
		parts.push(String(node));
		return;
	}
	if (typeof node === 'object' && node.t) {
		if (node.t === 'fragment') {
			renderNodes(node.p && node.p.children, parts);
			return;
		}
		const tag = node.t;
		const at = attrsToString(node.p || {});
		if (tag === 'text') {
			parts.push(`<text ${at}>${nodeText(node)}</text>`);
			return;
		}
		parts.push(`<${tag}${at ? ' ' + at : ''}>${renderChildren(node) || ''}</${tag}>`);
		return;
	}
	throw new Error(`serialize: unsupported node ${JSON.stringify(Object.keys(node || {}))}`);
}

function nodeText(node) {
	const kids = collectChildren(node);
	return kids
		.filter(k => typeof k === 'string' || typeof k === 'number')
		.map(String)
		.join('')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;');
}

function renderChildren(node) {
	const kids = collectChildren(node);
	const parts = [];
	for (const k of kids) renderNodes(k, parts);
	return parts.join('');
}

function collectChildren(node) {
	const c = node.p ? node.p.children : undefined;
	return c == null ? [] : Array.isArray(c) ? c : [c];
}

const HATCH_DEFS = (t) =>
	`<defs><pattern id="fp-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="4" y1="0" x2="4" y2="8" stroke="${t.hatch}" stroke-width="1.5"/></pattern></defs>`;

/**
 * Renders a Ferroprint symbol (element tree from its `draw(w, h, P)`) into a standalone SVG.
 * - `paper` fills are mapped to `paperColor` (default #ffffff) so bg parts blend on tldraw's canvas.
 * - viewBox is padded by `pad` px so edge strokes are not clipped.
 */
export function svgFor(elements, { w, h, pad = 4, theme }) {
	const parts = [];
	renderNodes(elements, parts);
	// `paper` fills take the theme paper color directly — callers pass a theme with the
	// paper they want on the tldraw canvas (default #ffffff).
	const inner = parts.join('');
	const usesHatch = inner.includes('url(#fp-hatch)');
	const { x, y, W, H } = { x: -pad, y: -pad, W: w + pad * 2, H: h + pad * 2 };
	return {
		width: W,
		height: H,
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x} ${y} ${W} ${H}">${usesHatch ? HATCH_DEFS(theme) : ''}${inner}</svg>`,
	};
}