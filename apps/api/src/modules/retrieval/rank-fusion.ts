// Reciprocal rank fusion, and the one place its arithmetic is written down. The hybrid query
// computes the fused score in SQL, exactly as design §6.1 has it; everything here is either built
// into that SQL (the constant) or applied to what it returns (the scale, the floor, the cut).
// No database and no configuration is imported: a pure function is what makes the ranking testable
// without either.

// RRF's k, not the candidate limit. Both are 60 in design §6.1 and they are different numbers:
// coupling them would make fetching more candidates also change how they are ranked.
export const RRF_K = 60;

export interface RankedCandidate {
  id: string;
  rank: number;
}

export interface FusedCandidate {
  id: string;
  score: number;
}

export function rrfScore(rank: number, k: number = RRF_K): number {
  return 1 / (k + rank);
}

// A chunk ranked first by both branches. Nothing can score higher, which is what gives the
// configured 0–1 floor a scale to mean something against.
export function maxFusedScore(k: number = RRF_K): number {
  return 2 * rrfScore(1, k);
}

export function normalise(score: number, k: number = RRF_K): number {
  return score / maxFusedScore(k);
}

// The reference implementation of what the SQL computes: a full outer join of the two ranked
// lists, each contributing 1/(k + rank), absent from a branch contributing nothing. The
// repository's own test drives this and the query with the same ranks and compares them, so the
// SQL cannot drift from the definition without a test going red.
export function fuse(
  dense: readonly RankedCandidate[],
  lexical: readonly RankedCandidate[],
  k: number = RRF_K,
): FusedCandidate[] {
  const scores = new Map<string, number>();
  for (const branch of [dense, lexical]) {
    for (const candidate of branch) {
      scores.set(candidate.id, (scores.get(candidate.id) ?? 0) + rrfScore(candidate.rank, k));
    }
  }
  // Ties are broken by id so that two chunks with the same score come back in the same order on
  // every run. An unstable order turns a passing assertion into a coin toss.
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function aboveFloor<T extends { score: number }>(
  candidates: readonly T[],
  floor: number,
  k: number = RRF_K,
): T[] {
  return candidates.filter((candidate) => normalise(candidate.score, k) >= floor);
}

export function keepTop<T>(candidates: readonly T[], keep: number): T[] {
  return candidates.slice(0, Math.max(keep, 0));
}
