export type Severity = 'error' | 'warning';

export interface Diagnostic {
  file: string;
  line: number; // 1-based
  col: number; // 1-based
  message: string;
  severity: Severity;
}

export interface DeckMeta {
  title: string;
  subtitle?: string;
  author?: string;
  theme: 'light' | 'dark';
  accent: string;
  [key: string]: unknown;
}

export type CalloutKind = 'tip' | 'warn' | 'info';
export interface Callout {
  kind: CalloutKind;
  md: string;
}

export interface Change {
  op: '+' | '-' | '~';
  text: string;
}

export interface Metric {
  name: string;
  value: string;
  num?: number; // numeric part, for count-up animation
  unit?: string; // suffix after the number
}

export interface RawStep {
  title: string;
  short: string;
  chapter?: string;
  cover?: boolean;
  line: number; // line of the `##` heading (or 1 for cover)
  bodyMd: string;
  callouts: Callout[];
  changes: Change[];
  metrics: Metric[];
  notesMd: string;
  scene?: { yaml: string; line: number }; // line = deck line of first YAML line
}

export interface RawDeck {
  meta: DeckMeta;
  steps: RawStep[];
}

// ---------- scene ----------

export type NodeStatus = 'ok' | 'down' | 'hot' | 'muted';
export type NodeSize = 's' | 'm' | 'l';

export interface NodeSpec {
  shape: string;
  label?: string;
  sub?: string;
  icon?: string;
  color?: string;
  at?: [number, number];
  size: NodeSize;
  zone?: string;
  status: NodeStatus;
  count: number;
}

export interface LinkSpec {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed';
  dir: 'forward' | 'both' | 'none';
}

export interface ZoneSpec {
  label?: string;
  color?: string;
}

export type FlowKind = 'req' | 'data' | 'event' | 'fail' | 'ping';
export interface FlowSpec {
  path: string[];
  kind: FlowKind;
  count: number;
  label?: string;
}

export interface SceneState {
  direction: 'right' | 'down';
  nodes: Record<string, NodeSpec>;
  links: Record<string, LinkSpec>;
  zones: Record<string, ZoneSpec>;
  flows: FlowSpec[];
  focus: string[];
}

// ---------- compiled (sent to runtime) ----------

export interface CompiledStep {
  title: string;
  short: string;
  chapter?: string;
  cover?: boolean;
  bodyHtml: string;
  callouts: { kind: CalloutKind; html: string }[];
  changes: Change[];
  metrics: Metric[];
  notesHtml: string;
  scene: SceneState & { pos: Record<string, [number, number]> };
}

export interface CompiledDeck {
  meta: DeckMeta;
  steps: CompiledStep[];
  icons: Record<string, string>; // icon name -> svg markup
}
