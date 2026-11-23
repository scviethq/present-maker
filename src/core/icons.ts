import * as lucide from 'lucide';

type IconNode = [string, Record<string, string | number>][];

export function toKebab(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();
}

let cache: Map<string, IconNode> | undefined;
function catalog(): Map<string, IconNode> {
  if (cache) return cache;
  cache = new Map();
  const src = ((lucide as unknown as { icons?: Record<string, unknown> }).icons ?? lucide) as Record<string, unknown>;
  for (const [k, v] of Object.entries(src)) {
    if (/^[A-Z]/.test(k) && Array.isArray(v)) cache.set(toKebab(k), v as IconNode);
  }
  return cache;
}

export function iconNames(): Set<string> {
  return new Set(catalog().keys());
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Standalone SVG markup for a Lucide icon (stroke uses currentColor). */
export function iconSvg(name: string): string | undefined {
  const node = catalog().get(name);
  if (!node) return undefined;
  const body = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
