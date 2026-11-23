/** Shape names the renderer can draw (spec §6.2). Keep in sync with src/runtime/shapes3d.ts. */
export const SHAPES = [
  'box', 'server', 'database', 'queue', 'gateway', 'cloud', 'device', 'person', 'team',
  'document', 'decision', 'building', 'sphere', 'cylinder', 'cone', 'plate',
] as const;
export type ShapeName = (typeof SHAPES)[number];

export const PALETTE: Record<string, string> = {
  orange: '#e2572b', blue: '#3b6fd8', teal: '#1f9e8f', green: '#4f9d3a', yellow: '#e0a526',
  red: '#d64545', purple: '#7d5bd6', pink: '#d4589a', gray: '#8a8580', sand: '#d9c8a9', ink: '#3a3631',
};

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function suggest(name: string, options: Iterable<string>, max = 3): string[] {
  const scored: [number, string][] = [];
  for (const o of options) {
    const d = levenshtein(name, o) - (o.includes(name) || name.includes(o) ? 2 : 0);
    if (d <= Math.max(2, Math.floor(name.length / 3))) scored.push([d, o]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, max).map((s) => s[1]);
}
