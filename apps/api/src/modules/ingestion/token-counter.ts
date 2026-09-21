import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';

export const TOKEN_COUNTER = Symbol('TOKEN_COUNTER');

// "200-400 tokens" means nothing unless the chunker counts the same way BGE-M3 does. D-5 settled
// which counter is used by measurement: see docs/ops/d5-token-counting.md.
export interface TokenCounter {
  count(text: string): number;
}

// Hugging Face lays its cache out as hub/models--<org>--<name>/snapshots/<commit>/.
function snapshotsDirectory(cacheDir: string, model: string): string {
  return join(cacheDir, 'hub', `models--${model.replace(/\//g, '--')}`, 'snapshots');
}

function readJsonObject(path: string): object {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Expected a JSON object in ${path}`);
  }
  return parsed;
}

// The newest snapshot rather than the first one sorted: commit hashes carry no order, so a
// second revision pulled later would otherwise be shadowed by whichever hash sorts lower.
function resolveSnapshot(cacheDir: string, model: string): string {
  const snapshots = snapshotsDirectory(cacheDir, model);
  if (!existsSync(snapshots)) {
    throw new Error(`No cached weights for ${model} under ${snapshots}`);
  }
  const newest = readdirSync(snapshots)
    .map((entry) => join(snapshots, entry))
    .map((path) => ({ path, modified: statSync(path).mtimeMs }))
    .sort((a, b) => b.modified - a.modified)[0];
  if (newest === undefined) {
    throw new Error(`No snapshot for ${model} under ${snapshots}`);
  }
  return newest.path;
}

// The count includes the two special tokens BGE-M3 prepends and appends, because the budget a
// chunk has to fit inside is the model's, not the tokenizer's.
@Injectable()
export class XlmRobertaTokenCounter implements TokenCounter {
  private tokenizer?: Tokenizer;

  constructor(@Inject(CONFIG) private readonly config: Env) {}

  // Nothing touches the model cache until the first count, the snapshot lookup included. Only the
  // worker mounts that cache, and both processes boot the same module graph: resolving it in the
  // constructor took the API down at boot over a directory it is never meant to have. A cache that
  // is missing where it is needed surfaces as a failed ingestion job, with the path in the reason.
  private load(): Tokenizer {
    if (this.tokenizer === undefined) {
      const snapshot = resolveSnapshot(this.config.MODEL_CACHE_DIR, this.config.EMBEDDING_MODEL);
      const read = (file: string): object => readJsonObject(join(snapshot, file));
      this.tokenizer = new Tokenizer(read('tokenizer.json'), read('tokenizer_config.json'));
    }
    return this.tokenizer;
  }

  count(text: string): number {
    return this.load().encode(text).ids.length;
  }
}

// D-5's fallback, kept reachable through configuration rather than kept as code nobody can run.
@Injectable()
export class CharacterRatioTokenCounter implements TokenCounter {
  private readonly charsPerToken: number;

  constructor(@Inject(CONFIG) config: Env) {
    this.charsPerToken = config.CHUNK_CHARS_PER_TOKEN;
  }

  count(text: string): number {
    return Math.max(1, Math.round(text.length / this.charsPerToken));
  }
}

export function createTokenCounter(config: Env): TokenCounter {
  return config.CHUNK_TOKEN_COUNTER === 'ratio'
    ? new CharacterRatioTokenCounter(config)
    : new XlmRobertaTokenCounter(config);
}
