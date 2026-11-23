export type Ease = (t: number) => number;

export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic: Ease = (t) => t * t * t;
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack: Ease = (t) => {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Tween {
  start: number;
  dur: number;
  ease: Ease;
  fn: (k: number) => void;
  done?: () => void;
}

/** Minimal frame-driven tween list. `delay` postpones the start; dur 0 applies the end state at once. */
export class Tweens {
  private list: Tween[] = [];

  add(dur: number, fn: (k: number) => void, ease: Ease = easeInOutCubic, done?: () => void, delay = 0) {
    if (dur <= 0 && delay <= 0) {
      fn(1);
      done?.();
      return;
    }
    this.list.push({ start: performance.now() + delay, dur: Math.max(1, dur), ease, fn, done });
  }

  tick(now: number) {
    if (!this.list.length) return;
    const keep: Tween[] = [];
    for (const t of this.list) {
      if (now < t.start) { keep.push(t); continue; }
      const k = Math.min(1, (now - t.start) / t.dur);
      t.fn(t.ease(k));
      if (k < 1) keep.push(t);
      else t.done?.();
    }
    this.list = keep;
  }
}
