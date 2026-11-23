import { describe, it, expect } from 'vitest';
import { parseDeck } from '../src/core/parse.js';

const deck = `---
title: Quy trình đơn hàng
subtitle: Từ đặt đến giao
accent: "#e2572b"
---

Giới thiệu ngắn.

# Vấn đề

## Khách đặt hàng | Đặt hàng
Đơn đi từ **web** vào Order.

\`\`\`scene
nodes:
  web: { shape: device }
\`\`\`

> [!tip] Có idempotency key.
> Dòng hai.

\`\`\`changes
+ Order Service
~ Website gọi Order
- Cũ
\`\`\`

\`\`\`metrics
đơn/giờ: 1,200
lỗi: 0.2%
trạng thái: ổn
\`\`\`

???
Ghi chú người nói.

# Giải pháp

## Thanh toán
\`\`\`js
## not a heading
\`\`\`
`;

describe('parseDeck', () => {
  const { deck: d, diagnostics } = parseDeck(deck, 'deck.md');

  it('has no diagnostics', () => expect(diagnostics).toEqual([]));

  it('reads frontmatter with defaults', () => {
    expect(d.meta.title).toBe('Quy trình đơn hàng');
    expect(d.meta.subtitle).toBe('Từ đặt đến giao');
    expect(d.meta.accent).toBe('#e2572b');
    expect(d.meta.theme).toBe('light');
  });

  it('creates a cover step from the preamble', () => {
    expect(d.steps[0].cover).toBe(true);
    expect(d.steps[0].title).toBe('Quy trình đơn hàng');
    expect(d.steps[0].bodyMd.trim()).toBe('Giới thiệu ngắn.');
  });

  it('splits steps on ## with short names and chapters', () => {
    expect(d.steps).toHaveLength(3);
    expect(d.steps[1]).toMatchObject({ title: 'Khách đặt hàng', short: 'Đặt hàng', chapter: 'Vấn đề', line: 11 });
    expect(d.steps[2]).toMatchObject({ title: 'Thanh toán', short: 'Thanh toán', chapter: 'Giải pháp' });
  });

  it('records the scene block and its first yaml line', () => {
    expect(d.steps[1].scene).toEqual({ yaml: 'nodes:\n  web: { shape: device }', line: 15 });
  });

  it('extracts callouts, changes, metrics, notes', () => {
    const s = d.steps[1];
    expect(s.callouts).toEqual([{ kind: 'tip', md: 'Có idempotency key.\nDòng hai.' }]);
    expect(s.changes).toEqual([
      { op: '+', text: 'Order Service' },
      { op: '~', text: 'Website gọi Order' },
      { op: '-', text: 'Cũ' },
    ]);
    expect(s.metrics[0]).toEqual({ name: 'đơn/giờ', value: '1,200', num: 1200, unit: '' });
    expect(s.metrics[1]).toEqual({ name: 'lỗi', value: '0.2%', num: 0.2, unit: '%' });
    expect(s.metrics[2]).toEqual({ name: 'trạng thái', value: 'ổn' });
    expect(s.notesMd.trim()).toBe('Ghi chú người nói.');
    expect(s.bodyMd.trim()).toBe('Đơn đi từ **web** vào Order.');
  });

  it('ignores headings inside code fences', () => {
    expect(d.steps[2].bodyMd).toContain('## not a heading');
  });

  it('reports bad frontmatter yaml with a line', () => {
    const r = parseDeck('---\ntitle: [oops\n---\n## A\n', 'x.md');
    expect(r.diagnostics[0]).toMatchObject({ file: 'x.md', severity: 'error' });
    expect(r.diagnostics[0].line).toBeGreaterThanOrEqual(2);
  });

  it('warns on a second scene block in one step', () => {
    const r = parseDeck('## A\n```scene\nnodes: {}\n```\n```scene\nnodes: {}\n```\n');
    expect(r.diagnostics[0]).toMatchObject({ line: 5, severity: 'error' });
  });

  it('works without frontmatter or steps', () => {
    const r = parseDeck('Chỉ có chữ.');
    expect(r.diagnostics).toEqual([]);
    expect(r.deck.steps).toHaveLength(1);
    expect(r.deck.meta.title).toBe('Untitled');
  });
});
