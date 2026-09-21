// D-5. Measures the XLM-RoBERTa tokenizer against a character-ratio approximation on the seed
// corpus, and reports whether each can hold a window inside the 200-400 token band.
// Run it through ingest-worker, which is the container that mounts the model cache:
//   docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
//     ingest-worker apps/api/scripts/measure-token-counting.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Tokenizer } = require('@huggingface/tokenizers');

const CACHE = process.env.MODEL_CACHE_DIR ?? '/models';
const MODEL = process.env.EMBEDDING_MODEL ?? 'BAAI/bge-m3';
const CORPUS = new URL('../src/database/corpus/', import.meta.url).pathname;
const TARGET = 300;
const MIN = 200;
const MAX = 400;

function snapshot() {
  const base = join(CACHE, 'hub', `models--${MODEL.replace(/\//g, '--')}`, 'snapshots');
  return readdirSync(base)
    .map((e) => join(base, e))
    .map((p) => ({ p, m: statSync(p).mtimeMs }))
    .sort((a, b) => b.m - a.m)[0].p;
}

const snap = snapshot();
const loadStarted = Date.now();
const tokenizer = new Tokenizer(
  JSON.parse(readFileSync(join(snap, 'tokenizer.json'), 'utf8')),
  JSON.parse(readFileSync(join(snap, 'tokenizer_config.json'), 'utf8')),
);
const loadMs = Date.now() - loadStarted;
const count = (text) => tokenizer.encode(text).ids.length;

const files = readdirSync(CORPUS)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort();
const docs = files.map((f) => ({
  name: f,
  genre: f.replace(/-\d+\.md$/, ''),
  text: readFileSync(join(CORPUS, f), 'utf8'),
}));

// --- 1. Calibration: what is a token worth, in characters? ---
const started = Date.now();
for (const d of docs) d.tokens = count(d.text);
const tokenizeMs = Date.now() - started;

const totalChars = docs.reduce((n, d) => n + d.text.length, 0);
const totalTokens = docs.reduce((n, d) => n + d.tokens, 0);
const globalRatio = totalChars / totalTokens;

const byGenre = new Map();
for (const d of docs) {
  const g = byGenre.get(d.genre) ?? { chars: 0, tokens: 0, docs: 0 };
  g.chars += d.text.length;
  g.tokens += d.tokens;
  g.docs += 1;
  byGenre.set(d.genre, g);
}

// --- 2. Windowing: can each counter hold a window inside the band? ---
// The tokenizer sizes a window by binary search on the true count; the ratio sizes it by
// characters alone. Both are then judged by the true count of what they produced.
function windowsByTokenizer(text) {
  const out = [];
  let start = 0;
  while (start < text.length) {
    let lo = start + 1;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (count(text.slice(start, mid)) <= TARGET) lo = mid;
      else hi = mid - 1;
    }
    out.push(text.slice(start, lo));
    start = lo;
  }
  return out;
}

function windowsByRatio(text, charsPerToken) {
  const width = Math.round(TARGET * charsPerToken);
  const out = [];
  for (let i = 0; i < text.length; i += width) out.push(text.slice(i, i + width));
  return out;
}

function judge(windows) {
  // The last window of a document is short by construction, not by miscounting.
  const counted = windows.slice(0, -1).map(count);
  const outside = counted.filter((n) => n < MIN || n > MAX);
  return { total: counted.length, outside: outside.length, counted };
}

const tok = { total: 0, outside: 0, counted: [] };
const rat = { total: 0, outside: 0, counted: [] };
for (const d of docs) {
  const a = judge(windowsByTokenizer(d.text));
  const b = judge(windowsByRatio(d.text, globalRatio));
  tok.total += a.total;
  tok.outside += a.outside;
  tok.counted.push(...a.counted);
  rat.total += b.total;
  rat.outside += b.outside;
  rat.counted.push(...b.counted);
}

// A ratio has to be calibrated on one corpus and then applied to whatever arrives next. This is
// that: each genre's own ratio, used on the whole set, which is what a corpus shift looks like.
const sensitivity = [...byGenre]
  .map(([genre, g]) => {
    const r = g.chars / g.tokens;
    let total = 0;
    let outside = 0;
    for (const d of docs) {
      const j = judge(windowsByRatio(d.text, r));
      total += j.total;
      outside += j.outside;
    }
    return { genre, ratio: r, total, outside };
  })
  .sort((a, b) => b.outside - a.outside);

const pct = (n, of) => (of === 0 ? '0.0' : ((n / of) * 100).toFixed(1));
const spread = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0
    ? 'n/a'
    : `${s[0]}–${s[s.length - 1]} (median ${s[Math.floor(s.length / 2)]})`;
};

console.log(`corpus              ${docs.length} files, ${totalChars} chars, ${totalTokens} tokens`);
console.log(`global ratio        ${globalRatio.toFixed(3)} chars/token`);
console.log(`build tokenizer     ${loadMs} ms  (once per worker process)`);
console.log(
  `tokenize whole set  ${tokenizeMs} ms  (${(tokenizeMs / docs.length).toFixed(1)} ms/doc)`,
);
console.log('');
console.log('ratio by genre');
for (const [genre, g] of [...byGenre].sort()) {
  console.log(`  ${genre.padEnd(20)} ${(g.chars / g.tokens).toFixed(3)}  (${g.docs} docs)`);
}
const ratios = [...byGenre.values()].map((g) => g.chars / g.tokens);
console.log(
  `  spread               ${Math.min(...ratios).toFixed(3)}–${Math.max(...ratios).toFixed(3)}`,
);
console.log('');
console.log(`windows targeting ${TARGET} tokens, band ${MIN}–${MAX}`);
console.log(
  `  tokenizer          ${tok.outside}/${tok.total} outside (${pct(tok.outside, tok.total)}%)  counts ${spread(tok.counted)}`,
);
console.log(
  `  ratio @ ${globalRatio.toFixed(3)}      ${rat.outside}/${rat.total} outside (${pct(rat.outside, rat.total)}%)  counts ${spread(rat.counted)}`,
);

console.log('');
console.log('ratio calibrated on one genre, applied to the whole corpus');
for (const r of sensitivity) {
  console.log(
    `  ${r.genre.padEnd(20)} @ ${r.ratio.toFixed(3)}  ${r.outside}/${r.total} outside (${pct(r.outside, r.total)}%)`,
  );
}
