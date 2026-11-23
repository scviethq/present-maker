import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CompiledStep, FlowSpec, LinkSpec, NodeSpec } from '../core/types.js';
import { PALETTE } from '../core/shapes.js';
import { buildShape, defaultColor, FOOT, prefersLightInk } from './shapes3d.js';
import { Tweens, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic } from './tween.js';

type Scene = CompiledStep['scene'];
type V3 = THREE.Vector3;

const FLOW_COLOR: Record<FlowSpec['kind'], string> = {
  req: 'accent', data: '#1f9e8f', event: '#7d5bd6', fail: '#d64545', ping: '#4f9d3a',
};
const SPEED = 1.7; // world units per second
const DUR = 520;

interface Fadeable {
  mats: THREE.Material[];
  els: HTMLElement[];
  opacity: number;
}
interface NodeObj extends Fadeable {
  id: string;
  spec: NodeSpec;
  key: string;
  root: THREE.Group;
  body: THREE.Group;
  top: number;
  foot: number;
  labelEl: HTMLElement;
  alive: boolean;
}
interface LinkObj extends Fadeable {
  id: string;
  key: string;
  spec: LinkSpec;
  group: THREE.Group;
}
interface ZoneObj extends Fadeable {
  id: string;
  plate: THREE.Mesh;
  label: CSS2DObject;
  bounds: { x0: number; x1: number; z0: number; z1: number };
}
interface Packet {
  mesh: THREE.Mesh;
  path: V3[];
  cum: number[];
  len: number;
  end: number; // distance where it stops (fail stops early)
  delay: number;
  period: number;
  fail: boolean;
}

/** CSS2DRenderer owns the outer element's transform, so styling/scaling goes on an inner element. */
function tag(cls: string, text: string): HTMLElement {
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  inner.className = cls;
  inner.textContent = text;
  outer.appendChild(inner);
  return outer;
}

export function resolveColor(c: string | undefined, fallback: string, accent: string): string {
  if (!c) return fallback;
  if (c === 'accent') return accent;
  return PALETTE[c] ?? c;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  private light = new THREE.DirectionalLight(0xffffff, 2.1);
  private ground: THREE.Mesh;
  private tweens = new Tweens();
  private nodes = new Map<string, NodeObj>();
  private links = new Map<string, LinkObj>();
  private zones = new Map<string, ZoneObj>();
  private packets: Packet[] = [];
  private flowLayer = new THREE.Group();
  private flowStart = 0;
  private view = { target: new THREE.Vector3(), half: 4 };
  /** Camera direction: ~23° azimuth so a left→right flow reads across the screen, ~36° elevation. */
  private offset = new THREE.Vector3(0.42, 0.78, 1).normalize().multiplyScalar(60);
  private azimuth = Math.atan2(0.42, 1);
  private iconTex = new Map<string, THREE.Texture>();
  private hot = new Set<NodeObj>();
  private direction: 'right' | 'down' = 'right';
  private linkColor = new THREE.Color('#3a3631');
  /** extra room (fraction of height) to leave at the bottom for overlays */
  bottomPad = 0.12;

  constructor(
    private host: HTMLElement,
    private icons: Record<string, string>,
    private accent: string,
    private reduced: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    host.appendChild(this.labels.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a98f, 1.6));
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.radius = 4;
    this.light.shadow.bias = -0.0005;
    const sc = this.light.shadow.camera;
    sc.left = sc.bottom = -14;
    sc.right = sc.top = 14;
    sc.near = 0.1;
    sc.far = 60;
    this.scene.add(this.light, this.light.target);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.14 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.flowLayer);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  setTheme(dark: boolean) {
    this.linkColor.set(dark ? '#cfc8bd' : '#3a3631');
    for (const l of this.links.values()) for (const m of l.mats) (m as THREE.MeshBasicMaterial).color?.copy(this.linkColor);
    (this.ground.material as THREE.ShadowMaterial).opacity = dark ? 0.35 : 0.14;
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.applyView();
  }

  // ------------------------------------------------------------------ show

  show(sc: Scene, opts: { instant?: boolean; flows?: boolean } = {}) {
    const dur = opts.instant || this.reduced ? 0 : DUR;
    this.direction = sc.direction;
    const world = (id: string) => {
      const p = sc.pos[id] ?? [0, 0];
      return new THREE.Vector3(p[0], 0, p[1]);
    };

    // ---- nodes
    for (const [id, o] of this.nodes) {
      const next = sc.nodes[id];
      if (!next || this.nodeKey(next) !== o.key) this.removeNode(o, dur);
    }
    for (const [id, spec] of Object.entries(sc.nodes)) {
      const target = world(id);
      let o = this.nodes.get(id);
      if (!o) {
        o = this.createNode(id, spec);
        o.root.position.copy(target);
        this.grow(o, dur);
      } else {
        const from = o.root.position.clone();
        if (!from.equals(target)) this.tweens.add(dur, (k) => o!.root.position.lerpVectors(from, target, k), easeInOutCubic);
      }
      this.updateNode(o, spec);
    }

    // ---- zones
    const zoneBounds = new Map<string, ZoneObj['bounds']>();
    for (const [id, n] of Object.entries(sc.nodes)) {
      if (!n.zone) continue;
      const p = world(id);
      const r = (FOOT[n.size] / 2) + 0.35;
      const b = zoneBounds.get(n.zone) ?? { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
      b.x0 = Math.min(b.x0, p.x - r); b.x1 = Math.max(b.x1, p.x + r + (n.shape === 'queue' ? 0.3 : 0));
      b.z0 = Math.min(b.z0, p.z - r); b.z1 = Math.max(b.z1, p.z + r);
      zoneBounds.set(n.zone, b);
    }
    for (const [id, z] of this.zones) if (!zoneBounds.has(id)) this.fadeRemove(z, z.plate, dur, () => this.zones.delete(id));
    for (const [id, b] of zoneBounds) this.upsertZone(id, sc.zones[id] ?? {}, b, dur);

    // ---- links
    const want = new Map<string, { spec: LinkSpec; key: string }>();
    for (const [id, l] of Object.entries(sc.links)) {
      if (!sc.nodes[l.from] || !sc.nodes[l.to]) continue;
      const pa = sc.pos[l.from], pb = sc.pos[l.to];
      const key = JSON.stringify([l, pa, pb, sc.nodes[l.from].size, sc.nodes[l.to].size, sc.direction]);
      want.set(id, { spec: l, key });
    }
    for (const [id, o] of this.links) {
      if (want.get(id)?.key !== o.key) {
        this.links.delete(id);
        this.fadeRemove(o, o.group, dur * 0.6);
      }
    }
    for (const [id, { spec, key }] of want) {
      if (this.links.has(id)) continue;
      const pts = this.route(world(spec.from), world(spec.to), FOOT[sc.nodes[spec.from].size] * 0.62, FOOT[sc.nodes[spec.to].size] * 0.62);
      const o = this.createLink(id, spec, key, pts);
      o.opacity = 0; // faded in by the focus pass below, after nodes have grown
      this.setOpacity(o, 0);
    }

    // ---- focus / opacity targets
    const focus = new Set(sc.focus);
    const focusedNode = (id: string) => !focus.size || focus.has(id) || (sc.nodes[id]?.zone ? focus.has(sc.nodes[id].zone!) : false);
    for (const [id, o] of this.nodes) {
      if (!o.alive) continue;
      const base = sc.nodes[id]?.status === 'muted' ? 0.35 : 1;
      this.fadeTo(o, focusedNode(id) ? base : 0.16, dur);
    }
    for (const [, o] of this.links) this.fadeTo(o, focusedNode(o.spec.from) && focusedNode(o.spec.to) ? 1 : 0.12, dur, dur * 0.5);
    for (const [id, z] of this.zones) {
      const any = !focus.size || focus.has(id) || Object.entries(sc.nodes).some(([nid, n]) => n.zone === id && focus.has(nid));
      if (zoneBounds.has(id)) this.fadeTo(z, any ? 1 : 0.35, dur);
    }

    // ---- flows
    this.clearFlows();
    if (opts.flows !== false) this.buildFlows(sc, world);
    this.flowStart = performance.now() + (dur ? dur + 150 : 0);

    // ---- camera
    this.fit(sc, world, dur);
  }

  // ------------------------------------------------------------------ nodes

  private nodeKey(n: NodeSpec) {
    return [n.shape, n.color, n.size, n.count, n.icon].join('|');
  }

  private createNode(id: string, spec: NodeSpec): NodeObj {
    const color = resolveColor(spec.color, defaultColor(spec.shape), this.accent);
    const foot = FOOT[spec.size];
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const copies = Math.min(spec.count, 4);
    let built = buildShape(spec.shape, color, foot);
    for (let k = copies - 1; k >= 0; k--) {
      const b = k === 0 ? built : buildShape(spec.shape, color, foot);
      b.group.position.set(-0.2 * k * foot, 0, -0.2 * k * foot);
      body.add(b.group);
      if (k === 0) built = b;
    }

    if (spec.icon && built.decal && this.icons[spec.icon]) {
      const tex = this.iconTexture(spec.icon, prefersLightInk(color) ? '#ffffff' : '#2a2622');
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(built.decal.size * 0.7, built.decal.size * 0.7), m);
      plane.rotation.order = 'YXZ';
      plane.rotation.set(-Math.PI / 2, this.azimuth, 0);
      plane.position.y = built.decal.y + 0.003;
      built.group.add(plane);
    }

    const labelEl = document.createElement('div');
    labelEl.className = 'node-label';
    const label = new CSS2DObject(labelEl);
    label.position.set(0, built.top + 0.06, 0);
    root.add(label);

    const mats: THREE.Material[] = [];
    body.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !mats.includes(m)) {
        mats.push(m);
        if ('color' in m) m.userData.base = (m as THREE.MeshLambertMaterial).color.clone();
        m.userData.baseOpacity = m.opacity;
      }
    });

    const o: NodeObj = {
      id, spec, key: this.nodeKey(spec), root, body, top: built.top, foot, labelEl, alive: true,
      mats, els: [labelEl], opacity: 1,
    };
    this.scene.add(root);
    this.nodes.set(id, o);
    return o;
  }

  private updateNode(o: NodeObj, spec: NodeSpec) {
    o.spec = spec;
    const icon = spec.icon && this.icons[spec.icon];
    const flat = o.body.children.some((c) => c.children.some((m) => (m as THREE.Mesh).material instanceof THREE.MeshBasicMaterial));
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    o.labelEl.innerHTML =
      `<div class="nl-inner${spec.status !== 'ok' ? ` is-${spec.status}` : ''}">` +
      (icon && !flat ? `<span class="nl-icon">${icon}</span>` : '') +
      (spec.status === 'down' ? '<span class="nl-badge">✕</span>' : '') +
      (spec.label ? `<span class="nl-title">${esc(spec.label)}</span>` : '') +
      (spec.sub ? `<span class="nl-sub">${esc(spec.sub)}</span>` : '') +
      `</div>`;
    const down = spec.status === 'down';
    for (const m of o.mats) {
      const base = m.userData.base as THREE.Color | undefined;
      if (!base || !(m instanceof THREE.MeshLambertMaterial)) continue;
      m.color.copy(down ? new THREE.Color('#a39d95') : base);
      m.emissive.set(0x000000);
    }
    if (spec.status === 'hot') this.hot.add(o);
    else this.hot.delete(o);
  }

  private grow(o: NodeObj, dur: number) {
    if (!dur) return;
    o.body.scale.set(1, 0.001, 1);
    this.setOpacity(o, 0);
    this.tweens.add(dur, (k) => o.body.scale.set(1, Math.max(0.001, k), 1), easeOutBack);
    this.tweens.add(dur * 0.6, (k) => this.setOpacity(o, k * o.opacity), easeOutCubic);
  }

  private removeNode(o: NodeObj, dur: number) {
    this.nodes.delete(o.id);
    this.hot.delete(o);
    o.alive = false;
    const start = o.opacity;
    const done = () => this.dispose(o.root);
    if (!dur) return done();
    this.tweens.add(dur * 0.7, (k) => {
      o.body.scale.set(1, Math.max(0.001, 1 - k), 1);
      this.setOpacity(o, start * (1 - k));
    }, easeInCubic, done);
  }

  // ------------------------------------------------------------------ zones

  private upsertZone(id: string, spec: { label?: string; color?: string }, b: ZoneObj['bounds'], dur: number) {
    const color = resolveColor(spec.color, '#d9c8a9', this.accent);
    let z = this.zones.get(id);
    if (!z) {
      const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 });
      m.userData.baseOpacity = 0.55;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 1), m);
      plate.receiveShadow = true;
      plate.position.y = 0.015;
      const el = tag('zone-label', '');
      const label = new CSS2DObject(el);
      this.scene.add(plate, label);
      z = { id, plate, label, bounds: { ...b }, mats: [m], els: [el], opacity: 0 };
      this.zones.set(id, z);
      this.place(z, b);
      this.setOpacity(z, 0);
    } else {
      const from = { ...z.bounds };
      const zz = z;
      this.tweens.add(dur, (k) => this.place(zz, {
        x0: from.x0 + (b.x0 - from.x0) * k, x1: from.x1 + (b.x1 - from.x1) * k,
        z0: from.z0 + (b.z0 - from.z0) * k, z1: from.z1 + (b.z1 - from.z1) * k,
      }), easeInOutCubic);
    }
    (z.mats[0] as THREE.MeshLambertMaterial).color.set(color);
    (z.els[0].firstChild as HTMLElement).textContent = spec.label ?? '';
    z.els[0].style.display = spec.label ? '' : 'none';
  }

  private place(z: ZoneObj, b: ZoneObj['bounds']) {
    z.bounds = { ...b };
    z.plate.scale.set(b.x1 - b.x0, 1, b.z1 - b.z0);
    z.plate.position.set((b.x0 + b.x1) / 2, 0.015, (b.z0 + b.z1) / 2);
    // label on the front-left edge (the edge facing the viewer on the left side of the screen)
    z.label.position.set(b.x0 + 0.1, 0.04, b.z1);
  }

  // ------------------------------------------------------------------ links

  /** Orthogonal route between two ground points, trimmed by the node radii. */
  private route(a: V3, b: V3, ra = 0, rb = 0): V3[] {
    const pts: V3[] = [a.clone()];
    const dx = b.x - a.x, dz = b.z - a.z;
    // small offsets read better as one slightly slanted line than as a tiny jog
    if (Math.abs(dx) > 0.35 && Math.abs(dz) > 0.35) {
      if (this.direction === 'down') {
        const mz = (a.z + b.z) / 2;
        pts.push(new THREE.Vector3(a.x, 0, mz), new THREE.Vector3(b.x, 0, mz));
      } else {
        const mx = (a.x + b.x) / 2;
        pts.push(new THREE.Vector3(mx, 0, a.z), new THREE.Vector3(mx, 0, b.z));
      }
    }
    pts.push(b.clone());
    // trim ends
    const trim = (p0: V3, p1: V3, r: number) => {
      const d = p0.distanceTo(p1);
      if (d > r * 1.05) p0.lerp(p1, r / d);
    };
    trim(pts[0], pts[1], ra);
    trim(pts[pts.length - 1], pts[pts.length - 2], rb);
    return pts;
  }

  private createLink(id: string, spec: LinkSpec, key: string, pts: V3[]): LinkObj {
    const group = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: this.linkColor, transparent: true, opacity: 0.6 });
    m.userData.baseOpacity = 0.6;
    const W = 0.035, H = 0.012, Y = 0.03;
    const seg = (p: V3, q: V3) => {
      const len = p.distanceTo(q);
      if (len < 1e-3) return;
      const pieces: [number, number][] = spec.style === 'dashed'
        ? Array.from({ length: Math.max(1, Math.floor(len / 0.16)) }, (_, k) => [k * 0.16, Math.min(len, k * 0.16 + 0.09)])
        : [[0, len]];
      for (const [s, e] of pieces) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(e - s + (spec.style === 'dashed' ? 0 : W), H, W), m);
        const mid = p.clone().lerp(q, (s + e) / 2 / len);
        box.position.set(mid.x, Y, mid.z);
        box.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
        group.add(box);
      }
    };
    for (let k = 0; k < pts.length - 1; k++) seg(pts[k], pts[k + 1]);
    const arrow = (tip: V3, from: V3) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 16), m);
      const dir = tip.clone().sub(from).normalize();
      cone.position.copy(tip).addScaledVector(dir, -0.09).setY(Y);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      group.add(cone);
    };
    if (spec.dir !== 'none') arrow(pts[pts.length - 1], pts[pts.length - 2]);
    if (spec.dir === 'both') arrow(pts[0], pts[1]);

    const els: HTMLElement[] = [];
    if (spec.label) {
      const el = tag('link-label', spec.label);
      const lbl = new CSS2DObject(el);
      lbl.position.copy(midpoint(pts)).setY(0.08);
      group.add(lbl);
      els.push(el);
    }
    this.scene.add(group);
    const o: LinkObj = { id, key, spec, group, mats: [m], els, opacity: 1 };
    this.links.set(id, o);
    return o;
  }

  // ------------------------------------------------------------------ flows

  private clearFlows() {
    for (const p of this.packets) p.mesh.geometry.dispose();
    this.packets = [];
    this.dispose(this.flowLayer, false);
    this.flowLayer.clear();
    for (const l of this.links.values()) for (const m of l.mats) (m as THREE.MeshBasicMaterial).color.copy(this.linkColor);
  }

  private buildFlows(sc: Scene, world: (id: string) => V3) {
    let fi = 0;
    for (const f of sc.flows) {
      let path: V3[] = [];
      let lastHop = 0;
      for (let k = 0; k < f.path.length - 1; k++) {
        const hop = this.route(world(f.path[k]), world(f.path[k + 1]));
        lastHop = polyLength(hop);
        path = path.length ? path.concat(hop.slice(1)) : hop;
      }
      if (f.kind === 'ping') path = path.concat(path.slice(0, -1).reverse());
      for (const p of path) p.y = 0.16;
      const cum = cumulative(path);
      const len = cum[cum.length - 1];
      if (len < 1e-3) continue;
      const color = resolveColor(FLOW_COLOR[f.kind], this.accent, this.accent);
      const m = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
      const period = len / SPEED + 0.9;
      for (let i = 0; i < f.count; i++) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), m);
        mesh.castShadow = true;
        this.flowLayer.add(mesh);
        const end = f.kind === 'fail' ? len - lastHop * 0.45 : len;
        this.packets.push({ mesh, path, cum, len, end, delay: fi * 0.25 + i * Math.min(0.45, period / f.count), period, fail: f.kind === 'fail' });
        if (this.reduced) {
          sample(path, cum, (end * (i + 1)) / (f.count + 1), mesh.position);
        }
      }
      if (f.label) {
        const el = tag(`flow-label kind-${f.kind}`, f.label);
        const lbl = new CSS2DObject(el);
        sample(path, cum, Math.min(len, f.kind === 'ping' ? len / 4 : len / 2), lbl.position);
        lbl.position.y = 0.42;
        this.flowLayer.add(lbl);
      }
      fi++;
    }
  }

  private tickFlows(now: number) {
    if (this.reduced) return;
    const t = (now - this.flowStart) / 1000;
    for (const p of this.packets) {
      const local = t - p.delay;
      if (local < 0) { p.mesh.visible = false; continue; }
      const d = (local % p.period) * SPEED;
      if (d > p.end) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      sample(p.path, p.cum, d, p.mesh.position);
      const s = p.fail && d > p.end - 0.3 ? Math.max(0.05, (p.end - d) / 0.3) : 1;
      p.mesh.scale.setScalar(p.fail && d > p.end - 0.3 ? 1 + (1 - s) * 0.8 : 1);
      if (p.fail && d > p.end - 0.3) p.mesh.scale.multiplyScalar(s);
    }
  }

  // ------------------------------------------------------------------ camera

  private fit(sc: Scene, world: (id: string) => V3, dur: number) {
    const ids = Object.keys(sc.nodes);
    if (!ids.length) return;
    const tmp = new THREE.OrthographicCamera();
    tmp.position.copy(this.offset);
    tmp.lookAt(0, 0, 0);
    tmp.updateMatrixWorld();
    const inv = tmp.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const add = (v: V3) => {
      const p = v.clone().applyMatrix4(inv);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    };
    for (const id of ids) {
      const c = world(id);
      const n = sc.nodes[id];
      const r = FOOT[n.size] / 2 + 0.25;
      const h = FOOT[n.size] * 1.2 + 0.45; // room for the label
      for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [0, h]) add(new THREE.Vector3(c.x + dx, y, c.z + dz));
    }
    const aspect = (this.host.clientWidth || 1) / (this.host.clientHeight || 1);
    const w = x1 - x0, h = y1 - y0;
    const half = Math.max(h / 2 / (1 - this.bottomPad), w / 2 / aspect, 2.2) * 1.12;
    // shift the centre down so the bottom pad stays free
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2 - half * this.bottomPad;
    const right = new THREE.Vector3().setFromMatrixColumn(tmp.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(tmp.matrixWorld, 1);
    const target = right.multiplyScalar(cx).add(up.multiplyScalar(cy));
    const fromT = this.view.target.clone();
    const fromH = this.view.half;
    if (!dur) {
      this.view.target.copy(target);
      this.view.half = half;
      this.applyView();
      return;
    }
    this.tweens.add(dur * 1.2, (k) => {
      this.view.target.lerpVectors(fromT, target, k);
      this.view.half = fromH + (half - fromH) * k;
      this.applyView();
    }, easeInOutCubic);
  }

  private applyView() {
    const aspect = (this.host.clientWidth || 1) / (this.host.clientHeight || 1);
    const { target, half } = this.view;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.position.copy(target).add(this.offset);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    // labels are DOM: scale them with the zoom so dense diagrams do not drown in text
    const pxPerUnit = (this.host.clientHeight || 1) / (2 * half);
    this.host.style.setProperty('--ls', String(Math.max(0.8, Math.min(1.15, pxPerUnit / 120))));
    // keep the shadow frustum around what we look at
    const dir = this.offset.clone().normalize();
    const ground = target.clone().addScaledVector(dir, -target.y / dir.y);
    this.light.target.position.copy(ground);
    this.light.position.copy(ground).add(new THREE.Vector3(3, 16, 9));
    const s = Math.max(8, half * 2.2);
    const shc = this.light.shadow.camera;
    shc.left = shc.bottom = -s;
    shc.right = shc.top = s;
    shc.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ helpers

  private iconTexture(name: string, ink: string): THREE.Texture {
    const key = `${name}|${ink}`;
    const hit = this.iconTex.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const img = new Image();
    img.onload = () => {
      canvas.getContext('2d')!.drawImage(img, 16, 16, 224, 224);
      tex.needsUpdate = true;
    };
    const svg = this.icons[name].replace('stroke="currentColor"', `stroke="${ink}"`).replace('stroke-width="2"', 'stroke-width="1.8"');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    this.iconTex.set(key, tex);
    return tex;
  }

  private setOpacity(o: Fadeable, v: number) {
    for (const m of o.mats) m.opacity = (m.userData.baseOpacity ?? 1) * v;
    for (const e of o.els) e.style.opacity = String(Math.max(0, Math.min(1, v)));
  }

  private fadeTo(o: Fadeable, target: number, dur: number, delay = 0) {
    const from = o.opacity;
    o.opacity = target;
    if (from === target && !delay) return this.setOpacity(o, target);
    if (!dur) return this.setOpacity(o, target);
    this.tweens.add(dur, (k) => this.setOpacity(o, from + (target - from) * k), easeInOutCubic, undefined, delay);
  }

  private fadeRemove(o: Fadeable, obj: THREE.Object3D, dur: number, after?: () => void) {
    const from = o.opacity;
    const done = () => { this.dispose(obj); after?.(); };
    if (!dur) return done();
    this.tweens.add(dur, (k) => this.setOpacity(o, from * (1 - k)), easeInCubic, done);
    if ('label' in o) (o as ZoneObj).label.removeFromParent();
  }

  private dispose(obj: THREE.Object3D, detach = true) {
    obj.traverse((c) => {
      const m = c as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    if (detach) obj.removeFromParent();
  }

  private frame(now: number) {
    this.tweens.tick(now);
    this.tickFlows(now);
    if (this.hot.size) {
      const k = 0.25 + 0.25 * Math.sin(now / 220);
      for (const o of this.hot) for (const m of o.mats) if (m instanceof THREE.MeshLambertMaterial) m.emissive.setRGB(k * 0.9, k * 0.15, 0);
    }
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}

function cumulative(pts: V3[]): number[] {
  const c = [0];
  for (let k = 1; k < pts.length; k++) c.push(c[k - 1] + pts[k].distanceTo(pts[k - 1]));
  return c;
}
function polyLength(pts: V3[]): number {
  const c = cumulative(pts);
  return c[c.length - 1];
}
function sample(pts: V3[], cum: number[], d: number, out: V3) {
  let k = 1;
  while (k < cum.length - 1 && cum[k] < d) k++;
  const seg = cum[k] - cum[k - 1] || 1;
  out.lerpVectors(pts[k - 1], pts[k], Math.min(1, Math.max(0, (d - cum[k - 1]) / seg)));
}
function midpoint(pts: V3[]): V3 {
  const cum = cumulative(pts);
  const out = new THREE.Vector3();
  sample(pts, cum, cum[cum.length - 1] / 2, out);
  return out;
}
