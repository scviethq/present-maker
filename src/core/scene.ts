import { isMap, isScalar, LineCounter, parseDocument, type Node as YNode } from 'yaml';
import { SHAPES, suggest } from './shapes.js';
import type {
  Diagnostic, FlowKind, FlowSpec, LinkSpec, NodeSpec, NodeStatus, RawStep, SceneState, ZoneSpec,
} from './types.js';

const TOP_KEYS = ['layout', 'direction', 'nodes', 'zones', 'links', 'flows', 'remove', 'focus'];
const NODE_KEYS = ['shape', 'label', 'sub', 'icon', 'color', 'at', 'size', 'zone', 'status', 'count'];
const LINK_KEYS = ['from', 'to', 'label', 'style', 'dir'];
const FLOW_KEYS = ['path', 'kind', 'count', 'label'];
const STATUSES: NodeStatus[] = ['ok', 'down', 'hot', 'muted'];
const FLOW_KINDS: FlowKind[] = ['req', 'data', 'event', 'fail', 'ping'];

export function emptyScene(): SceneState {
  return { direction: 'right', nodes: {}, links: {}, zones: {}, flows: [], focus: [] };
}

function clone(s: SceneState): SceneState {
  return structuredClone({ ...s, flows: [], focus: [] });
}

type Path = (string | number)[];

/** Resolve the full scene state for every step. states[i] belongs to steps[i]. */
export function resolveScenes(
  steps: RawStep[],
  file: string,
  iconNames: Set<string>,
): { states: SceneState[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const states: SceneState[] = [];
  let prev = emptyScene();

  for (const step of steps) {
    const state = clone(prev);
    if (step.scene) applyScene(state, step.scene.yaml, step.scene.line, file, iconNames, diagnostics);
    states.push(state);
    prev = state;
  }
  return { states, diagnostics };
}

function applyScene(
  state: SceneState, yaml: string, baseLine: number, file: string, iconNames: Set<string>, out: Diagnostic[],
) {
  const lc = new LineCounter();
  const doc = parseDocument(yaml, { lineCounter: lc, prettyErrors: false });

  const at = (offset: number | undefined) => {
    const p = lc.linePos(offset ?? 0);
    return { line: baseLine + p.line - 1, col: p.col };
  };
  const err = (where: { line: number; col: number }, message: string) =>
    out.push({ file, ...where, message, severity: 'error' });
  const lineOf = (path: Path, key = false): { line: number; col: number } => {
    // walk up until a node with a range is found
    for (let n = path.length; n >= 0; n--) {
      const sub = path.slice(0, n);
      if (key && n === path.length && n > 0) {
        const parent = sub.length > 1 ? doc.getIn(sub.slice(0, -1), true) : doc.contents;
        if (isMap(parent)) {
          const pair = parent.items.find((p) => isScalar(p.key) && p.key.value === sub[sub.length - 1]);
          const r = (pair?.key as YNode | undefined)?.range;
          if (r) return at(r[0]);
        }
        continue;
      }
      const node = (n === 0 ? doc.contents : doc.getIn(sub, true)) as YNode | null;
      if (node?.range) return at(node.range[0]);
    }
    return { line: baseLine, col: 1 };
  };

  if (doc.errors.length) {
    for (const e of doc.errors) err(at(e.pos[0]), `YAML lỗi trong scene: ${e.message.split('\n')[0]}`);
    return;
  }
  const data = doc.toJS() as Record<string, unknown> | null;
  if (data == null) return;
  if (typeof data !== 'object' || Array.isArray(data)) return err(lineOf([]), 'Khối scene phải là một map (key: value).');

  for (const k of Object.keys(data)) {
    if (!TOP_KEYS.includes(k)) {
      const s = suggest(k, TOP_KEYS);
      err(lineOf([k], true), `Key "${k}" không hợp lệ trong scene.${s.length ? ` Ý bạn là: ${s.join(', ')}?` : ''} Hợp lệ: ${TOP_KEYS.join(', ')}.`);
    }
  }

  if (data.direction !== undefined) {
    if (data.direction === 'right' || data.direction === 'down') state.direction = data.direction;
    else err(lineOf(['direction']), `direction phải là "right" hoặc "down".`);
  }

  // ---- zones
  const zones = data.zones as Record<string, unknown> | undefined;
  if (zones !== undefined) {
    if (!isPlainObject(zones)) err(lineOf(['zones']), 'zones phải là map id → { label, color }.');
    else for (const [id, z] of Object.entries(zones)) {
      const v = (z ?? {}) as Record<string, unknown>;
      if (!isPlainObject(v)) { err(lineOf(['zones', id]), `Zone "${id}" phải là map.`); continue; }
      const zone: ZoneSpec = { ...(state.zones[id] ?? {}) };
      if (v.label !== undefined) zone.label = String(v.label);
      if (v.color !== undefined) zone.color = String(v.color);
      state.zones[id] = zone;
    }
  }

  // ---- nodes
  const nodes = data.nodes as Record<string, unknown> | undefined;
  if (nodes !== undefined) {
    if (!isPlainObject(nodes)) err(lineOf(['nodes']), 'nodes phải là map id → { shape, label, ... }.');
    else for (const [id, raw] of Object.entries(nodes)) {
      const v = (raw ?? {}) as Record<string, unknown>;
      const p = (f?: string): Path => (f ? ['nodes', id, f] : ['nodes', id]);
      if (!isPlainObject(v)) { err(lineOf(p()), `Node "${id}" phải là map, vd: { shape: server, label: "..." }.`); continue; }
      const n: NodeSpec = state.nodes[id]
        ? { ...state.nodes[id] }
        : { shape: 'box', size: 'm', status: 'ok', count: 1 };
      for (const k of Object.keys(v)) {
        if (!NODE_KEYS.includes(k)) err(lineOf(p(k), true), `Node "${id}": thuộc tính "${k}" không hợp lệ. Hợp lệ: ${NODE_KEYS.join(', ')}.`);
      }
      if (v.shape !== undefined) {
        const s = String(v.shape);
        if ((SHAPES as readonly string[]).includes(s)) n.shape = s;
        else {
          const sg = suggest(s, SHAPES);
          err(lineOf(p('shape')), `Shape "${s}" không tồn tại.${sg.length ? ` Ý bạn là: ${sg.join(', ')}?` : ''} Có: ${SHAPES.join(', ')}.`);
        }
      }
      if (v.label !== undefined) n.label = String(v.label);
      if (v.sub !== undefined) n.sub = String(v.sub);
      if (v.color !== undefined) n.color = String(v.color);
      if (v.icon !== undefined) {
        const ic = String(v.icon);
        if (iconNames.has(ic)) n.icon = ic;
        else {
          const sg = suggest(ic, iconNames);
          err(lineOf(p('icon')), `Icon "${ic}" không có trong Lucide.${sg.length ? ` Ý bạn là: ${sg.join(', ')}?` : ''} Tra cứu: https://lucide.dev/icons`);
        }
      }
      if (v.at !== undefined) {
        if (Array.isArray(v.at) && v.at.length === 2 && v.at.every((x) => typeof x === 'number')) n.at = [v.at[0], v.at[1]];
        else err(lineOf(p('at')), `Node "${id}": at phải là [x, y], vd: [2, 0].`);
      }
      if (v.size !== undefined) {
        if (v.size === 's' || v.size === 'm' || v.size === 'l') n.size = v.size;
        else err(lineOf(p('size')), `Node "${id}": size phải là s, m hoặc l.`);
      }
      if (v.status !== undefined) {
        if (STATUSES.includes(v.status as NodeStatus)) n.status = v.status as NodeStatus;
        else err(lineOf(p('status')), `Node "${id}": status "${v.status}" không hợp lệ. Có: ${STATUSES.join(', ')}.`);
      }
      if (v.count !== undefined) {
        if (Number.isInteger(v.count) && (v.count as number) >= 1 && (v.count as number) <= 9) n.count = v.count as number;
        else err(lineOf(p('count')), `Node "${id}": count phải là số nguyên 1–9.`);
      }
      if (v.zone !== undefined) {
        const z = String(v.zone);
        if (state.zones[z]) n.zone = z;
        else err(lineOf(p('zone')), `Node "${id}": zone "${z}" chưa được khai báo trong zones.`);
      }
      state.nodes[id] = n;
    }
  }

  // ---- remove (before links so a step can remove and re-add)
  const remove = data.remove;
  if (remove !== undefined) {
    if (!Array.isArray(remove)) err(lineOf(['remove']), 'remove phải là danh sách id node hoặc link.');
    else remove.forEach((r, idx) => {
      const id = String(r);
      if (state.nodes[id]) {
        delete state.nodes[id];
        for (const [lid, l] of Object.entries(state.links)) if (l.from === id || l.to === id) delete state.links[lid];
      } else if (state.links[id]) delete state.links[id];
      else if (state.zones[id]) {
        delete state.zones[id];
        for (const n of Object.values(state.nodes)) if (n.zone === id) delete n.zone;
      } else err(lineOf(['remove', idx]), `remove: không có node/link/zone nào tên "${id}".`);
    });
  }

  // ---- links
  const links = data.links;
  if (links !== undefined) {
    if (!Array.isArray(links)) err(lineOf(['links']), 'links phải là danh sách, vd: [a-b, { from: b, to: c }].');
    else links.forEach((raw, idx) => {
      const where = lineOf(['links', idx]);
      let spec: LinkSpec;
      if (typeof raw === 'string') {
        const pair = splitPair(raw, state);
        if (!pair) return err(where, `Link "${raw}": không tìm thấy hai node có sẵn nối bằng "-". Dạng đúng: from-to.`);
        spec = { from: pair[0], to: pair[1], style: 'solid', dir: 'forward' };
      } else if (isPlainObject(raw)) {
        const v = raw as Record<string, unknown>;
        for (const k of Object.keys(v)) if (!LINK_KEYS.includes(k)) err(where, `Link: thuộc tính "${k}" không hợp lệ. Hợp lệ: ${LINK_KEYS.join(', ')}.`);
        spec = { from: String(v.from ?? ''), to: String(v.to ?? ''), style: 'solid', dir: 'forward' };
        if (v.label !== undefined) spec.label = String(v.label);
        if (v.style !== undefined) {
          if (v.style === 'solid' || v.style === 'dashed') spec.style = v.style;
          else err(where, 'Link: style phải là solid hoặc dashed.');
        }
        if (v.dir !== undefined) {
          if (v.dir === 'forward' || v.dir === 'both' || v.dir === 'none') spec.dir = v.dir;
          else err(where, 'Link: dir phải là forward, both hoặc none.');
        }
        const missing = [spec.from, spec.to].filter((x) => !state.nodes[x]);
        if (missing.length) return err(where, `Link ${spec.from}-${spec.to}: node chưa khai báo: ${missing.map((m) => `"${m}"`).join(', ')}.`);
      } else return err(where, 'Link phải là chuỗi "a-b" hoặc map { from, to }.');
      state.links[`${spec.from}-${spec.to}`] = spec;
    });
  }

  // ---- flows
  const flows = data.flows;
  if (flows !== undefined) {
    if (!Array.isArray(flows)) err(lineOf(['flows']), 'flows phải là danh sách, vd: [a>b>c].');
    else flows.forEach((raw, idx) => {
      const where = lineOf(['flows', idx]);
      let f: FlowSpec;
      if (typeof raw === 'string') f = { path: splitPath(raw), kind: 'req', count: 1 };
      else if (isPlainObject(raw)) {
        const v = raw as Record<string, unknown>;
        for (const k of Object.keys(v)) if (!FLOW_KEYS.includes(k)) err(where, `Flow: thuộc tính "${k}" không hợp lệ. Hợp lệ: ${FLOW_KEYS.join(', ')}.`);
        f = { path: Array.isArray(v.path) ? v.path.map(String) : splitPath(String(v.path ?? '')), kind: 'req', count: 1 };
        if (v.kind !== undefined) {
          if (FLOW_KINDS.includes(v.kind as FlowKind)) f.kind = v.kind as FlowKind;
          else err(where, `Flow: kind "${v.kind}" không hợp lệ. Có: ${FLOW_KINDS.join(', ')}.`);
        }
        if (v.count !== undefined) {
          if (Number.isInteger(v.count) && (v.count as number) >= 1 && (v.count as number) <= 9) f.count = v.count as number;
          else err(where, 'Flow: count phải là số nguyên 1–9.');
        }
        if (v.label !== undefined) f.label = String(v.label);
      } else return err(where, 'Flow phải là chuỗi "a>b>c" hoặc map { path, kind }.');
      if (f.path.length < 2) return err(where, 'Flow cần ít nhất 2 node, vd: a>b.');
      const missing = f.path.filter((x) => !state.nodes[x]);
      if (missing.length) return err(where, `Flow ${f.path.join('>')}: node chưa khai báo: ${missing.map((m) => `"${m}"`).join(', ')}.`);
      state.flows.push(f);
    });
  }

  // ---- focus
  const focus = data.focus;
  if (focus !== undefined) {
    if (!Array.isArray(focus)) err(lineOf(['focus']), 'focus phải là danh sách id node.');
    else focus.forEach((r, idx) => {
      const id = String(r);
      if (state.nodes[id] || state.zones[id]) state.focus.push(id);
      else err(lineOf(['focus', idx]), `focus: node "${id}" chưa khai báo.`);
    });
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function splitPath(s: string): string[] {
  return s.split('>').map((x) => x.trim()).filter(Boolean);
}

/** "a-b" where ids may themselves contain "-": pick the split where both sides are known nodes. */
function splitPair(s: string, state: SceneState): [string, string] | null {
  const t = s.trim();
  for (let k = t.indexOf('-'); k > 0; k = t.indexOf('-', k + 1)) {
    const a = t.slice(0, k).trim();
    const b = t.slice(k + 1).trim();
    if (state.nodes[a] && state.nodes[b]) return [a, b];
  }
  return null;
}
