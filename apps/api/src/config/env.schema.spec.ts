import { describe, expect, it } from 'vitest';
import { envSchema } from './env.schema';

const valid = {
  DATABASE_URL: 'postgresql://postgres:changeme@postgres:5432/eiai',
  REDIS_URL: 'redis://redis:6379',
  EMBEDDING_BASE_URL: 'http://infinity:7997',
  EMBEDDING_MODEL: 'BAAI/bge-m3',
  RERANK_MODEL: 'BAAI/bge-reranker-v2-m3',
  JWT_SECRET: 'x'.repeat(32),
};

describe('envSchema', () => {
  it('accepts the documented minimum', () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a missing DATABASE_URL and names it', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = valid;
    const result = envSchema.safeParse(withoutDatabase);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('DATABASE_URL');
    }
  });

  it('leaves ANTHROPIC_API_KEY optional, because Phase 1 makes no generation call', () => {
    const result = envSchema.safeParse(valid);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBeUndefined();
    }
  });

  it('rejects a JWT_SECRET that is too short to be a secret', () => {
    const result = envSchema.safeParse({ ...valid, JWT_SECRET: 'short' });

    expect(result.success).toBe(false);
  });

  // The flag that keeps web search off in v1 was read as `true` when the file said `false`,
  // because z.coerce.boolean() treats every non-empty string as true.
  it('reads a flag written "false" as false, not as true', () => {
    const parsed = envSchema.parse({ ...valid, TOOL_WEB_SEARCH_ENABLED: 'false' });

    expect(parsed.TOOL_WEB_SEARCH_ENABLED).toBe(false);
  });

  it('accepts 1 and 0 as well as true and false', () => {
    expect(envSchema.parse({ ...valid, API_DOCS_ENABLED: '1' }).API_DOCS_ENABLED).toBe(true);
    expect(envSchema.parse({ ...valid, API_DOCS_ENABLED: '0' }).API_DOCS_ENABLED).toBe(false);
  });

  it('refuses a spelling it does not recognise rather than guessing', () => {
    expect(envSchema.safeParse({ ...valid, API_DOCS_ENABLED: 'yes' }).success).toBe(false);
  });

  it('keeps the documented defaults when a flag is absent', () => {
    const parsed = envSchema.parse(valid);

    expect(parsed.TOOL_WEB_SEARCH_ENABLED).toBe(false);
    expect(parsed.TOOL_SEARCH_DOCUMENTS_ENABLED).toBe(true);
    expect(parsed.API_DOCS_ENABLED).toBe(false);
  });
});
