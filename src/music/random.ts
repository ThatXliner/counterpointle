/** Deterministic PRNG so every player gets the same puzzle for the same day. */
export type Rand = () => number

function hash(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

export function seeded(key: string): Rand {
  let a = hash(key)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function choice<T>(rand: Rand, xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)]
}

export function shuffle<T>(rand: Rand, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}

/** Random order where heavier items tend to come first (Efraimidis–Spirakis). */
export function weightedOrder<T>(rand: Rand, xs: readonly T[], weight: (x: T) => number): T[] {
  return xs
    .map((x) => ({ x, key: Math.pow(rand(), 1 / Math.max(weight(x), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .map((e) => e.x)
}
