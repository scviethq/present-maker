import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDeck } from '../src/core/compile.js';
import { iconSvg, toKebab } from '../src/core/icons.js';

describe('icons', () => {
  it('converts lucide export names', () => {
    expect(toKebab('CreditCard')).toBe('credit-card');
    expect(toKebab('Building2')).toBe('building-2');
    expect(toKebab('AArrowDown')).toBe('a-arrow-down');
  });
  it('renders svg', () => expect(iconSvg('credit-card')).toMatch(/^<svg[\s\S]*<rect /));
});

describe('compileDeck', () => {
  it('renders markdown, math, callouts and only used icons', async () => {
    const r = await compileDeck(
      '## A\nNăng lượng $E = mc^2$ và\n\n$$\\frac{a_1}{b}$$\n\n> [!tip] **đậm**\n\n```scene\nnodes:\n  x: { icon: globe }\n```\n',
      'd.md',
    );
    expect(r.diagnostics).toEqual([]);
    const s = r.compiled!.steps[1];
    expect(s.bodyHtml).toContain('class="katex"');
    expect(s.bodyHtml).toContain('katex-display');
    expect(s.bodyHtml).not.toContain('<em>');
    expect(s.callouts[0].html).toBe('<strong>đậm</strong>');
    expect(Object.keys(r.compiled!.icons)).toEqual(['globe']);
    expect(s.scene.pos.x).toEqual([expect.any(Number), expect.any(Number)]);
  });

  it('reports bad math and missing images', async () => {
    const r = await compileDeck('## A\n$$\\frac{a$$\n\n![x](nope.png)\n', 'd.md', { baseDir: '/tmp' });
    expect(r.compiled).toBeUndefined();
    expect(r.diagnostics.map((d) => d.message).join('\n')).toMatch(/Công thức lỗi[\s\S]*nope\.png/);
  });

  it('compiles every example deck without errors', async () => {
    const dir = join(__dirname, '..', 'examples');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const r = await compileDeck(readFileSync(join(dir, f), 'utf8'), f, { baseDir: dir });
      expect(r.diagnostics, f).toEqual([]);
    }
  });
});
