// Minimal JSX runtime stub — esbuild `jsx: 'automatic'` imports from here.
// Elements are plain { t, p } objects (tag + props, children under props.children).
export const Fragment = 'fragment';
export function jsx(type, props) {
	return { t: type, p: props || {} };
}
export const jsxs = jsx;
export const FragmentExport = Fragment;