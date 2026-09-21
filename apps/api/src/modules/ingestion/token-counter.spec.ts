import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import {
  CharacterRatioTokenCounter,
  createTokenCounter,
  XlmRobertaTokenCounter,
} from './token-counter';

const MODEL = 'BAAI/bge-m3';

// A three-word vocabulary is enough to prove the counter reaches a real tokenizer: shipping
// XLM-RoBERTa's own 17 MB file to assert a number is a fixture nobody would read.
// WhitespaceSplit, not Whitespace: the latter splits on \w, which is not Unicode-aware, so it
// cuts `chào` into `ch`, `à`, `o` and every assertion below would be off by two.
const MINIMAL_TOKENIZER = {
  version: '1.0',
  truncation: null,
  padding: null,
  added_tokens: [],
  normalizer: null,
  pre_tokenizer: { type: 'WhitespaceSplit' },
  post_processor: null,
  decoder: null,
  model: { type: 'WordLevel', vocab: { xin: 0, chào: 1, '[UNK]': 2 }, unk_token: '[UNK]' },
};

const created: string[] = [];

afterEach(() => {
  while (created.length > 0) rmSync(created.pop()!, { recursive: true, force: true });
});

function cacheWithSnapshots(snapshots: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'hf-cache-'));
  created.push(root);
  const base = join(root, 'hub', `models--${MODEL.replace(/\//g, '--')}`, 'snapshots');
  snapshots.forEach((name, index) => {
    const dir = join(base, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'tokenizer.json'), JSON.stringify(MINIMAL_TOKENIZER));
    writeFileSync(
      join(dir, 'tokenizer_config.json'),
      JSON.stringify({ tokenizer_class: 'PreTrainedTokenizerFast' }),
    );
    // Oldest first, so the last snapshot named is always the newest on disk.
    const when = new Date(2026, 0, 1 + index);
    utimesSync(dir, when, when);
  });
  return root;
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    MODEL_CACHE_DIR: '/nonexistent',
    EMBEDDING_MODEL: MODEL,
    CHUNK_TOKEN_COUNTER: 'tokenizer',
    CHUNK_CHARS_PER_TOKEN: 3.5,
    ...overrides,
  } as Env;
}

describe('CharacterRatioTokenCounter', () => {
  it('divides the character count by the configured ratio', () => {
    const counter = new CharacterRatioTokenCounter(env({ CHUNK_CHARS_PER_TOKEN: 4 }));
    expect(counter.count('x'.repeat(400))).toBe(100);
  });

  it('rounds rather than truncates', () => {
    const counter = new CharacterRatioTokenCounter(env({ CHUNK_CHARS_PER_TOKEN: 4 }));
    expect(counter.count('x'.repeat(10))).toBe(3);
  });

  it('never reports fewer than one token for text that exists', () => {
    const counter = new CharacterRatioTokenCounter(env({ CHUNK_CHARS_PER_TOKEN: 100 }));
    expect(counter.count('a')).toBe(1);
  });

  it('counts characters, so Vietnamese diacritics do not change the arithmetic', () => {
    const counter = new CharacterRatioTokenCounter(env({ CHUNK_CHARS_PER_TOKEN: 1 }));
    expect(counter.count('hợp đồng')).toBe('hợp đồng'.length);
  });
});

describe('XlmRobertaTokenCounter', () => {
  it('counts through the cached tokenizer', () => {
    const counter = new XlmRobertaTokenCounter(
      env({ MODEL_CACHE_DIR: cacheWithSnapshots(['a1']) }),
    );
    expect(counter.count('xin chào xin')).toBe(3);
  });

  it('counts a diacritic-bearing word as the one token it is', () => {
    const counter = new XlmRobertaTokenCounter(
      env({ MODEL_CACHE_DIR: cacheWithSnapshots(['a1']) }),
    );
    expect(counter.count('chào')).toBe(1);
  });

  it('reuses the tokenizer it built on the first call', () => {
    const counter = new XlmRobertaTokenCounter(
      env({ MODEL_CACHE_DIR: cacheWithSnapshots(['a1']) }),
    );
    expect(counter.count('xin')).toBe(1);
    expect(counter.count('xin chào')).toBe(2);
  });

  it('reads the newest snapshot, not the one whose hash sorts first', () => {
    // 'zz' is written last and so is the newest; sorting by name would choose 'aa'.
    const cache = cacheWithSnapshots(['aa', 'zz']);
    const base = join(cache, 'hub', `models--${MODEL.replace(/\//g, '--')}`, 'snapshots');
    writeFileSync(
      join(base, 'zz', 'tokenizer.json'),
      JSON.stringify({
        ...MINIMAL_TOKENIZER,
        model: { ...MINIMAL_TOKENIZER.model, vocab: { 'xin chào': 0, '[UNK]': 1 } },
      }),
    );
    const counter = new XlmRobertaTokenCounter(env({ MODEL_CACHE_DIR: cache }));
    // The newest vocabulary has no entry for the bare words, so both fall back to [UNK].
    expect(counter.count('xin chào')).toBe(2);
  });

  it('builds without touching the cache, so a process that never chunks can boot', () => {
    // The API container does not mount the model cache on purpose. Only the worker chunks.
    expect(() => new XlmRobertaTokenCounter(env())).not.toThrow();
  });

  it('names the directory it looked in when no snapshot is cached', () => {
    const counter = new XlmRobertaTokenCounter(env());
    expect(() => counter.count('xin')).toThrow(/No cached weights for BAAI\/bge-m3/);
  });

  it('names the directory when the cache exists but holds no snapshot', () => {
    const root = mkdtempSync(join(tmpdir(), 'hf-cache-'));
    created.push(root);
    mkdirSync(join(root, 'hub', `models--${MODEL.replace(/\//g, '--')}`, 'snapshots'), {
      recursive: true,
    });
    const counter = new XlmRobertaTokenCounter(env({ MODEL_CACHE_DIR: root }));
    expect(() => counter.count('xin')).toThrow(/No snapshot for BAAI\/bge-m3/);
  });

  it('refuses a tokenizer file that is not a JSON object', () => {
    const cache = cacheWithSnapshots(['a1']);
    const base = join(cache, 'hub', `models--${MODEL.replace(/\//g, '--')}`, 'snapshots', 'a1');
    writeFileSync(join(base, 'tokenizer.json'), '"not an object"');
    const counter = new XlmRobertaTokenCounter(env({ MODEL_CACHE_DIR: cache }));
    expect(() => counter.count('xin')).toThrow(/Expected a JSON object/);
  });
});

describe('createTokenCounter', () => {
  it('builds the ratio counter when configuration asks for it', () => {
    expect(createTokenCounter(env({ CHUNK_TOKEN_COUNTER: 'ratio' }))).toBeInstanceOf(
      CharacterRatioTokenCounter,
    );
  });

  it('builds the tokenizer counter by default', () => {
    const counter = createTokenCounter(env({ MODEL_CACHE_DIR: cacheWithSnapshots(['a1']) }));
    expect(counter).toBeInstanceOf(XlmRobertaTokenCounter);
  });
});
