import ELKModule from 'elkjs/lib/elk.bundled.js';
import type { SceneState } from './types.js';

// elkjs ships CJS; default import shape differs between bundlers and Node.
const ELK = ((ELKModule as unknown as { default?: unknown }).default ?? ELKModule) as new () => {
  layout(g: ElkNode): Promise<ElkNode>;
};

interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkNode[];
  edges?: { id: string; sources: string[]; targets: string[] }[];
  layoutOptions?: Record<string, string>;
}

/** Pixels per grid unit inside ELK. One grid unit ≈ one node footprint in the 3D scene. */
const UNIT = 100;
const SIZE = { s: 0.6, m: 0.8, l: 1.1 } as const;

/**
 * One layered layout over the union of every node and link that appears anywhere in the deck,
 * so a node never jumps between steps. `at` (persisted in the node spec) overrides per step.
 * Returns, for every state, positions in grid units for the nodes visible in that state.
 */
export async function layoutDeck(states: SceneState[]): Promise<Record<string, [number, number]>[]> {
  if (!states.length) return [];

  const nodes = new Map<string, { zone?: string; w: number }>();
  const edges = new Map<string, [string, string]>();
  for (const s of states) {
    for (const [id, n] of Object.entries(s.nodes)) {
      if (n.at) continue;
      nodes.set(id, { zone: n.zone, w: SIZE[n.size] + (n.count > 1 ? 0.25 * Math.min(n.count - 1, 3) : 0) });
    }
    for (const [id, l] of Object.entries(s.links)) edges.set(id, [l.from, l.to]);
  }
  const direction = states[states.length - 1].direction === 'down' ? 'DOWN' : 'RIGHT';

  // ELK does not inherit options into compound (zone) nodes, so both get the same spacing set.
  const spacing = {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.spacing.nodeNode': String(UNIT * 0.9),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(UNIT * 1.0),
    'elk.spacing.componentComponent': String(UNIT * 1.0),
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  };
  const zoneOf = new Map<string, ElkNode>();
  const root: ElkNode = {
    id: '__root',
    layoutOptions: {
      ...spacing,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.padding': '[top=0,left=0,bottom=0,right=0]',
    },
    children: [],
    edges: [],
  };
  for (const [id, n] of nodes) {
    const leaf: ElkNode = { id, width: n.w * UNIT, height: n.w * UNIT };
    if (n.zone) {
      let z = zoneOf.get(n.zone);
      if (!z) {
        z = { id: `__zone:${n.zone}`, children: [], layoutOptions: { ...spacing, 'elk.padding': `[top=${UNIT * 0.45},left=${UNIT * 0.45},bottom=${UNIT * 0.45},right=${UNIT * 0.45}]` } };
        zoneOf.set(n.zone, z);
        root.children!.push(z);
      }
      z.children!.push(leaf);
    } else root.children!.push(leaf);
  }
  for (const [id, [a, b]] of edges) {
    if (nodes.has(a) && nodes.has(b) && a !== b) root.edges!.push({ id: `e:${id}`, sources: [a], targets: [b] });
  }

  const abs = new Map<string, [number, number]>();
  if (nodes.size) {
    const out = await new ELK().layout(root);
    const walk = (n: ElkNode, ox: number, oy: number) => {
      for (const c of n.children ?? []) {
        const x = ox + (c.x ?? 0);
        const y = oy + (c.y ?? 0);
        if (c.id.startsWith('__zone:')) walk(c, x, y);
        else abs.set(c.id, [(x + (c.width ?? 0) / 2) / UNIT, (y + (c.height ?? 0) / 2) / UNIT]);
      }
    };
    walk(out, 0, 0);
  }
  const round = (v: number) => Math.round(v * 100) / 100;

  return states.map((s) => {
    const pos: Record<string, [number, number]> = {};
    for (const [id, n] of Object.entries(s.nodes)) {
      const p = n.at ?? abs.get(id) ?? [0, 0];
      pos[id] = [round(p[0]), round(p[1])];
    }
    return pos;
  });
}
