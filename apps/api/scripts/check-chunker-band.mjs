// T-3.4-06 / T-3.4-08. Runs the built chunker over the whole seed corpus and reports the token
// band, the overlap, and whether every chunk's offsets slice its own text back out of the source.
//   docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
//     ingest-worker apps/api/scripts/check-chunker-band.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Chunker } = require('../dist/modules/ingestion/chunker.js');
const { createTokenCounter } = require('../dist/modules/ingestion/token-counter.js');

const config = {
  MODEL_CACHE_DIR: process.env.MODEL_CACHE_DIR ?? '/models',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? 'BAAI/bge-m3',
  CHUNK_TOKEN_COUNTER: process.env.CHUNK_TOKEN_COUNTER ?? 'tokenizer',
  CHUNK_CHARS_PER_TOKEN: Number(process.env.CHUNK_CHARS_PER_TOKEN ?? 3.916),
  CHUNK_MIN_TOKENS: Number(process.env.CHUNK_MIN_TOKENS ?? 200),
  CHUNK_MAX_TOKENS: Number(process.env.CHUNK_MAX_TOKENS ?? 400),
  CHUNK_OVERLAP_RATIO: Number(process.env.CHUNK_OVERLAP_RATIO ?? 0.15),
};

const counter = createTokenCounter(config);
const chunker = new Chunker(counter, config);
const dir = new URL('../src/database/corpus/', import.meta.url).pathname;
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort();

let chunks = 0;
let over = 0;
let underNotLast = 0;
let roundTripFailures = 0;
let headingless = 0;
const counts = [];
const overlaps = [];
const finalOverlaps = [];
const started = Date.now();

for (const file of files) {
  const source = readFileSync(join(dir, file), 'utf8');
  const produced = chunker.chunk(source);
  produced.forEach((c, i) => {
    chunks += 1;
    counts.push(c.tokenCount);
    if (c.tokenCount > config.CHUNK_MAX_TOKENS) {
      over += 1;
      console.log(`  OVER  ${file}#${i} ${c.tokenCount}`);
    }
    if (c.tokenCount < config.CHUNK_MIN_TOKENS && i !== produced.length - 1) {
      underNotLast += 1;
      console.log(`  UNDER ${file}#${i} ${c.tokenCount}`);
    }
    if (source.slice(c.charStart, c.charEnd) !== c.text) {
      roundTripFailures += 1;
      console.log(`  SLICE ${file}#${i}`);
    }
    if (c.headingPath === null) headingless += 1;
    if (i > 0) {
      const previous = produced[i - 1];
      const shared = source.slice(c.charStart, previous.charEnd);
      const ratio = (shared.length === 0 ? 0 : counter.count(shared)) / previous.tokenCount;
      // The last chunk of a document reaches back on purpose to clear the minimum, so it is not
      // evidence about the stride and is reported on its own line.
      (i === produced.length - 1 ? finalOverlaps : overlaps).push(ratio);
    }
  });
  // Nothing may be dropped: the chunks must cover the source from the first block to the last.
  if (produced.length > 0) {
    const covered = produced[produced.length - 1].charEnd - produced[0].charStart;
    if (covered < source.trim().length - 2) {
      console.log(`  GAP   ${file} covered ${covered} of ${source.length}`);
    }
  }
}

const sorted = [...counts].sort((a, b) => a - b);
const mean = (xs) => xs.reduce((s, n) => s + n, 0) / xs.length;
console.log(`files                 ${files.length}`);
console.log(`chunks                ${chunks}  (${(chunks / files.length).toFixed(1)} per file)`);
console.log(
  `tokens                min ${sorted[0]}  median ${sorted[Math.floor(sorted.length / 2)]}  max ${sorted[sorted.length - 1]}`,
);
console.log(`over ${config.CHUNK_MAX_TOKENS}              ${over}`);
console.log(`under ${config.CHUNK_MIN_TOKENS}, not last    ${underNotLast}`);
console.log(`offset round-trip     ${roundTripFailures} failures of ${chunks}`);
console.log(`heading_path absent   ${headingless} of ${chunks}`);
console.log(
  `overlap, stride       mean ${(mean(overlaps) * 100).toFixed(1)}%  (target ${(config.CHUNK_OVERLAP_RATIO * 100).toFixed(0)}%, n=${overlaps.length})`,
);
console.log(
  `overlap, final chunk  mean ${(mean(finalOverlaps) * 100).toFixed(1)}%  (reaches back to clear the minimum, n=${finalOverlaps.length})`,
);
console.log(`elapsed               ${Date.now() - started} ms`);
process.exit(over + underNotLast + roundTripFailures === 0 ? 0 : 1);
