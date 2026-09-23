// T-3.6-04 closes on "every route in design §8.1 resolves to a component". This reads §8.1 out of
// the design document rather than a copy of it, so a screen added or renamed there turns the check
// red instead of drifting silently away from the router.
import { readFileSync } from 'node:fs';

const DESIGN = new URL(
  '../../../docs/design/ei-ai-agentic-knowledge-assistant.md',
  import.meta.url,
).pathname;
const ROUTES_FILE = new URL('../src/routes.ts', import.meta.url).pathname;

// The screens design §8.1 lists, taken from the first cell of every row of its table. Bold markers
// are stripped: §8.1 emphasises three rows and the emphasis is not part of the name.
function designScreens() {
  const document = readFileSync(DESIGN, 'utf8');
  const section = document.slice(document.indexOf('### 8.1'), document.indexOf('### 8.2'));
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .map((line) => line.split('|')[1].trim().replaceAll('*', ''))
    .filter((name) => name !== '' && name !== 'Screen');
}

function routedScreens() {
  const source = readFileSync(ROUTES_FILE, 'utf8');
  const body = source.slice(source.indexOf('export const ROUTES'));
  return [...body.matchAll(/designRow: (?:'([^']*)'|null)/g)].map((match) => match[1] ?? null);
}

const expected = designScreens();
const routed = routedScreens();
const covered = routed.filter((name) => name !== null);

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  MISS ${message}`);
};

for (const screen of expected) {
  const times = covered.filter((name) => name === screen).length;
  if (times === 1) console.log(`  ok   ${screen}`);
  else fail(`${screen} — ${times === 0 ? 'no route' : `${times} routes claim it`}`);
}
for (const name of covered) {
  if (!expected.includes(name)) fail(`${name} — routed, but design §8.1 has no such row`);
}

const extras = routed.length - covered.length;
console.log(
  `\n${expected.length} screens in design §8.1, ${routed.length} routes declared ` +
    `(${extras} outside §8.1), ${failures} problems`,
);
process.exitCode = failures === 0 ? 0 : 1;
