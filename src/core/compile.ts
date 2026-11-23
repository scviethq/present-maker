import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { parseDeck } from './parse.js';
import { resolveScenes } from './scene.js';
import { layoutDeck } from './layout.js';
import { findMathError, renderMarkdown } from './markdown.js';
import { iconNames, iconSvg } from './icons.js';
import type { CompiledDeck, Diagnostic, RawStep } from './types.js';

export interface CompileResult {
  compiled?: CompiledDeck;
  diagnostics: Diagnostic[];
  /** Local image paths referenced by the deck, relative to baseDir. */
  assets: string[];
}

const IMG_SRC = /<img\b[^>]*\bsrc="([^"]+)"/g;

export async function compileDeck(src: string, file = 'deck.md', opts: { baseDir?: string } = {}): Promise<CompileResult> {
  const { deck, diagnostics } = parseDeck(src, file);
  const icons = iconNames();
  const { states, diagnostics: sceneDiags } = resolveScenes(deck.steps, file, icons);
  diagnostics.push(...sceneDiags);

  // math + image checks (line = step heading; good enough to find it)
  const assets = new Set<string>();
  for (const step of deck.steps) {
    for (const text of [step.bodyMd, ...step.callouts.map((c) => c.md)]) {
      const mathErr = findMathError(text);
      if (mathErr) diagnostics.push({ file, line: step.line, col: 1, severity: 'error', message: `Công thức lỗi trong bước "${step.title}": ${mathErr}` });
    }
  }

  const rendered = deck.steps.map((s: RawStep) => ({
    bodyHtml: renderMarkdown(s.bodyMd),
    notesHtml: renderMarkdown(s.notesMd),
    callouts: s.callouts.map((c) => ({ kind: c.kind, html: renderMarkdown(c.md, { inline: !c.md.includes('\n\n') }) })),
  }));

  rendered.forEach((r, k) => {
    for (const m of r.bodyHtml.matchAll(IMG_SRC)) {
      const ref = m[1];
      if (/^(https?:|data:)/.test(ref)) continue;
      if (opts.baseDir && !existsSync(isAbsolute(ref) ? ref : resolve(opts.baseDir, ref))) {
        diagnostics.push({ file, line: deck.steps[k].line, col: 1, severity: 'error', message: `Không tìm thấy ảnh "${ref}".` });
      } else assets.add(ref);
    }
  });

  if (diagnostics.some((d) => d.severity === 'error')) return { diagnostics, assets: [...assets] };

  const pos = await layoutDeck(states);
  const used = new Set<string>();
  for (const s of states) for (const n of Object.values(s.nodes)) if (n.icon) used.add(n.icon);

  const compiled: CompiledDeck = {
    meta: deck.meta,
    icons: Object.fromEntries([...used].map((n) => [n, iconSvg(n)!])),
    steps: deck.steps.map((s, k) => ({
      title: s.title,
      short: s.short,
      chapter: s.chapter,
      cover: s.cover,
      bodyHtml: rendered[k].bodyHtml,
      notesHtml: rendered[k].notesHtml,
      callouts: rendered[k].callouts,
      changes: s.changes,
      metrics: s.metrics,
      scene: { ...states[k], pos: pos[k] },
    })),
  };
  return { compiled, diagnostics, assets: [...assets] };
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.file}:${d.line}:${d.col} — ${d.severity === 'error' ? 'lỗi' : 'cảnh báo'}: ${d.message}`;
}
