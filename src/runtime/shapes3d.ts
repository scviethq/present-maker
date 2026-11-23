import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Footprint (world units) for each node size. One grid unit = one world unit. */
export const FOOT = { s: 0.6, m: 0.8, l: 1.1 } as const;

export interface ShapeBuild {
  group: THREE.Group;
  /** height of the top surface */
  top: number;
  /** a flat top face exists for an icon decal; its usable side length */
  decal?: { size: number; y: number; rot?: number };
}

const DEFAULT_COLOR: Record<string, string> = {
  box: '#d9c8a9', server: '#3b6fd8', database: '#1f9e8f', queue: '#7d5bd6', gateway: '#3a3631',
  cloud: '#9fb4d6', device: '#3a3631', person: '#e2572b', team: '#e2572b', document: '#f2ede4',
  decision: '#e0a526', building: '#8a8580', sphere: '#d4589a', cylinder: '#4f9d3a', cone: '#e0a526', plate: '#d9c8a9',
};
export function defaultColor(shape: string): string {
  return DEFAULT_COLOR[shape] ?? '#d9c8a9';
}

function mat(color: THREE.ColorRepresentation): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, transparent: true });
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  me.receiveShadow = true;
  return me;
}

const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, h / 2.01, w / 2.01, d / 2.01));

function shade(color: string, k: number): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k)));
}

/** Build a node's 3D body. `f` = footprint side length. Origin at ground centre. */
export function buildShape(shape: string, color: string, f: number): ShapeBuild {
  const g = new THREE.Group();
  const main = mat(color);
  const dark = mat(shade(color, -0.18));
  const light = mat(shade(color, 0.22));
  const add = (o: THREE.Object3D) => (g.add(o), o);

  switch (shape) {
    case 'server': {
      const h = 0.2 * f;
      for (let i = 0; i < 3; i++) {
        const y = h / 2 + i * (h + 0.035 * f);
        add(mesh(rbox(f, h, f, 0.03), main, 0, y));
        // status LEDs on the camera-facing (+x) side
        add(mesh(new THREE.BoxGeometry(0.01, h * 0.22, f * 0.35), mat('#9ff2c0'), f / 2 + 0.004, y, f * 0.2));
      }
      const top = 3 * h + 2 * 0.035 * f;
      return { group: g, top, decal: { size: f * 0.8, y: top } };
    }
    case 'database': {
      const r = 0.42 * f, h = 0.2 * f, gap = 0.035 * f;
      for (let i = 0; i < 3; i++) add(mesh(new THREE.CylinderGeometry(r, r, h, 40), i % 2 ? light : main, 0, h / 2 + i * (h + gap)));
      const top = 3 * h + 2 * gap;
      return { group: g, top, decal: { size: r * 1.35, y: top } };
    }
    case 'queue': {
      const len = 1.3 * f, d = 0.55 * f, h = 0.3 * f;
      add(mesh(rbox(len, h, d, 0.05), main, 0, h / 2));
      for (let i = 1; i < 5; i++) add(mesh(new THREE.BoxGeometry(0.015, h * 0.75, d + 0.004), dark, -len / 2 + (i * len) / 5, h / 2));
      return { group: g, top: h, decal: { size: d * 0.8, y: h } };
    }
    case 'gateway': {
      const h = 0.22 * f;
      add(mesh(rbox(f * 1.05, h, f * 1.05, 0.06), main, 0, h / 2));
      add(mesh(rbox(f * 0.7, h * 0.35, f * 0.7, 0.03), light, 0, h + h * 0.175));
      const top = h * 1.35;
      return { group: g, top, decal: { size: f * 0.6, y: top } };
    }
    case 'cloud': {
      const base = 0.12 * f;
      add(mesh(rbox(f, base, f * 0.8, 0.05), dark, 0, base / 2));
      const puffs: [number, number, number, number][] = [
        [0, 0.32, 0, 0.3], [-0.26, 0.24, 0.08, 0.22], [0.26, 0.24, -0.04, 0.24], [0.05, 0.22, 0.24, 0.2], [-0.05, 0.22, -0.24, 0.2],
      ];
      for (const [x, y, z, r] of puffs) add(mesh(new THREE.SphereGeometry(r * f, 24, 16), main, x * f, y * f, z * f));
      return { group: g, top: 0.62 * f };
    }
    case 'device': {
      add(mesh(rbox(f * 0.9, 0.05 * f, f * 0.7, 0.02), main, 0, 0.025 * f));
      const screen = add(mesh(rbox(f * 0.9, f * 0.6, 0.05 * f, 0.02), main, 0, 0.35 * f, -f * 0.3));
      add(mesh(new THREE.BoxGeometry(f * 0.8, f * 0.5, 0.01), mat('#9cc7ff'), 0, 0.35 * f, -f * 0.3 + 0.03 * f));
      void screen;
      return { group: g, top: 0.65 * f };
    }
    case 'person':
    case 'team': {
      const people: [number, number][] = shape === 'team' ? [[-0.22, 0.12], [0.22, 0.12], [0, -0.2]] : [[0, 0]];
      const s = shape === 'team' ? 0.75 : 1;
      for (const [x, z] of people) {
        const r = 0.17 * f * s;
        add(mesh(new THREE.CapsuleGeometry(r, 0.32 * f * s, 6, 20), main, x * f, r + 0.16 * f * s, z * f));
        add(mesh(new THREE.SphereGeometry(0.14 * f * s, 24, 16), light, x * f, 0.7 * f * s, z * f));
      }
      return { group: g, top: 0.84 * f * s };
    }
    case 'document': {
      const w = f * 0.72, d = f * 0.92, t = 0.04 * f;
      add(mesh(rbox(w, t, d, 0.01), dark, 0.05 * f, t / 2, 0.05 * f));
      add(mesh(rbox(w, t, d, 0.01), main, 0, t * 1.6));
      for (let i = 0; i < 3; i++) add(mesh(new THREE.BoxGeometry(w * 0.6, 0.004, 0.025 * f), mat('#b5aa98'), 0, t * 2.15, d * (0.22 + i * 0.1)));
      return { group: g, top: t * 2.1, decal: { size: w * 0.65, y: t * 2.12 } };
    }
    case 'decision': {
      const s = f * 0.66, h = 0.32 * f;
      const m = add(mesh(rbox(s, h, s, 0.04), main, 0, h / 2));
      m.rotation.y = Math.PI / 4;
      return { group: g, top: h, decal: { size: s * 0.7, y: h } };
    }
    case 'building': {
      const w = f * 0.72, h = f * 1.15;
      add(mesh(rbox(w, h, w, 0.03), main, 0, h / 2));
      const win = mat('#f7e6b5');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const y = h * 0.18 + r * h * 0.2;
        const o = -w / 2 + w * (0.22 + c * 0.28);
        add(mesh(new THREE.BoxGeometry(0.008, h * 0.1, w * 0.14), win, w / 2 + 0.004, y, o));
        add(mesh(new THREE.BoxGeometry(w * 0.14, h * 0.1, 0.008), win, o, y, w / 2 + 0.004));
      }
      return { group: g, top: h, decal: { size: w * 0.75, y: h } };
    }
    case 'sphere': {
      const r = 0.4 * f;
      add(mesh(new THREE.SphereGeometry(r, 40, 28), main, 0, r));
      return { group: g, top: 2 * r };
    }
    case 'cylinder': {
      const r = 0.4 * f, h = 0.6 * f;
      add(mesh(new THREE.CylinderGeometry(r, r, h, 40), main, 0, h / 2));
      return { group: g, top: h, decal: { size: r * 1.35, y: h } };
    }
    case 'cone': {
      const r = 0.42 * f, h = 0.8 * f;
      add(mesh(new THREE.ConeGeometry(r, h, 40), main, 0, h / 2));
      return { group: g, top: h };
    }
    case 'plate': {
      const h = 0.08 * f;
      add(mesh(rbox(f, h, f, 0.03), main, 0, h / 2));
      return { group: g, top: h, decal: { size: f * 0.7, y: h } };
    }
    case 'box':
    default: {
      const h = 0.5 * f;
      add(mesh(rbox(f, h, f, 0.05), main, 0, h / 2));
      return { group: g, top: h, decal: { size: f * 0.7, y: h } };
    }
  }
}

/** True when white reads better than ink on this colour. */
export function prefersLightInk(color: string): boolean {
  const c = new THREE.Color(color);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lum < 0.45;
}
