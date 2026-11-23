# present-maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLI that turns `deck.md` (Markdown + ```scene``` YAML diffs) into an isometric-3D step-through presentation website.

**Architecture:** One npm package. `src/core` (pure TS: parse → validate → resolve scene state per step → layout) runs in Node at build time and emits a `CompiledDeck` JSON. `src/runtime` is a Vite-built three.js app bundled into one self-contained HTML template; the CLI injects the JSON into it. Icons (Lucide) are resolved to SVG strings at build time so the runtime carries only the icons used.

**Tech Stack:** TypeScript, Node ≥ 20, Vite + vite-plugin-singlefile, three.js (+ CSS2DRenderer), markdown-it, yaml, zod, elkjs, KaTeX, lucide, vitest, Playwright (visual check).

**Spec:** `docs/superpowers/specs/2026-11-19-present-maker-design.md`

**Deviation from spec §9:** single package with `src/core|runtime|cli` instead of a 3-package monorepo — same boundaries, less tooling.

## Global Constraints

- Output must run offline: no CDN, fonts and icons embedded.
- Vietnamese text rendered as HTML overlay with an embedded Vietnamese-capable font (Be Vietnam Pro).
- `check` prints `file:line:col — message` and exits 1 on any error.
- Nodes/links/zones persist across steps; `flows` and `focus` are per-step only.
- Auto-layout is default; `at` overrides.
- Respect `prefers-reduced-motion`.

## Review Focus

1. YAML syntax error in one scene → `check` reports the deck line, `build` refuses; never a blank page.
2. Link/flow/focus/remove referencing an unknown id → error with deck line number.
3. Unknown `shape` or `icon` → error listing the closest valid names.
4. Deck with zero `##` steps or a step with no scene → still renders (cover + text-only steps keep the previous scene).
5. Long Vietnamese labels with diacritics → readable, not clipped at 1920×1080.

---

### Task 1: Scaffold + core types + parser

**Files:** `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/core/types.ts`, `src/core/parse.ts`, `test/parse.test.ts`

**Interfaces — Produces:**
- `parseDeck(src: string, file?: string): { deck: RawDeck; diagnostics: Diagnostic[] }`
- `Diagnostic { file; line; col; message; severity: 'error'|'warning' }`
- `RawDeck { meta: DeckMeta; steps: RawStep[] }`, `RawStep { title; short; chapter?; line; bodyMd; callouts: Callout[]; changes: Change[]; metrics: Metric[]; notesMd; scene?: { yaml: string; line: number } }`

Tests: frontmatter parsed; `## A | B` → title A, short B; `#` sets chapter on following steps; `> [!tip] x` → callout; `changes` lines `+/-/~`; `metrics` `k: v` with numeric detection; text after `???` → notes; scene block line recorded (1-based line of first YAML line); content before first `##` becomes cover.

### Task 2: Scene schema, validation, state resolution

**Files:** `src/core/scene.ts`, `src/core/shapes.ts` (shape name list), `test/scene.test.ts`

**Interfaces — Produces:**
- `SHAPES: readonly string[]` (spec §6.2 list)
- `resolveScenes(steps: RawStep[], file, iconExists: (n)=>boolean): { states: SceneState[]; diagnostics }`
- `SceneState { nodes: Record<id, NodeSpec>; links: Record<id, LinkSpec>; zones: Record<id, ZoneSpec>; flows: FlowSpec[]; focus: string[]; direction }`

Tests: persistence across steps; redeclare merges; `remove` node also removes its links; flows/focus reset next step; shorthand `a-b`, `a>b>c`; unknown id in link/flow/focus → error at correct deck line; unknown shape → error with suggestion; YAML syntax error → error line offset by block start.

### Task 3: Layout

**Files:** `src/core/layout.ts`, `test/layout.test.ts`

**Interfaces — Produces:** `layoutDeck(states: SceneState[]): Promise<Record<id,[x,y]>[]>` — one ELK layered layout over the union of all nodes/links (grouped by zone, direction from first scene); per-step `at` overrides. Positions in grid units (1 unit ≈ one node footprint).

Tests: node keeps the same position in every step it appears; `at` wins; zone members are contiguous (bounding boxes of two zones do not overlap).

### Task 4: Compile + CLI (check/build/init/dev)

**Files:** `src/core/compile.ts`, `src/core/markdown.ts`, `src/core/icons.ts`, `src/cli/index.ts`, `test/compile.test.ts`

**Interfaces — Produces:** `compileDeck(src, file): Promise<{ compiled?: CompiledDeck; diagnostics }>`; `CompiledDeck { meta; steps: CompiledStep[]; icons: Record<name, svg> }` where `CompiledStep` = RawStep with `bodyHtml`, `notesHtml`, `calloutHtml`, `scene: SceneState & { pos }`. CLI: `present-maker check|build|dev|init`. Build injects `<script id="deck" type="application/json">` into `dist-runtime/index.html`; images: copied (default) or inlined (`--single`).

Tests: compile example decks with zero errors; KaTeX `$$` renders; unknown icon → error.

### Task 5: Runtime renderer

**Files:** `src/runtime/index.html`, `main.ts`, `ui.ts`, `stage.ts`, `shapes3d.ts`, `flows.ts`, `style.css`, `vite.config.ts`

Behaviour per spec §6: split layout, step bar, keys (←/→/Space/Home/End/F/P/N/T), hash routing, ortho iso camera auto-fit, grow/sink/slide transitions, packets on links, focus dimming, status colors, zones as plates, icons as top-face textures, notes window via BroadcastChannel, reduced motion.

Verify: Playwright screenshots of the 3 examples at 1920×1080 and 390×844; no console errors.

### Task 6: Skill + examples + README

**Files:** `skill/present-maker/SKILL.md`, `reference/{format,shapes,storytelling,from-uml}.md`, `examples/{business-approval,erp-sync,science-photosynthesis}.deck.md`, `README.md`

Verify: `present-maker check` passes on all examples; build opens offline.
