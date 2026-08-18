// Seed-derived deterministic question ordering.
// Pure module: no DB, no side effects at load. Same seed + IDs always yield
// the same order; scoring and question fetch both rely on this determinism.

// FNV-1a constants for 32-bit hash.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_MASK = 0xffffffff;

export function hashSeedToUint32(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) & UINT32_MASK;
  }
  // Avoid the degenerate 0 state for mulberry32.
  return hash >>> 0 || 1;
}

export function mulberry32(a: number): () => number {
  let state = a >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveQuestionOrder(
  seed: string,
  questionIds: string[],
  count: number,
): string[] {
  const rng = mulberry32(hashSeedToUint32(seed));
  const shuffled = [...questionIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
