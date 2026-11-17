// Copied from scenario-com-landing-page lib/truchet/utils.ts (1ca540be).
// Changes: explicit .ts import paths. Em dashes in comments written as colons (house rule).
/** Deterministic PRNG: fast 32-bit hash. */
export function pseudoRandom(seed: number): number {
  let t = seed + 1_831_565_813;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

/** FNV-like string → 32-bit unsigned int. Used for pattern generation. */
export function hashString(str: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** Java-style hash code: must match fawkes getHashCode for palette selection. */
export function getHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/** Seeded PRNG factory: returns a function that produces deterministic floats 0..1. */
export function createRng(seed: number): () => number {
  let i = 0;
  return function rand(): number {
    i++;
    return pseudoRandom(seed + i);
  };
}

/** Linear interpolation between two RGB arrays. */
export function mix(c1: number[], c2: number[], w: number): number[] {
  return c1.map((c, i) => Math.round(c + (c2[i] - c) * w));
}

export function hexToRgb(hex: string): number[] {
  const match = hex.match(/\w\w/g);
  if (!match || match.length < 3) return [0, 0, 0];
  return match.slice(0, 3).map(c => parseInt(c, 16));
}

export function rgbToHex(rgb: number[]): string {
  const [r, g, b] = rgb;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
