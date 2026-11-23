import './fonts.css';
import 'katex/dist/katex.min.css';
import './hljs.css';
import './style.css';
import { createElement, ArrowLeft, ArrowRight, Maximize, Moon, NotebookPen, Presentation, Sun } from 'lucide';
import type { CompiledDeck, CompiledStep, Metric } from '../core/types.js';
import { Stage } from './stage.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const icon = (node: Parameters<typeof createElement>[0]) => createElement(node).outerHTML;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function store<T>(key: string, value?: T): T | undefined {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: preferences just don't persist */
  }
  return value;
}

function loadDeck(): CompiledDeck {
  const el = document.getElementById('deck');
  if (el?.textContent) return JSON.parse(el.textContent) as CompiledDeck;
  return {
    meta: { title: 'present-maker', theme: 'light', accent: '#e2572b' },
    icons: {},
    steps: [{
      title: 'Chưa có deck', short: 'Trống', cover: true, bodyHtml: '<p>Chạy <code>present-maker dev deck.md</code>.</p>',
      callouts: [], changes: [], metrics: [], notesHtml: '',
      scene: { direction: 'right', nodes: {}, links: {}, zones: {}, flows: [], focus: [], pos: {} },
    }],
  };
}

const deck = loadDeck();
const steps = deck.steps;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.style.setProperty('--accent', deck.meta.accent);
document.title = deck.meta.title;
$('deck-title').textContent = deck.meta.title;

const stage = new Stage($('stage'), deck.icons, deck.meta.accent, reduced);

// ---------------------------------------------------------------- theme
let dark = (store<string>(`pm:theme:${deck.meta.title}`) ?? deck.meta.theme) === 'dark';
function applyTheme() {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('btn-theme').innerHTML = icon(dark ? Sun : Moon);
  stage.setTheme(dark);
}
applyTheme();

// ---------------------------------------------------------------- toolbar
$('btn-notes').innerHTML = icon(NotebookPen);
$('btn-present').innerHTML = icon(Presentation);
$('btn-full').innerHTML = icon(Maximize);
$('prev').innerHTML = icon(ArrowLeft);
$('next').innerHTML = icon(ArrowRight);

function togglePresent(on = !document.body.classList.contains('present')) {
  document.body.classList.toggle('present', on);
  $('btn-present').setAttribute('aria-pressed', String(on));
  stage.bottomPad = on ? 0.16 : 0.12;
  requestAnimationFrame(() => go(current, { instant: true, force: true }));
}
function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
$('btn-theme').onclick = () => { dark = !dark; store(`pm:theme:${deck.meta.title}`, dark ? 'dark' : 'light'); applyTheme(); };
$('btn-present').onclick = () => togglePresent();
$('btn-full').onclick = toggleFull;
$('btn-notes').onclick = openNotes;
$('prev').onclick = () => go(current - 1);
$('next').onclick = () => go(current + 1);

// ---------------------------------------------------------------- step bar
const stepList = $('steps');
const stepButtons: HTMLButtonElement[] = [];
steps.forEach((s, k) => {
  if (k > 0 && s.chapter !== steps[k - 1].chapter) {
    const sep = document.createElement('li');
    sep.className = 'chapter-sep';
    sep.setAttribute('aria-hidden', 'true');
    stepList.appendChild(sep);
  }
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.textContent = s.short;
  b.title = (s.chapter ? `${s.chapter} · ` : '') + s.title;
  b.onclick = () => go(k);
  li.appendChild(b);
  stepList.appendChild(li);
  stepButtons.push(b);
});

// ---------------------------------------------------------------- panel
function renderPanel(s: CompiledStep, k: number): string {
  const callouts = s.callouts
    .map((c) => `<div class="callout kind-${c.kind}"><span class="ck">${{ tip: 'Mẹo', warn: 'Lưu ý', info: 'Ghi chú' }[c.kind]}</span><div>${c.html}</div></div>`)
    .join('');
  const changes = s.changes.length
    ? `<ul class="changes">${s.changes.map((c) => `<li class="op-${c.op === '+' ? 'add' : c.op === '-' ? 'del' : 'mod'}"><b>${c.op}</b><span>${esc(c.text)}</span></li>`).join('')}</ul>`
    : '';
  if (s.cover) {
    const m = deck.meta;
    return `<div class="cover">
      <div class="eyebrow"><span class="chap">${esc(m.author ?? 'Trình bày')}</span></div>
      <h1 class="title">${esc(m.title)}</h1>
      ${m.subtitle ? `<div class="subtitle">${esc(m.subtitle)}</div>` : ''}
      <div class="body">${s.bodyHtml}</div>${callouts}${changes}
      <div class="hint">Nhấn <kbd>→</kbd> để bắt đầu · <kbd>P</kbd> trình chiếu · <kbd>N</kbd> ghi chú</div>
    </div>`;
  }
  return `<div class="eyebrow">${s.chapter ? `<span class="chap">${esc(s.chapter)}</span><span>·</span>` : ''}<span>${k} / ${steps.length - 1}</span></div>
    <h1 class="title">${esc(s.title)}</h1>
    <div class="body">${s.bodyHtml}</div>${callouts}${changes}`;
}

// ---------------------------------------------------------------- metrics
const metricValues = new Map<string, number>();
function fmt(m: Metric, v: number): string {
  const decimals = (m.value.match(/\.(\d+)/)?.[1].length) ?? 0;
  const s = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: m.value.includes(',') });
  return s + (m.unit ?? '');
}
function renderMetrics(ms: Metric[], instant: boolean) {
  const box = $('metrics');
  box.innerHTML = ms.map((m, i) => `<div class="metric"><div class="mn">${esc(m.name)}</div><div class="mv" data-i="${i}">${esc(m.value)}</div></div>`).join('');
  ms.forEach((m, i) => {
    if (m.num === undefined) return;
    const el = box.querySelector<HTMLElement>(`[data-i="${i}"]`)!;
    const from = metricValues.get(m.name) ?? 0;
    const to = m.num;
    metricValues.set(m.name, to);
    if (instant || reduced || from === to) return void (el.textContent = fmt(m, to));
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      el.textContent = fmt(m, from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ---------------------------------------------------------------- navigation
let current = -1;
const lastWithScene = [...steps].reverse().find((s) => Object.keys(s.scene.nodes).length);

function sceneFor(k: number) {
  const s = steps[k];
  // an empty cover previews the final picture without traffic
  if (s.cover && !Object.keys(s.scene.nodes).length && lastWithScene) return { scene: lastWithScene.scene, flows: false };
  return { scene: s.scene, flows: true };
}

function go(k: number, opts: { instant?: boolean; force?: boolean } = {}) {
  k = Math.max(0, Math.min(steps.length - 1, k));
  if (k === current && !opts.force) return;
  const first = current < 0;
  current = k;
  const s = steps[k];

  const panel = $('panel');
  const swap = () => {
    panel.innerHTML = renderPanel(s, k);
    panel.classList.remove('leaving');
    panel.parentElement!.scrollTop = 0;
  };
  if (first || opts.instant || reduced) swap();
  else {
    panel.classList.add('leaving');
    setTimeout(swap, 180);
  }

  $('caption').innerHTML = `<div class="ct">${esc(s.cover ? deck.meta.title : s.title)}</div>${
    s.callouts[0] ? `<div class="cs">${s.callouts[0].html}</div>` : s.cover && deck.meta.subtitle ? `<div class="cs">${esc(deck.meta.subtitle)}</div>` : ''}`;

  const { scene, flows } = sceneFor(k);
  stage.show(scene, { instant: first || opts.instant, flows });
  const empty = $('empty');
  empty.hidden = Object.keys(scene.nodes).length > 0;
  empty.textContent = 'Bước này chưa có sơ đồ';
  renderMetrics(s.metrics, first || !!opts.instant);

  stepButtons.forEach((b, i) => {
    b.classList.toggle('current', i === k);
    b.classList.toggle('done', i < k);
    if (i === k) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  // scroll only the step strip (scrollIntoView would also scroll the page)
  const btn = stepButtons[k];
  stepList.scrollTo({ left: btn.offsetLeft - stepList.clientWidth / 2 + btn.clientWidth / 2, behavior: first || reduced ? 'auto' : 'smooth' });
  $('count').textContent = `${k + 1} / ${steps.length}`;
  ($('prev') as HTMLButtonElement).disabled = k === 0;
  ($('next') as HTMLButtonElement).disabled = k === steps.length - 1;
  if (location.hash !== `#/${k + 1}`) history.replaceState(null, '', `#/${k + 1}`);
  updateNotes();
}

function fromHash(): number {
  const m = /^#\/(\d+)/.exec(location.hash);
  return m ? Number(m[1]) - 1 : 0;
}
addEventListener('hashchange', () => go(fromHash()));

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': case ' ': case 'Enter': go(current + 1); break;
    case 'ArrowLeft': case 'PageUp': case 'Backspace': go(current - 1); break;
    case 'Home': go(0); break;
    case 'End': go(steps.length - 1); break;
    case 'f': case 'F': toggleFull(); break;
    case 'p': case 'P': togglePresent(); break;
    case 'n': case 'N': openNotes(); break;
    case 't': case 'T': $('btn-theme').click(); break;
    default: return;
  }
  e.preventDefault();
}
addEventListener('keydown', onKey);

// swipe on touch screens
let sx = 0, sy = 0;
addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
}, { passive: true });

// ---------------------------------------------------------------- speaker notes window
let notesWin: Window | null = null;
const startedAt = Date.now();
function openNotes() {
  if (notesWin && !notesWin.closed) return notesWin.focus();
  notesWin = window.open('', 'pm-notes', 'width=720,height=640');
  if (!notesWin) return;
  const d = notesWin.document;
  d.open();
  d.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ghi chú — ${esc(deck.meta.title)}</title><style>
    body{margin:0;font:18px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;background:#15171b;color:#ece7e0;padding:24px 28px}
    .row{display:flex;justify-content:space-between;color:#9a948b;font-size:14px}
    .timer{font-variant-numeric:tabular-nums;font-size:22px;color:#ece7e0}
    h1{font-size:26px;margin:14px 0 6px}
    .next{color:#9a948b;font-size:15px;margin-bottom:18px}
    .notes{font-size:20px}.notes p{margin:0 0 .7em}
    .empty{color:#6e675f;font-style:italic}
  </style></head><body><div class="row"><span id="pos"></span><span class="timer" id="timer"></span></div>
  <h1 id="title"></h1><div class="next" id="next"></div><div class="notes" id="notes"></div></body></html>`);
  d.close();
  notesWin.addEventListener('keydown', onKey);
  updateNotes();
}
function updateNotes() {
  if (!notesWin || notesWin.closed) return;
  const d = notesWin.document;
  const s = steps[current];
  const n = steps[current + 1];
  d.getElementById('pos')!.textContent = `Bước ${current + 1} / ${steps.length}`;
  d.getElementById('title')!.textContent = s.cover ? deck.meta.title : s.title;
  d.getElementById('next')!.textContent = n ? `Tiếp theo: ${n.title}` : 'Bước cuối';
  d.getElementById('notes')!.innerHTML = s.notesHtml || '<p class="empty">Không có ghi chú cho bước này.</p>';
}
setInterval(() => {
  if (!notesWin || notesWin.closed) return;
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  notesWin.document.getElementById('timer')!.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}, 1000);

// ---------------------------------------------------------------- boot
document.fonts?.ready.then(() => stage.resize());
go(fromHash(), { instant: true });
