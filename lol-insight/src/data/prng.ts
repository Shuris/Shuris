/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * A mesma semente sempre produz a mesma sequência: os dados demonstrativos
 * são idênticos em toda execução e em todo dispositivo.
 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** Aproximação de normal (soma de uniformes). */
  normal(mean: number, sd: number): number {
    const u = this.next() + this.next() + this.next() + this.next() - 2;
    return mean + u * sd * 1.73;
  }
  weighted<T>(items: ReadonlyArray<{ w: number; v: T }>): T {
    const total = items.reduce((a, b) => a + b.w, 0);
    let r = this.next() * total;
    for (const it of items) {
      r -= it.w;
      if (r <= 0) return it.v;
    }
    return items[items.length - 1].v;
  }
}
