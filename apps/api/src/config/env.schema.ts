import { z } from 'zod';

const featureStatus = z.enum(['available', 'coming_soon', 'disabled']);

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

  APPROVAL_EXPIRY_MS: z.coerce.number().int().positive().default(900000),

  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('8h'),

  TOOL_SEARCH_DOCUMENTS_ENABLED: z.coerce.boolean().default(true),
  TOOL_READ_DOCUMENT_PAGE_ENABLED: z.coerce.boolean().default(true),
  TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED: z.coerce.boolean().default(true),
  TOOL_WEB_SEARCH_ENABLED: z.coerce.boolean().default(false),

  FEATURE_AGENT_LOOP: featureStatus.default('coming_soon'),
  FEATURE_VERIFIED_ANSWERS: featureStatus.default('coming_soon'),
  FEATURE_APPROVALS: featureStatus.default('coming_soon'),
  FEATURE_CONNECTORS: featureStatus.default('coming_soon'),
});

export type Env = z.infer<typeof envSchema>;
