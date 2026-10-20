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

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
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
  if (!running) {
    running = true;
    requestAnimationFrame(step);
  }
}

function step(): void {
  const c = canvas?.getContext('2d');
  if (!canvas || !c) {
    running = false;
    particles = [];
    return;
  }
  c.clearRect(0, 0, canvas.width, canvas.height);
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
  if (particles.length > 0) requestAnimationFrame(step);
  else running = false;
}
