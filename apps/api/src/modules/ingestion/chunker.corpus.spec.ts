import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { Chunker } from './chunker';
import type { TokenCounter } from './token-counter';

// The seeded corpus, read from the same directory the seed loads into storage.
const CORPUS = join(__dirname, '..', '..', 'database', 'corpus');

// The band itself is verified against the real XLM-RoBERTa tokenizer by
// scripts/check-chunker-band.mjs, which needs the model cache the worker mounts. What this suite
// asserts is the property that must hold whatever the counter says: the offsets resolve.
const words: TokenCounter = { count: (text) => (text.match(/\S+/g) ?? []).length };

function env(): Env {
  return {
    CHUNK_MIN_TOKENS: 60,
    CHUNK_MAX_TOKENS: 120,
    CHUNK_OVERLAP_RATIO: 0.15,
    CHUNK_TOKEN_COUNTER: 'tokenizer',
    CHUNK_CHARS_PER_TOKEN: 3.916,
  } as Env;
}

const files = readdirSync(CORPUS)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .sort();

describe('the seeded corpus', () => {
  it('is present and is not a handful of files', () => {
    expect(files.length).toBeGreaterThanOrEqual(50);
  });

  it('is Vietnamese, so the offsets are exercised on multi-byte characters', () => {
    const everything = files.map((f) => readFileSync(join(CORPUS, f), 'utf8')).join('');
    expect(everything).toMatch(/[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩậắằặẻẽếềểệỉịọỏốồổộớờởợụủứừửữựỳỹ]/i);
  });
});

describe.each(files)('%s', (filename) => {
  const source = readFileSync(join(CORPUS, filename), 'utf8');
  const chunks = new Chunker(words, env()).chunk(source);

  it('produces at least one chunk', () => {
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('slices every chunk back out of the source by its own offsets', () => {
    for (const chunk of chunks) {
      expect(source.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text);
    }
  });

  it('keeps every span forward and inside the source, as chunks_span_valid requires', () => {
    for (const chunk of chunks) {
      expect(chunk.charEnd).toBeGreaterThan(chunk.charStart);
      expect(chunk.charEnd).toBeLessThanOrEqual(source.length);
    }
  });

  it('advances through the document without going backwards', () => {
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]!.charStart).toBeGreaterThan(chunks[i - 1]!.charStart);
      expect(chunks[i]!.charEnd).toBeGreaterThan(chunks[i - 1]!.charEnd);
    }
  });

  it('leaves nothing but whitespace after the last chunk', () => {
    // Not source.length: a block ends with its last line, so a file's trailing newline belongs to
    // no block and falls outside every span. What must not be dropped is text.
    expect(source.slice(chunks.at(-1)!.charEnd).trim()).toBe('');
  });

  it('starts at the first character that is not whitespace', () => {
    expect(source.slice(0, chunks[0]!.charStart).trim()).toBe('');
  });

  it('gives every chunk a heading trail', () => {
    for (const chunk of chunks) expect(chunk.headingPath).not.toBeNull();
  });
});
