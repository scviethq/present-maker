import MarkdownIt from 'markdown-it';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  highlight(code: string, lang: string): string {
    try {
      const out = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }) : hljs.highlightAuto(code);
      return `<pre class="hljs"><code>${out.value}</code></pre>`;
    } catch {
      return '';
    }
  },
});
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener');
  return self.renderToken(tokens, idx, options);
};

/**
 * Render Markdown with KaTeX math ($$…$$ display, $…$ inline). Math is swapped for placeholders
 * before Markdown runs so `_` and `*` inside formulas are not read as emphasis. Fenced code is left alone.
 */
export function renderMarkdown(src: string, opts: { inline?: boolean } = {}): string {
  const math: string[] = [];
  const hold = (html: string) => `\uE000M${math.push(html) - 1}\uE000`;
  const parts = src.split(/(^```[\s\S]*?^```|`[^`\n]+`)/m);
  const prepared = parts
    .map((p, k) => {
      if (k % 2 === 1) return p; // code
      return p
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => hold(safeKatex(tex, true)))
        .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, pre, tex) => pre + hold(safeKatex(tex, false)));
    })
    .join('');
  const html = opts.inline ? md.renderInline(prepared) : md.render(prepared);
  return html.replace(/\uE000M(\d+)\uE000/g, (_: string, n: string) => math[Number(n)]);
}

function safeKatex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: true, output: 'html' });
  } catch (e) {
    return `<code class="math-error" title="${String((e as Error).message).replace(/"/g, '&quot;')}">${tex}</code>`;
  }
}

/** Throws the KaTeX error message for the first invalid formula, or returns null. */
export function findMathError(src: string): string | null {
  const re = /\$\$([\s\S]+?)\$\$|(?:^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g;
  for (const m of src.replace(/^```[\s\S]*?^```/gm, '').matchAll(re)) {
    try {
      katex.renderToString((m[1] ?? m[2]).trim(), { displayMode: !!m[1], throwOnError: true });
    } catch (e) {
      return (e as Error).message;
    }
  }
  return null;
}
