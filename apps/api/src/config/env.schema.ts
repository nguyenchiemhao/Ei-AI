import { z } from 'zod';

const featureStatus = z.enum(['available', 'coming_soon', 'disabled']);

// `z.coerce.boolean()` reads every non-empty string as true, so a variable written `false` in
// the file arrives as `true` in the process. The accepted spellings are named instead.
const booleanFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true' || value === '1');

// Every variable the API reads. Phase 1 keeps generation credentials optional
// because no code path calls a model provider; week 7 tightens ANTHROPIC_API_KEY.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  HTTP_PROXY: z.string().url().optional(),
  HTTPS_PROXY: z.string().url().optional(),
  NO_PROXY: z.string().optional(),

  EMBEDDING_BASE_URL: z.string().url(),
  EMBEDDING_MODEL: z.string().min(1),
  RERANK_MODEL: z.string().min(1),
  RETRIEVAL_CANDIDATE_LIMIT: z.coerce.number().int().positive().default(60),
  RETRIEVAL_KEEP_TOP: z.coerce.number().int().positive().default(8),
  RETRIEVAL_RELEVANCE_FLOOR: z.coerce.number().min(0).max(1).default(0.35),

  // Detail §WP-3.4 fixes the batch at 8 to respect the 4 GB VRAM budget. Five attempts backing
  // off from two seconds span about thirty, which is the point: T-3.4-09 asks that a restart of
  // infinity be survivable, and a window shorter than a model reload would not survive one.
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(8),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  EMBEDDING_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  EMBEDDING_BACKOFF_MS: z.coerce.number().int().positive().default(2000),

  // Where the Hugging Face cache is mounted. The worker reads BGE-M3's own tokenizer.json from
  // it, so the chunker counts tokens the way the embedding model does; egress denies by default
  // and nothing downloads it at runtime.
  MODEL_CACHE_DIR: z.string().min(1).default('/models'),

  // D-5. `tokenizer` counts with XLM-RoBERTa itself; `ratio` is the calibrated approximation,
  // kept reachable rather than kept as dead code. See docs/ops/d5-token-counting.md.
  CHUNK_TOKEN_COUNTER: z.enum(['tokenizer', 'ratio']).default('tokenizer'),
  CHUNK_CHARS_PER_TOKEN: z.coerce.number().positive().default(3.5),
  CHUNK_MIN_TOKENS: z.coerce.number().int().positive().default(200),
  CHUNK_MAX_TOKENS: z.coerce.number().int().positive().default(400),
  CHUNK_OVERLAP_RATIO: z.coerce.number().min(0).max(0.5).default(0.15),

  // T-3.4-02. BullMQ retries with exponential back-off; the reason of the final failure is
  // written to document_versions.status_reason rather than living only in Redis.
  INGEST_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  INGEST_BACKOFF_MS: z.coerce.number().int().positive().default(2000),

  AGENT_BUDGET_MS: z.coerce.number().int().positive().default(120000),
  AGENT_BUDGET_STEPS: z.coerce.number().int().positive().default(12),
  AGENT_LOOP_DETECT_THRESHOLD: z.coerce.number().int().positive().default(3),
  AGENT_INVALID_ACTION_RETRIES: z.coerce.number().int().nonnegative().default(2),

  MODEL_PROFILE: z.enum(['dev-hybrid', 'dev-local', 'prod']).default('dev-hybrid'),
  ANTHROPIC_API_KEY: z.string().optional(),
  GENERATION_MODEL: z.string().default('claude-haiku-4-5'),
  VERIFIER_MODEL: z.string().default('claude-haiku-4-5'),
  CEILING_MODEL: z.string().default('claude-sonnet-5'),
  LOCAL_GENERATION_BASE_URL: z.string().url().optional(),
  LOCAL_GENERATION_MODEL: z.string().optional(),

  // Where LocalFsAdapter writes. The compose stack mounts the `uploads` volume here; a test
  // points it at a temporary directory instead.
  UPLOADS_DIR: z.string().min(1).default('/workspace/uploads'),

  APPROVAL_EXPIRY_MS: z.coerce.number().int().positive().default(900000),

  JWT_SECRET: z.string().min(32),
  // Validated shape rather than any string: the JWT library types its lifetime as a template
  // literal, and a bad value should fail at boot rather than at the first login.
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('15m'),
  REFRESH_TOKEN_TTL: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('8h'),

  // FR-58 calls the password policy "configurable" and names no number; FR-65's are the ones
  // Detail §WP-3.1 writes down. A security threshold is a thing a customer changes, and
  // changing it should not mean editing code.
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(12),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(10),
  // Neither Detail nor FR-65 says how long a lockout lasts, only that one happens. The window
  // matches the rate limit's, so a locked account and a rate-limited one clear together.
  LOCKOUT_DURATION_MS: z.coerce.number().int().positive().default(900000),

  // The API document is a development affordance, off unless a deployment asks for it. The
  // dev .env.example turns it on; a customer's own .env leaves the surface closed.
  API_DOCS_ENABLED: booleanFlag(false),

  // Optional, and deliberately without a default: set it and the seed gives the administrator a
  // real Argon2id hash, leave it and the account keeps a placeholder nobody can log in with.
  // A public repository must never ship a working credential.
  // `.env.example` ships the key with an empty value, so an empty string means "not set"
  // rather than "the password is the empty string".
  SEED_ADMIN_PASSWORD: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),

  TOOL_SEARCH_DOCUMENTS_ENABLED: booleanFlag(true),
  TOOL_READ_DOCUMENT_PAGE_ENABLED: booleanFlag(true),
  TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED: booleanFlag(true),
  TOOL_WEB_SEARCH_ENABLED: booleanFlag(false),

  FEATURE_AGENT_LOOP: featureStatus.default('coming_soon'),
  FEATURE_VERIFIED_ANSWERS: featureStatus.default('coming_soon'),
  FEATURE_APPROVALS: featureStatus.default('coming_soon'),
  FEATURE_CONNECTORS: featureStatus.default('coming_soon'),
});

export type Env = z.infer<typeof envSchema>;
