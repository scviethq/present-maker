import { parse as parseYaml, YAMLParseError } from 'yaml';
import type { Callout, CalloutKind, Change, DeckMeta, Diagnostic, Metric, RawDeck, RawStep } from './types.js';

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)/;
const CALLOUT_KINDS: Record<string, CalloutKind> = {
  tip: 'tip', note: 'info', info: 'info', warn: 'warn', warning: 'warn', caution: 'warn', important: 'warn',
};

export function parseMetric(name: string, value: string): Metric {
  const m = /^\s*([-+]?[\d][\d,]*(?:\.\d+)?)(\s*.*)$/.exec(value);
  if (!m) return { name, value };
  // keep the author's spacing: "850ms" stays tight, "1 ngày" keeps its space
  return { name, value, num: Number(m[1].replace(/,/g, '')), unit: m[2].trimEnd() };
}

function emptyStep(title: string, line: number, chapter?: string): RawStep {
  let short = title;
  const bar = title.lastIndexOf(' | ');
  if (bar >= 0) {
    short = title.slice(bar + 3).trim();
    title = title.slice(0, bar).trim();
  }
  return { title, short, chapter, line, bodyMd: '', callouts: [], changes: [], metrics: [], notesMd: '' };
}

export function parseDeck(src: string, file = 'deck.md'): { deck: RawDeck; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const err = (line: number, message: string, col = 1) =>
    diagnostics.push({ file, line, col, message, severity: 'error' });

  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  let fm: Record<string, unknown> = {};

  // ---- frontmatter
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, k) => k > 0 && l.trim() === '---');
    if (end < 0) {
      err(1, 'Frontmatter mở bằng "---" nhưng không có dòng "---" đóng.');
    } else {
      try {
        fm = (parseYaml(lines.slice(1, end).join('\n')) as Record<string, unknown>) ?? {};
      } catch (e) {
        const pos = e instanceof YAMLParseError ? e.linePos?.[0] : undefined;
        err((pos?.line ?? 1) + 1, `Frontmatter YAML lỗi: ${(e as Error).message.split('\n')[0]}`, pos?.col ?? 1);
      }
      i = end + 1;
    }
  }
  const meta: DeckMeta = {
    ...fm,
    title: String(fm.title ?? 'Untitled'),
    subtitle: fm.subtitle != null ? String(fm.subtitle) : undefined,
    author: fm.author != null ? String(fm.author) : undefined,
    theme: fm.theme === 'dark' ? 'dark' : 'light',
    accent: typeof fm.accent === 'string' ? fm.accent : '#e2572b',
  };

  const cover = emptyStep(meta.title, 1);
  cover.cover = true;
  cover.short = 'Mở đầu';
  const steps: RawStep[] = [cover];
  let cur = cover;
  let chapter: string | undefined;
  let inNotes = false;

  const append = (s: string) => {
    if (inNotes) cur.notesMd += s + '\n';
    else cur.bodyMd += s + '\n';
  };

  while (i < lines.length) {
    const line = lines[i];
    const lineNo = i + 1;

    // ---- fenced blocks
    const f = FENCE.exec(line);
    if (f) {
      const marker = f[2];
      const info = f[3];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(marker)) j++;
      const inner = lines.slice(i + 1, j);
      if (j >= lines.length) err(lineNo, `Khối code mở bằng ${marker} nhưng không đóng.`);
      if (!inNotes && info === 'scene') {
        if (cur.scene) err(lineNo, 'Mỗi bước chỉ được có một khối ```scene```.');
        else cur.scene = { yaml: inner.join('\n'), line: lineNo + 1 };
      } else if (!inNotes && info === 'changes') {
        for (const l of inner) {
          const m = /^\s*([+~-])\s*(.+)$/.exec(l);
          if (m) cur.changes.push({ op: m[1] as Change['op'], text: m[2].trim() });
          else if (l.trim()) cur.changes.push({ op: '~', text: l.trim() });
        }
      } else if (!inNotes && info === 'metrics') {
        inner.forEach((l, k) => {
          if (!l.trim()) return;
          const c = l.indexOf(':');
          if (c < 0) return err(lineNo + 1 + k, 'Dòng metrics phải có dạng "tên: giá trị".');
          cur.metrics.push(parseMetric(l.slice(0, c).trim(), l.slice(c + 1).trim()));
        });
      } else {
        for (let k = i; k <= Math.min(j, lines.length - 1); k++) append(lines[k]);
      }
      i = j + 1;
      continue;
    }

    // ---- headings
    const h = /^(#{1,2})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      if (h[1] === '#') {
        chapter = h[2];
      } else {
        cur = emptyStep(h[2], lineNo, chapter);
        steps.push(cur);
        inNotes = false;
      }
      i++;
      continue;
    }

    // ---- speaker notes separator
    if (line.trim() === '???') {
      inNotes = true;
      i++;
      continue;
    }

    // ---- callouts  > [!tip] text
    const c = /^\s*>\s*\[!(\w+)\]\s*(.*)$/.exec(line);
    if (c && !inNotes) {
      const kind = CALLOUT_KINDS[c[1].toLowerCase()];
      if (!kind) err(lineNo, `Loại callout "${c[1]}" không hợp lệ. Dùng: tip, warn, info.`);
      const parts = [c[2]];
      let j = i + 1;
      for (; j < lines.length && /^\s*>/.test(lines[j]); j++) parts.push(lines[j].replace(/^\s*>\s?/, ''));
      cur.callouts.push({ kind: kind ?? 'info', md: parts.join('\n').trim() } satisfies Callout);
      i = j;
      continue;
    }

    append(line);
    i++;
  }

  return { deck: { meta, steps }, diagnostics };
}
