import { describe, expect, it } from 'vitest';
import {
  aboveFloor,
  fuse,
  keepTop,
  maxFusedScore,
  normalise,
  type RankedCandidate,
  RRF_K,
  rrfScore,
} from './rank-fusion';

const ranked = (...ids: string[]): RankedCandidate[] =>
  ids.map((id, index) => ({ id, rank: index + 1 }));

describe('rrfScore', () => {
  it('is 1/(k + rank)', () => {
    expect(rrfScore(1, 60)).toBeCloseTo(1 / 61, 10);
    expect(rrfScore(10, 60)).toBeCloseTo(1 / 70, 10);
  });

  it('falls as the rank worsens', () => {
    expect(rrfScore(1)).toBeGreaterThan(rrfScore(2));
    expect(rrfScore(2)).toBeGreaterThan(rrfScore(60));
  });

  it('defaults to the k of 60 that design §6.1 fixes', () => {
    expect(RRF_K).toBe(60);
    expect(rrfScore(1)).toBe(rrfScore(1, 60));
  });
});

describe('maxFusedScore', () => {
  it('is what a chunk ranked first by both branches scores', () => {
    expect(maxFusedScore(60)).toBeCloseTo(2 / 61, 10);
  });

  it('is the ceiling no fusion can pass', () => {
    const [best] = fuse(ranked('a', 'b'), ranked('a', 'b'));
    expect(best!.score).toBeLessThanOrEqual(maxFusedScore());
    expect(best!.score).toBeCloseTo(maxFusedScore(), 10);
  });
});

describe('normalise', () => {
  it('puts the best possible score at 1', () => {
    expect(normalise(maxFusedScore())).toBeCloseTo(1, 10);
  });

  it('puts nothing at 0', () => {
    expect(normalise(0)).toBe(0);
  });

  it('keeps a single-branch first place below a half, because it agrees with nobody', () => {
    expect(normalise(rrfScore(1))).toBeCloseTo(0.5, 10);
  });
});

describe('fuse', () => {
  it('finds nothing in two empty branches', () => {
    expect(fuse([], [])).toEqual([]);
  });

  it('adds both branches for a chunk they both found', () => {
    const [top] = fuse(ranked('a'), ranked('a'));
    expect(top!.score).toBeCloseTo(rrfScore(1) * 2, 10);
  });

  it('keeps a chunk only one branch found', () => {
    const fused = fuse(ranked('a'), ranked('b'));
    expect(fused.map((candidate) => candidate.id).sort()).toEqual(['a', 'b']);
  });

  it('ranks agreement above a better rank in one branch alone', () => {
    // `b` is first in the dense branch and nowhere else; `a` is second in both.
    const fused = fuse(ranked('b', 'a'), ranked('c', 'a'));
    expect(fused[0]!.id).toBe('a');
  });

  it('breaks a tie by id, so the order is the same on every run', () => {
    const forwards = fuse(ranked('b', 'a'), ranked('a', 'b'));
    const backwards = fuse(ranked('a', 'b'), ranked('b', 'a'));
    expect(forwards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(backwards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('works from one branch alone, which is what an unmatched question gives', () => {
    const fused = fuse(ranked('a', 'b', 'c'), []);
    expect(fused.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(fused[0]!.score).toBeCloseTo(rrfScore(1), 10);
  });

  it('honours a k it is given rather than the constant', () => {
    expect(fuse(ranked('a'), [], 1)[0]!.score).toBeCloseTo(1 / 2, 10);
  });
});

describe('aboveFloor', () => {
  it('keeps everything when the floor is zero', () => {
    expect(aboveFloor(fuse(ranked('a', 'b'), ranked('b', 'a')), 0)).toHaveLength(2);
  });

  it('drops everything when the floor is one and nothing is perfect', () => {
    expect(aboveFloor(fuse(ranked('a'), ranked('b')), 1)).toHaveLength(0);
  });

  it('keeps a chunk both branches ranked first even at a floor of one', () => {
    expect(aboveFloor(fuse(ranked('a'), ranked('a')), 1)).toHaveLength(1);
  });

  it('compares against the normalised score, not the raw one', () => {
    // The raw best is 0.0328, so a 0.35 floor read against raw scores would empty every result —
    // which is exactly what the configured default would have done.
    expect(aboveFloor(fuse(ranked('a'), ranked('a')), 0.35)).toHaveLength(1);
  });

  it('cuts where the floor falls, so changing it changes the count', () => {
    const fused = fuse(ranked('a', 'b', 'c'), ranked('a'));
    expect(aboveFloor(fused, 0.2).length).toBeGreaterThan(aboveFloor(fused, 0.9).length);
  });
});

describe('keepTop', () => {
  it('keeps at most what it is asked for', () => {
    expect(keepTop([1, 2, 3, 4], 2)).toEqual([1, 2]);
  });

  it('keeps everything when there is less than the limit', () => {
    expect(keepTop([1], 8)).toEqual([1]);
  });

  it('keeps nothing rather than throwing on a nonsensical limit', () => {
    expect(keepTop([1, 2], -1)).toEqual([]);
  });
});
