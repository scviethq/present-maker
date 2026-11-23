import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDeck, formatDiagnostic } from '../core/compile.js';
import type { CompiledDeck, Diagnostic } from '../core/types.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = join(ROOT, 'dist-runtime', 'index.html');

const HELP = `present-maker — Markdown → trình bày sơ đồ isometric 3D

Cách dùng:
  present-maker check <deck.md>                 Kiểm tra lỗi (exit 1 nếu có lỗi)
  present-maker build <deck.md> [-o <thư mục>]  Xuất site tĩnh (mặc định: out/<tên-deck>/)
  present-maker build <deck.md> --single        Xuất 1 file HTML tự chứa (nhúng cả ảnh) để gửi/chạy offline
  present-maker dev   <deck.md> [--port 4321]   Xem trực tiếp, tự tải lại khi lưu file
  present-maker init  [tên]                     Tạo deck mẫu <tên>.deck.md
`;

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
};

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') flags.out = argv[++i];
    else if (a === '--port') flags.port = argv[++i];
    else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else pos.push(a);
  }
  return { pos, flags };
}

function template(): string {
  if (!existsSync(TEMPLATE)) {
    console.error(`Thiếu runtime (${TEMPLATE}). Chạy "npm run build" trong thư mục present-maker trước.`);
    process.exit(2);
  }
  return readFileSync(TEMPLATE, 'utf8');
}

function injectDeck(html: string, deck: CompiledDeck, extraHead = ''): string {
  const json = JSON.stringify(deck).replace(/</g, '\\u003c');
  const title = deck.meta.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace('<!--DECK-->', () => `<script id="deck" type="application/json">${json}</script>${extraHead}`);
}

/** Rewrite local <img src> in step HTML, either to data URIs or by mapping through `map`. */
function rewriteImages(deck: CompiledDeck, map: (ref: string) => string): CompiledDeck {
  const fix = (html: string) => html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (m, a, ref, b) => (/^(https?:|data:)/.test(ref) ? m : a + map(ref) + b));
  return { ...deck, steps: deck.steps.map((s) => ({ ...s, bodyHtml: fix(s.bodyHtml) })) };
}

async function compileFile(file: string) {
  const src = readFileSync(file, 'utf8');
  return compileDeck(src, file, { baseDir: dirname(resolve(file)) });
}

function report(diags: Diagnostic[]) {
  for (const d of diags) console.error(formatDiagnostic(d));
}

async function cmdCheck(file: string) {
  const r = await compileFile(file);
  report(r.diagnostics);
  const errors = r.diagnostics.filter((d) => d.severity === 'error').length;
  if (errors) {
    console.error(`\n✗ ${errors} lỗi.`);
    process.exit(1);
  }
  const steps = r.compiled!.steps;
  const nodes = new Set(steps.flatMap((s) => Object.keys(s.scene.nodes)));
  console.log(`✓ ${file}: ${steps.length} bước, ${nodes.size} node, không lỗi.`);
}

async function cmdBuild(file: string, flags: Record<string, string | boolean>) {
  const r = await compileFile(file);
  report(r.diagnostics);
  if (!r.compiled) {
    console.error('\n✗ Không build vì còn lỗi.');
    process.exit(1);
  }
  const base = dirname(resolve(file));
  const name = basename(file).replace(/(\.deck)?\.md$/i, '');
  const html = template();

  if (flags.single) {
    const deck = rewriteImages(r.compiled, (ref) => {
      const p = resolve(base, ref);
      return `data:${MIME[extname(p).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(p).toString('base64')}`;
    });
    const out = typeof flags.out === 'string' ? flags.out : `${name}.html`;
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, injectDeck(html, deck));
    console.log(`✓ Đã xuất ${out} (${(statSync(out).size / 1024).toFixed(0)} KB) — mở trực tiếp bằng trình duyệt, không cần mạng.`);
    return;
  }

  const outDir = typeof flags.out === 'string' ? flags.out : join('out', name);
  mkdirSync(outDir, { recursive: true });
  const deck = rewriteImages(r.compiled, (ref) => {
    const target = join('assets', ref.replace(/^(\.\.\/)+/, '').replace(/^\.?\//, ''));
    mkdirSync(dirname(join(outDir, target)), { recursive: true });
    copyFileSync(resolve(base, ref), join(outDir, target));
    return target;
  });
  writeFileSync(join(outDir, 'index.html'), injectDeck(html, deck));
  console.log(`✓ Đã xuất ${join(outDir, 'index.html')} — deploy cả thư mục ${outDir}/ lên Vercel/Netlify hoặc mở trực tiếp.`);
}

async function cmdDev(file: string, flags: Record<string, string | boolean>) {
  const port = Number(flags.port ?? 4321);
  const base = dirname(resolve(file));
  const clients = new Set<import('node:http').ServerResponse>();
  const reload = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;
  let page = '';

  const rebuild = async () => {
    const r = await compileFile(file);
    if (r.diagnostics.length) {
      console.error(`\n[${new Date().toLocaleTimeString()}]`);
      report(r.diagnostics);
    }
    if (r.compiled) {
      page = injectDeck(template(), r.compiled, reload);
      console.log(`[${new Date().toLocaleTimeString()}] ✓ ${r.compiled.steps.length} bước`);
    } else {
      const list = r.diagnostics.map((d) => `<li>${formatDiagnostic(d).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('');
      page = `<!doctype html><meta charset="utf-8"><title>Lỗi deck</title><body style="font:15px/1.6 ui-monospace,monospace;padding:32px;background:#1b1e23;color:#ece7e0"><h2 style="color:#ef7b7b">Deck có lỗi — sửa file rồi lưu lại</h2><ul>${list}</ul>${reload}`;
    }
    for (const c of clients) c.write('data: reload\n\n');
  };
  await rebuild();

  let timer: NodeJS.Timeout | undefined;
  watch(base, { recursive: true }, (_e, f) => {
    if (!f || /(^|\/)(node_modules|out|\.git)\//.test(f)) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  });

  createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (url === '/__reload') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    const p = resolve(base, '.' + url);
    if (p.startsWith(base) && existsSync(p) && statSync(p).isFile()) {
      res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] ?? 'application/octet-stream' });
      return res.end(readFileSync(p));
    }
    res.writeHead(404).end('not found');
  }).listen(port, () => console.log(`\n▶ http://localhost:${port}  (Ctrl+C để dừng)`));
}

function cmdInit(name = 'my-talk') {
  const file = `${name.replace(/\.deck\.md$|\.md$/, '')}.deck.md`;
  if (existsSync(file)) {
    console.error(`${file} đã tồn tại, không ghi đè.`);
    process.exit(1);
  }
  writeFileSync(file, readFileSync(join(ROOT, 'examples', 'starter.deck.md'), 'utf8'));
  console.log(`✓ Đã tạo ${file}. Chạy: present-maker dev ${file}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseArgs(rest);
  const needFile = () => {
    if (!pos[0]) {
      console.error(HELP);
      process.exit(2);
    }
    if (!existsSync(pos[0])) {
      console.error(`Không tìm thấy file: ${pos[0]}`);
      process.exit(2);
    }
    return pos[0];
  };
  switch (cmd) {
    case 'check': return cmdCheck(needFile());
    case 'build': return cmdBuild(needFile(), flags);
    case 'dev': return cmdDev(needFile(), flags);
    case 'init': return cmdInit(pos[0]);
    default:
      console.log(HELP);
      if (cmd && cmd !== 'help' && cmd !== '--help' && cmd !== '-h') process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
