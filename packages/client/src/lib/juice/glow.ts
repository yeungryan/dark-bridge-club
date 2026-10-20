// Cached glow sprites for the particle canvas. Drawing a pre-rendered radial gradient with
// drawImage is far cheaper on phones than per-particle shadowBlur, and with 'lighter'
// compositing overlapping sprites add up into real-looking light.

/** 'hot': white-hot core fading through the colour. 'soft': the colour only (washes, halos). 'star': a four-point glint. */
export type GlowKind = 'hot' | 'soft' | 'star';

const MAX_ENTRIES = 64;
/** Sprite resolutions (radius, in device pixels). Sprites are scaled when drawn; gradients survive it. */
const BUCKETS = [12, 32, 96] as const;
/**
 * Small glows are drawn at their sprite's native size, snapped to device pixels: no scaling
 * filter per pixel, which roughly halves their cost on a software canvas. Steps of ~√2.
 */
const NATIVE = [3, 4, 6, 9, 13, 19, 27, 38, 48] as const;

/** A finished sprite: an ImageBitmap where possible (drawing from a live canvas makes the browser snapshot it every time). */
export type Sprite = ImageBitmap | HTMLCanvasElement;
const cache = new Map<string, Sprite>();
let probe: CanvasRenderingContext2D | null = null;
const rgbCache = new Map<string, [number, number, number]>();

/** Parse any CSS colour to [r, g, b] (fast path for #rgb / #rrggbb). */
export function toRgb(color: string): [number, number, number] {
  const hit = rgbCache.get(color);
  if (hit) return hit;
  let out: [number, number, number] = [255, 255, 255];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const h = hex[1]!;
    const full = h.length === 3 ? h.replace(/./g, (ch) => ch + ch) : h;
    out = [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  } else {
    probe ??= document.createElement('canvas').getContext('2d');
    if (probe) {
      probe.fillStyle = '#fff';
      probe.fillStyle = color;
      const norm = String(probe.fillStyle);
      const m = /^#([0-9a-f]{6})$/i.exec(norm) ?? null;
      if (m) out = [parseInt(m[1]!.slice(0, 2), 16), parseInt(m[1]!.slice(2, 4), 16), parseInt(m[1]!.slice(4, 6), 16)];
      else {
        const nums = norm.match(/[\d.]+/g);
        if (nums && nums.length >= 3) out = [+nums[0]!, +nums[1]!, +nums[2]!];
      }
    }
  }
  if (rgbCache.size > 256) rgbCache.clear();
  rgbCache.set(color, out);
  return out;
}

/** The colour pushed toward white by `t` (0–1): the hot centre of a line. */
export function hotter(color: string, t: number): string {
  const [r, g, b] = toRgb(color);
  const m = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** The radial profile shared by sprites and large gradient glows. */
function addStops(rg: CanvasGradient, kind: GlowKind, color: string): void {
  const [r, gr, b] = toRgb(color);
  const rgba = (a: number) => `rgba(${r},${gr},${b},${a})`;
  if (kind === 'hot') {
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.12, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.25, rgba(0.85));
    rg.addColorStop(0.5, rgba(0.3));
    rg.addColorStop(0.75, rgba(0.08));
    rg.addColorStop(1, rgba(0));
  } else {
    rg.addColorStop(0, rgba(0.9));
    rg.addColorStop(0.3, rgba(0.5));
    rg.addColorStop(0.65, rgba(0.14));
    rg.addColorStop(1, rgba(0));
  }
}

function render(kind: GlowKind, color: string, res: number): Sprite {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const off = new OffscreenCanvas(res * 2, res * 2);
      const g = off.getContext('2d');
      if (g) {
        paint(g, kind, color, res);
        return off.transferToImageBitmap();
      }
    } catch {
      // Fall through to a plain canvas.
    }
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = res * 2;
  const g = cv.getContext('2d');
  if (g) paint(g, kind, color, res);
  return cv;
}

function paint(g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, kind: GlowKind, color: string, res: number): void {
  const [r, gr, b] = toRgb(color);
  const rgba = (a: number) => `rgba(${r},${gr},${b},${a})`;
  if (kind === 'star') {
    // Two thin crossed light streaks plus a tiny core.
    g.translate(res, res);
    for (const rot of [0, Math.PI / 2]) {
      g.save();
      g.rotate(rot);
      const lg = g.createLinearGradient(-res, 0, res, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,1)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(-res, -Math.max(1, res * 0.06), res * 2, Math.max(2, res * 0.12));
      g.restore();
    }
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, res * 0.45);
    cg.addColorStop(0, 'rgba(255,255,255,0.9)');
    cg.addColorStop(0.4, rgba(0.5));
    cg.addColorStop(1, rgba(0));
    g.fillStyle = cg;
    g.fillRect(-res, -res, res * 2, res * 2);
    return;
  }
  const rg = g.createRadialGradient(res, res, 0, res, res, res);
  addStops(rg, kind, color);
  g.fillStyle = rg;
  g.fillRect(0, 0, res * 2, res * 2);
}

/** A cached sprite for drawing a glow of `radius` CSS px; draw it into a (2·radius)² box. */
export function glowSprite(kind: GlowKind, color: string, radius: number, dpr = 1): Sprite {
  const want = radius * dpr;
  return spriteAt(kind, color, BUCKETS.find((b) => b >= want) ?? 96);
}

function spriteAt(kind: GlowKind, color: string, res: number): Sprite {
  const key = `${kind}|${color}|${res}`;
  let s = cache.get(key);
  if (s) return s;
  if (cache.size >= MAX_ENTRIES) {
    // Evict the oldest entry (a Map keeps insertion order) rather than everything, so a
    // colourful moment can't thrash the cache by re-rendering sprites every frame.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      const old = cache.get(oldest);
      if (old && 'close' in old) old.close();
      cache.delete(oldest);
    }
  }
  s = render(kind, color, res);
  cache.set(key, s);
  return s;
}

/** The native sprite radius closest (by ratio) to `want` device px. */
function nativeRes(want: number): number {
  let best: number = NATIVE[0];
  for (const r of NATIVE) if (Math.abs(Math.log(r / want)) < Math.abs(Math.log(best / want))) best = r;
  return best;
}

/** Unit-radius gradients (scaled by the transform when drawn), for big glows. */
const gradients = new Map<string, CanvasGradient>();
/** Above this many device px of radius, a scaled gradient fill beats an upscaled sprite (fill-rate on phones). */
const BIG = 48;

/** Draw a glow centred on (x, y). The caller sets globalAlpha and the composite mode. */
export function drawGlow(c: CanvasRenderingContext2D, kind: GlowKind, color: string, x: number, y: number, radius: number, dpr = 1): void {
  if (radius <= 0.2) return;
  if (kind !== 'star' && radius * dpr > BIG) {
    const key = `${kind}|${color}`;
    let g = gradients.get(key);
    if (!g) {
      if (gradients.size >= MAX_ENTRIES) gradients.clear();
      g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      addStops(g, kind, color);
      gradients.set(key, g);
    }
    c.save();
    c.translate(x, y);
    c.scale(radius, radius);
    c.fillStyle = g;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
    return;
  }
  if (kind === 'star') {
    c.drawImage(glowSprite(kind, color, radius, dpr), x - radius, y - radius, radius * 2, radius * 2);
    return;
  }
  // Native size at whole device pixels (given the context's plain devicePixelRatio
  // transform), so no per-pixel scaling filter runs.
  const res = nativeRes(radius * dpr);
  const d = (2 * res) / dpr;
  c.drawImage(spriteAt(kind, color, res), (Math.round(x * dpr) - res) / dpr, (Math.round(y * dpr) - res) / dpr, d, d);
}

/** For tests and debugging. */
export function glowCacheSize(): number {
  return cache.size;
}
