import { describe, it, expect } from 'vitest';
import { parseDeck } from '../src/core/parse.js';
import { resolveScenes } from '../src/core/scene.js';

const ICONS = new Set(['globe', 'credit-card', 'user']);

function run(md: string) {
  const { deck } = parseDeck(md, 'd.md');
  return resolveScenes(deck.steps, 'd.md', ICONS);
}

describe('resolveScenes', () => {
  const md = `## One
\`\`\`scene
direction: down
zones:
  inside: { label: Nội bộ }
nodes:
  user: { shape: person, label: Khách }
  web-app: { shape: device, icon: globe, zone: inside }
  order: { shape: server, label: Order }
links: [user-web-app, { from: web-app, to: order, label: REST, style: dashed }]
flows: [user>web-app>order, { path: order>web-app, kind: data, count: 2 }]
focus: [order]
\`\`\`

## Two
\`\`\`scene
nodes:
  order: { status: down }
\`\`\`

## Three
\`\`\`scene
remove: [web-app]
\`\`\`

## Four (no scene)
`;
  const { states, diagnostics } = run(md);

  it('has no errors', () => expect(diagnostics).toEqual([]));

  it('applies defaults and shorthand', () => {
    const s = states[1];
    expect(s.direction).toBe('down');
    expect(s.nodes.user).toEqual({ shape: 'person', label: 'Khách', size: 'm', status: 'ok', count: 1 });
    expect(s.links['user-web-app']).toEqual({ from: 'user', to: 'web-app', style: 'solid', dir: 'forward' });
    expect(s.links['web-app-order']).toMatchObject({ label: 'REST', style: 'dashed' });
    expect(s.flows).toEqual([
      { path: ['user', 'web-app', 'order'], kind: 'req', count: 1 },
      { path: ['order', 'web-app'], kind: 'data', count: 2 },
    ]);
    expect(s.focus).toEqual(['order']);
    expect(s.zones.inside).toEqual({ label: 'Nội bộ' });
  });

  it('cover step (no scene) is empty', () => {
    expect(Object.keys(states[0].nodes)).toEqual([]);
  });

  it('persists nodes, merges redeclared fields, resets flows/focus', () => {
    const s = states[2];
    expect(s.nodes.order).toMatchObject({ shape: 'server', label: 'Order', status: 'down' });
    expect(Object.keys(s.links)).toHaveLength(2);
    expect(s.flows).toEqual([]);
    expect(s.focus).toEqual([]);
    expect(s.direction).toBe('down');
  });

  it('remove drops the node and its links', () => {
    const s = states[3];
    expect(s.nodes['web-app']).toBeUndefined();
    expect(Object.keys(s.links)).toEqual([]);
  });

  it('a step without scene keeps the previous state', () => {
    expect(states[4].nodes).toEqual(states[3].nodes);
  });

  it('does not mutate earlier states', () => {
    expect(states[1].nodes.order.status).toBe('ok');
  });
});

describe('resolveScenes diagnostics', () => {
  it('maps yaml syntax errors to deck lines', () => {
    const { diagnostics } = run('## A\n```scene\nnodes:\n  a: { shape: box\n```\n');
    expect(diagnostics[0].line).toBeGreaterThanOrEqual(3);
    expect(diagnostics[0].line).toBeLessThanOrEqual(5);
    expect(diagnostics[0].severity).toBe('error');
  });

  it('reports unknown ids at the line where they are used', () => {
    const { diagnostics } = run('## A\n```scene\nnodes:\n  a: {}\nlinks:\n  - a-b\nflows: [a>zz]\nfocus: [q]\n```\n');
    const msgs = diagnostics.map((d) => `${d.line}:${d.message}`);
    expect(msgs.some((m) => m.startsWith('6:') && m.includes('a-b'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('7:') && m.includes('zz'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('8:') && m.includes('q'))).toBe(true);
  });

  it('suggests the closest shape and icon', () => {
    const { diagnostics } = run('## A\n```scene\nnodes:\n  a: { shape: databse, icon: credit-crd }\n```\n');
    expect(diagnostics.find((d) => d.message.includes('databse'))?.message).toContain('database');
    expect(diagnostics.find((d) => d.message.includes('credit-crd'))?.message).toContain('credit-card');
    expect(diagnostics.every((d) => d.line === 4)).toBe(true);
  });

  it('rejects unknown keys and bad enum values', () => {
    const { diagnostics } = run('## A\n```scene\nnode:\n  a: {}\nnodes:\n  b: { status: broken }\n```\n');
    expect(diagnostics.find((d) => d.message.includes('node'))?.line).toBe(3);
    expect(diagnostics.find((d) => d.message.includes('status'))?.line).toBe(6);
  });

  it('rejects an unknown zone', () => {
    const { diagnostics } = run('## A\n```scene\nnodes:\n  a: { zone: nope }\n```\n');
    expect(diagnostics[0].message).toContain('nope');
  });
});
