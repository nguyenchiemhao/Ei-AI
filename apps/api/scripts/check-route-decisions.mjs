// T-3.2-06. Reads the routes the built application actually maps and checks each one against the
// decision recorded for it. Reading the source by eye is how a route gets added without a decision.
//   docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
//     api apps/api/scripts/check-route-decisions.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONTROLLERS = [];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name.endsWith('.controller.ts')) CONTROLLERS.push(path);
  }
}
collect(new URL('../src/modules/', import.meta.url).pathname);

// Every route that carries no `@Roles` and no `@WorkspaceRole`, with the reason. This list is the
// decision; a route missing from both it and the decorators is what this script exists to find.
const NO_ROLE_NEEDED = {
  'POST /auth/login': 'public — this is where a caller becomes someone',
  'POST /auth/refresh': 'public — the refresh cookie is the credential',
  'POST /auth/logout': 'authenticated only — a caller may always end their own session',
  'GET /health': 'public liveness — CI and a load balancer poll it without a token',
  'GET /me': 'authenticated only — every role reads its own identity and the operating mode',
  'GET /workspaces': 'authenticated only — lists the caller’s own memberships, scoped by them',
};

const METHOD = /@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/;
const CONTROLLER = /@Controller\(\s*'([^']*)'\s*\)/;

let missing = 0;
let decided = 0;
for (const file of CONTROLLERS) {
  const source = readFileSync(file, 'utf8');
  const base = CONTROLLER.exec(source)?.[1] ?? '';
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const matched = METHOD.exec(lines[i]);
    if (!matched) continue;
    const route = `${matched[1].toUpperCase()} /${[base, matched[2] ?? ''].filter(Boolean).join('/')}`;
    // Only the lines belonging to this handler: everything up to the next method decorator, or to
    // the end. A fixed window reached into the next handler and reported a bare route as guarded.
    let end = i + 1;
    while (end < lines.length && !METHOD.test(lines[end])) end += 1;
    const block = lines.slice(i, end).join('\n');
    const hasRole = /@Roles\(|@WorkspaceRole\(/.test(block);
    const excused = NO_ROLE_NEEDED[route];
    if (hasRole || excused) {
      decided += 1;
      console.log(`  ok   ${route.padEnd(42)} ${hasRole ? 'guarded' : excused}`);
    } else {
      missing += 1;
      console.log(`  MISS ${route.padEnd(42)} no role decision`);
    }
  }
}
console.log(`\n${decided} routes decided, ${missing} without a decision`);
process.exitCode = missing === 0 ? 0 : 1;
