import { describe, it, expect } from 'vitest';
import { parseDeck } from '../src/core/parse.js';
import { resolveScenes } from '../src/core/scene.js';
import { layoutDeck } from '../src/core/layout.js';

const md = `## A
\`\`\`scene
zones:
  left: {}
  right: {}
nodes:
  a: { zone: left }
  b: { zone: left }
  c: { zone: right }
links: [a-b, b-c]
\`\`\`
## B
\`\`\`scene
nodes:
  d: { zone: right }
  pinned: { at: [10, 10] }
links: [c-d]
\`\`\`
`;

describe('layoutDeck', async () => {
  const { deck } = parseDeck(md);
  const { states } = resolveScenes(deck.steps, 'd.md', new Set());
  const pos = await layoutDeck(states);

  it('returns positions only for visible nodes', () => {
    expect(Object.keys(pos[0])).toEqual([]);
    expect(Object.keys(pos[1]).sort()).toEqual(['a', 'b', 'c']);
    expect(Object.keys(pos[2]).sort()).toEqual(['a', 'b', 'c', 'd', 'pinned']);
  });

  it('keeps each node at the same place in every step', () => {
    for (const id of ['a', 'b', 'c']) expect(pos[2][id]).toEqual(pos[1][id]);
  });

  it('lays out left to right along links', () => {
    expect(pos[1].a[0]).toBeLessThan(pos[1].b[0]);
    expect(pos[1].b[0]).toBeLessThan(pos[1].c[0]);
  });

  it('honours at', () => expect(pos[2].pinned).toEqual([10, 10]));

  it('keeps zone members apart from other zones', () => {
    const box = (ids: string[]) => ({
      x0: Math.min(...ids.map((i) => pos[2][i][0])), x1: Math.max(...ids.map((i) => pos[2][i][0])),
      y0: Math.min(...ids.map((i) => pos[2][i][1])), y1: Math.max(...ids.map((i) => pos[2][i][1])),
    });
    const L = box(['a', 'b']);
    const R = box(['c', 'd']);
    const overlap = L.x0 <= R.x1 && R.x0 <= L.x1 && L.y0 <= R.y1 && R.y0 <= L.y1;
    expect(overlap).toBe(false);
  });

  it('handles an empty deck', async () => {
    expect(await layoutDeck([])).toEqual([]);
  });
});
