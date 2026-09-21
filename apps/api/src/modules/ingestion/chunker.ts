import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import type { MarkdownBlock } from './markdown-blocks';
import { splitIntoBlocks } from './markdown-blocks';
import { TOKEN_COUNTER, type TokenCounter } from './token-counter';

export interface Chunk {
  text: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
  headingPath: string | null;
}

const HEADING_SEPARATOR = ' > ';

// Bumped whenever the split changes shape, so a re-index after a chunker change is identifiable.
// The counter is part of it: the same text cut with the ratio and with the tokenizer is not the
// same set of chunks. See docs/ops/d5-token-counting.md.
export function chunkerVersion(config: Env): string {
  return config.CHUNK_TOKEN_COUNTER === 'ratio'
    ? `v1-ratio@${config.CHUNK_CHARS_PER_TOKEN}`
    : 'v1-tokenizer';
}

@Injectable()
export class Chunker {
  private readonly min: number;
  private readonly max: number;
  private readonly overlap: number;

  constructor(
    @Inject(TOKEN_COUNTER) private readonly counter: TokenCounter,
    @Inject(CONFIG) config: Env,
  ) {
    this.min = config.CHUNK_MIN_TOKENS;
    this.max = config.CHUNK_MAX_TOKENS;
    this.overlap = config.CHUNK_OVERLAP_RATIO;
  }

  chunk(source: string): Chunk[] {
    const blocks = splitIntoBlocks(source);
    if (blocks.length === 0) return [];
    const sizes = blocks.map((b) => this.counter.count(source.slice(b.start, b.end)));
    return this.grow(source, blocks, sizes);
  }

  private grow(source: string, blocks: MarkdownBlock[], sizes: number[]): Chunk[] {
    const chunks: Chunk[] = [];
    let first = 0;
    let previousStart = -1;
    let covered = -1;
    while (first < blocks.length) {
      const last = this.lastBlockThatFits(source, blocks, sizes, first);
      if (last < first) {
        chunks.push(...this.splitOversizedBlock(source, blocks[first]!));
        previousStart = first;
        first += 1;
        continue;
      }
      if (last === blocks.length - 1 && previousStart >= 0) {
        first = this.startOfFinal(source, blocks, first, previousStart);
      }
      // The backup for overlap can land on a block the next chunk cannot grow past — a heading
      // followed by a paragraph that already fills the budget. What comes out is then a strict
      // subset of the chunk just emitted, so it is skipped rather than stored twice.
      if (blocks[last]!.end <= covered) {
        first = last + 1;
        continue;
      }
      covered = blocks[last]!.end;
      chunks.push(this.chunkOf(source, blocks[first]!, blocks[last]!));
      if (last === blocks.length - 1) break;
      previousStart = first;
      first = this.startOfNext(sizes, first, last);
    }
    return chunks;
  }

  // What is left at the end of a document is whatever is left, and it is routinely under the
  // minimum. Rather than emit a fragment or pad it, the final chunk reaches further back — it may
  // overlap its predecessor more than the ratio asks, which costs a little duplication and buys a
  // last chunk that is worth retrieving. It never reaches past where the previous chunk began.
  private startOfFinal(
    source: string,
    blocks: MarkdownBlock[],
    first: number,
    previousStart: number,
  ): number {
    const last = blocks.length - 1;
    let start = first;
    while (start > previousStart + 1) {
      const count = this.countBetween(source, blocks[start - 1]!, blocks[last]!);
      // Stop before the step rather than undo it afterwards: a block can be larger than the gap
      // between the minimum and the maximum, so one step back can cross the whole band.
      if (count > this.max) break;
      start -= 1;
      if (count >= this.min) break;
    }
    return start;
  }

  // Grown by the per-block counts, then confirmed against the real slice: tokenisation is not
  // additive across a join, so the sum of the parts can be under the limit while the whole is over.
  private lastBlockThatFits(
    source: string,
    blocks: MarkdownBlock[],
    sizes: number[],
    first: number,
  ): number {
    let last = first - 1;
    let estimate = 0;
    while (last + 1 < blocks.length && estimate + sizes[last + 1]! <= this.max) {
      last += 1;
      estimate += sizes[last]!;
    }
    while (last > first && this.countBetween(source, blocks[first]!, blocks[last]!) > this.max) {
      last -= 1;
    }
    // Shrinking can reach `first` but never below it: the loop above only advanced past `first`
    // when that block's own count already fitted, and `sizes[first]` is that very count.
    return last;
  }

  // Back up over whole blocks to carry roughly the configured share of the chunk into the next
  // one, stopping at whichever boundary lands *nearest* the target rather than at the first one
  // past it — a block is coarse, and always overshooting put the measured overlap at 24% of a
  // wanted 15%. The floor of one block guarantees progress, so a run always terminates.
  private startOfNext(sizes: number[], first: number, last: number): number {
    const total = sizes.slice(first, last + 1).reduce((sum, n) => sum + n, 0);
    const wanted = total * this.overlap;
    let best = last;
    let closest = Math.abs(sizes[last]! - wanted);
    let start = last;
    let carried = sizes[last]!;
    while (start > first + 1 && carried < wanted) {
      start -= 1;
      carried += sizes[start]!;
      const distance = Math.abs(carried - wanted);
      if (distance < closest) {
        closest = distance;
        best = start;
      }
    }
    return Math.max(best, first + 1);
  }

  // A block longer than the whole budget — a table, or a paragraph nobody broke up — is cut on
  // character boundaries found by search, because there is no smaller structure to cut on.
  private splitOversizedBlock(source: string, block: MarkdownBlock): Chunk[] {
    const chunks: Chunk[] = [];
    let start = block.start;
    while (start < block.end) {
      let lo = start + 1;
      let hi = block.end;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (this.counter.count(source.slice(start, mid)) <= this.max) lo = mid;
        else hi = mid - 1;
      }
      chunks.push({
        text: source.slice(start, lo),
        charStart: start,
        charEnd: lo,
        tokenCount: this.counter.count(source.slice(start, lo)),
        headingPath: headingPathOf(block),
      });
      start = lo;
    }
    return chunks;
  }

  private chunkOf(source: string, first: MarkdownBlock, last: MarkdownBlock): Chunk {
    return {
      text: source.slice(first.start, last.end),
      charStart: first.start,
      charEnd: last.end,
      tokenCount: this.countBetween(source, first, last),
      headingPath: headingPathOf(first),
    };
  }

  private countBetween(source: string, first: MarkdownBlock, last: MarkdownBlock): number {
    return this.counter.count(source.slice(first.start, last.end));
  }
}

function headingPathOf(block: MarkdownBlock): string | null {
  return block.headingPath.length === 0 ? null : block.headingPath.join(HEADING_SEPARATOR);
}
