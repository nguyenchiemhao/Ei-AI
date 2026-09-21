import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { Chunker, chunkerVersion } from './chunker';
import type { TokenCounter } from './token-counter';

// One word, one token: deterministic, monotonic in length, and it keeps the arithmetic in these
// tests readable. The real tokenizer is exercised over the corpus by scripts/check-chunker-band.mjs.
const words: TokenCounter = { count: (text) => (text.match(/\S+/g) ?? []).length };

function env(overrides: Partial<Env> = {}): Env {
  return {
    CHUNK_MIN_TOKENS: 10,
    CHUNK_MAX_TOKENS: 20,
    CHUNK_OVERLAP_RATIO: 0.15,
    CHUNK_TOKEN_COUNTER: 'tokenizer',
    CHUNK_CHARS_PER_TOKEN: 3.916,
    ...overrides,
  } as Env;
}

function chunkerWith(overrides: Partial<Env> = {}, counter: TokenCounter = words): Chunker {
  return new Chunker(counter, env(overrides));
}

// `n` blocks of `size` words each, separated by blank lines.
function paragraphs(n: number, size: number): string {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: size }, (_, w) => `p${i}w${w}`).join(' '),
  ).join('\n\n');
}

describe('chunkerVersion', () => {
  it('names the tokenizer when the tokenizer counts', () => {
    expect(chunkerVersion(env())).toBe('v1-tokenizer');
  });

  it('records the ratio when the approximation counts, since the split differs', () => {
    expect(chunkerVersion(env({ CHUNK_TOKEN_COUNTER: 'ratio' }))).toBe('v1-ratio@3.916');
  });
});

describe('Chunker', () => {
  it('produces nothing for an empty source', () => {
    expect(chunkerWith().chunk('')).toEqual([]);
  });

  it('produces nothing for whitespace alone', () => {
    expect(chunkerWith().chunk('\n\n   \n')).toEqual([]);
  });

  it('keeps a short document as a single chunk rather than padding it', () => {
    const source = 'chỉ có vài từ ở đây';
    const [chunk, ...rest] = chunkerWith().chunk(source);
    expect(rest).toHaveLength(0);
    expect(chunk!.text).toBe(source);
    expect(chunk!.tokenCount).toBe(6);
  });

  it('never exceeds the maximum', () => {
    const source = paragraphs(20, 7);
    for (const chunk of chunkerWith().chunk(source)) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(20);
    }
  });

  it('gives every chunk offsets that slice its own text back out of the source', () => {
    const source = paragraphs(20, 7);
    for (const chunk of chunkerWith().chunk(source)) {
      expect(source.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text);
    }
  });

  it('covers the source from the first block to the last, dropping nothing', () => {
    const source = paragraphs(20, 7);
    const chunks = chunkerWith().chunk(source);
    expect(chunks[0]!.charStart).toBe(0);
    expect(chunks.at(-1)!.charEnd).toBe(source.length);
  });

  it('overlaps each chunk with the one before it', () => {
    const chunks = chunkerWith().chunk(paragraphs(20, 7));
    expect(chunks.length).toBeGreaterThan(2);
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]!.charStart).toBeLessThan(chunks[i - 1]!.charEnd);
    }
  });

  it('advances even when one block already fills the whole budget', () => {
    // Each block is exactly the maximum, so nothing can be carried and progress is the only option.
    const chunks = chunkerWith().chunk(paragraphs(5, 20));
    expect(chunks).toHaveLength(5);
    expect(new Set(chunks.map((c) => c.charStart)).size).toBe(5);
  });

  it('splits a block that is longer than the budget on its own', () => {
    const source = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkerWith().chunk(source);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.tokenCount).toBeLessThanOrEqual(20);
    expect(chunks.map((c) => c.text).join('')).toBe(source);
  });

  it('carries the heading trail of the block a chunk starts on', () => {
    const source = `# Hợp đồng\n\n## Điều 1\n\n${paragraphs(2, 5)}`;
    expect(chunkerWith().chunk(source)[0]!.headingPath).toBe('Hợp đồng');
  });

  it('leaves heading_path null when nothing above the chunk is a heading', () => {
    expect(chunkerWith().chunk(paragraphs(2, 5))[0]!.headingPath).toBeNull();
  });

  it('reaches further back so the final chunk is not a fragment', () => {
    // 21 blocks of two words: the tail would otherwise be the last block alone.
    const chunks = chunkerWith({ CHUNK_MIN_TOKENS: 10, CHUNK_MAX_TOKENS: 40 }).chunk(
      paragraphs(21, 2),
    );
    expect(chunks.at(-1)!.tokenCount).toBeGreaterThanOrEqual(10);
  });

  it('still ends at the end of the source after reaching back', () => {
    const source = paragraphs(21, 2);
    const chunks = chunkerWith({ CHUNK_MIN_TOKENS: 10, CHUNK_MAX_TOKENS: 40 }).chunk(source);
    expect(chunks.at(-1)!.charEnd).toBe(source.length);
    expect(source.slice(chunks.at(-1)!.charStart, chunks.at(-1)!.charEnd)).toBe(
      chunks.at(-1)!.text,
    );
  });

  it('never reaches back past where the previous chunk began', () => {
    const chunks = chunkerWith({ CHUNK_MIN_TOKENS: 18, CHUNK_MAX_TOKENS: 20 }).chunk(
      paragraphs(11, 3),
    );
    expect(chunks.at(-1)!.charStart).toBeGreaterThan(chunks.at(-2)!.charStart);
  });

  it('leaves the final chunk short rather than break the maximum to lengthen it', () => {
    // Blocks of 20 fill the budget exactly, so reaching back by even one would overflow it.
    const source = `${paragraphs(3, 20)}\n\nđuôi ngắn`;
    const chunks = chunkerWith().chunk(source);
    const tail = chunks.at(-1)!;
    expect(tail.tokenCount).toBeLessThanOrEqual(20);
    expect(source.slice(tail.charStart, tail.charEnd)).toBe(tail.text);
  });

  it('never emits a chunk already contained in the one before it', () => {
    // A heading followed by a paragraph that fills the budget on its own: backing up for overlap
    // lands on the heading, which cannot grow past the paragraph, and what comes out would be a
    // strict subset of the chunk just emitted.
    const source = `${paragraphs(1, 14)}\n\n## Tải tài liệu lên\n\n${paragraphs(1, 20)}`;
    const chunks = chunkerWith().chunk(source);
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]!.charEnd).toBeGreaterThan(chunks[i - 1]!.charEnd);
    }
  });

  it('confirms the real slice rather than trusting the sum of its blocks', () => {
    // A counter that charges two extra tokens for a joined slice: the per-block sum says a chunk
    // fits when the whole does not, which is how tokenisation actually behaves across a join.
    const penalising: TokenCounter = {
      count: (text) => words.count(text) + 2 * (text.match(/\n\n/g) ?? []).length,
    };
    for (const chunk of chunkerWith({}, penalising).chunk(paragraphs(12, 6))) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(20);
    }
  });
});
