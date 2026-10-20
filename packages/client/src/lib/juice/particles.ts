import { settings } from './settings.svelte';
import { PARTICLE_BUDGET } from './timing';

// Spec S16: a small canvas overlay for bursts. Runs only while particles are alive.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

/** A glowing orb travelling along a curve (a won trick heading to its score bar). */
interface Comet {
  from: { x: number; y: number };
  to: { x: number; y: number };
  start: number;
  duration: number;
  color: string;
  trail: { x: number; y: number }[];
  onArrive: () => void;
}

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let comets: Comet[] = [];
let running = false;

export function attachParticleCanvas(el: HTMLCanvasElement): () => void {
  canvas = el;
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = innerWidth * dpr;
    el.height = innerHeight * dpr;
    el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  return () => {
    removeEventListener('resize', resize);
    canvas = null;
  };
}

/** Throw `count` particles outward from (x, y) in screen pixels. */
export function burst(x: number, y: number, count: number, colors: readonly string[]): void {
  if (!canvas || !settings.motion || count <= 0) return;
  const room = Math.max(0, PARTICLE_BUDGET - particles.length);
  for (let i = 0; i < Math.min(count, room); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    const max = 40 + Math.random() * 30;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: max,
      max,
      size: 2 + Math.random() * 3,
      color: colors[i % colors.length]!,
    });
  }
  start();
}

/**
 * Send an orb from one screen point to another; `onArrive` runs when it lands (or at once
 * when motion effects are off, so the score still updates).
 */
export function comet(from: { x: number; y: number }, to: { x: number; y: number }, duration: number, color: string, onArrive: () => void): void {
  if (!canvas || !settings.motion) return onArrive();
  comets.push({ from, to, start: performance.now(), duration, color, trail: [], onArrive });
  start();
}

function start(): void {
  if (!running) {
    running = true;
    requestAnimationFrame(step);
  }
}

function drawComets(c: CanvasRenderingContext2D, now: number): void {
  const arrived: Comet[] = [];
  for (const k of comets) {
    const t = Math.min(1, (now - k.start) / k.duration);
    const e = t * t * (3 - 2 * t);
    // Arc upward a little on the way, like a thrown chip.
    const lift = Math.min(80, Math.abs(k.to.x - k.from.x) * 0.3 + 30);
    const x = k.from.x + (k.to.x - k.from.x) * e;
    const y = k.from.y + (k.to.y - k.from.y) * e - Math.sin(Math.PI * e) * lift;
    k.trail.push({ x, y });
    if (k.trail.length > 10) k.trail.shift();
    k.trail.forEach((p, i) => {
      c.globalAlpha = ((i + 1) / k.trail.length) * 0.5;
      c.fillStyle = k.color;
      c.beginPath();
      c.arc(p.x, p.y, 2 + i * 0.4, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;
    c.shadowColor = k.color;
    c.shadowBlur = 14;
    c.fillStyle = '#fffbe8';
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    if (t >= 1) arrived.push(k);
  }
  if (arrived.length) {
    comets = comets.filter((k) => !arrived.includes(k));
    for (const k of arrived) {
      burst(k.to.x, k.to.y, 10, [k.color, '#fffbe8']);
      k.onArrive();
    }
  }
}

function step(): void {
  const c = canvas?.getContext('2d');
  if (!canvas || !c) {
    running = false;
    particles = [];
    const pending = comets;
    comets = [];
    pending.forEach((k) => k.onArrive());
    return;
  }
  c.clearRect(0, 0, canvas.width, canvas.height);
  drawComets(c, performance.now());
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.vx *= 0.98;
    p.life -= 1;
    c.globalAlpha = Math.max(0, p.life / p.max);
    c.fillStyle = p.color;
    c.fillRect(p.x, p.y, p.size, p.size);
  }
  c.globalAlpha = 1;
  if (particles.length > 0 || comets.length > 0) requestAnimationFrame(step);
  else running = false;
}
