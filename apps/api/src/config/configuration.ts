import { envSchema, type Env } from './env.schema';

let cached: Env | undefined;

function describeFailure(issues: { path: PropertyKey[]; message: string }[]): string {
  const lines = issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return ['Configuration is invalid. The process will not start.', ...lines].join('\n');
}

// Boot fails loudly on a missing or malformed variable: a named list of what is
// wrong, never a stack trace, because the reader is an operator and not a developer.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    process.stderr.write(`${describeFailure(parsed.error.issues)}\n`);
    process.exit(1);
  }

  cached = parsed.data;
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}
