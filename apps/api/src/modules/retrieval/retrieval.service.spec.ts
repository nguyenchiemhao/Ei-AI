import type { ActorContext } from '../audit/audit-context';
import type { AuditService } from '../audit/audit.service';
import type { Database } from '../../database/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import type { Candidate, HybridSearchRepository } from './hybrid-search.repository';
import type { QuestionEmbeddingCache } from './question-embedding.cache';
import { maxFusedScore, rrfScore } from './rank-fusion';
import { RetrievalService } from './retrieval.service';

// Scores written as what the SQL would produce: a chunk both branches ranked first scores the
// maximum, one branch alone scores half of it, and a poor rank scores less again.
function candidate(id: string, score: number): Candidate {
  return {
    chunkId: id,
    score,
    documentId: 'd-1',
    documentVersionId: 'v-1',
    title: 'Hợp đồng',
    sourceFilename: 'hợp đồng.md',
    chunkNo: 1,
    charStart: 0,
    charEnd: 10,
    pageFrom: 1,
    pageTo: 1,
    headingPath: 'Điều 2',
    text: 'Phương thức thanh toán',
  };
}

const BOTH_FIRST = maxFusedScore();
const ONE_FIRST = rrfScore(1);
// Last of one branch and absent from the other: 1/120, which normalises to 0.25.
const ONE_LAST = rrfScore(60);

const TX = Symbol('tx');
const ACTOR: ActorContext = { actorUserId: 'u-1', actorIp: '10.0.0.1', correlationId: 'c-1' };
// A search records one event, so the double is part of what makes the service work rather than an
// afterthought — and what it collects is what an auditor would be able to read.
const recorded: { action: string; detail?: Record<string, unknown> }[] = [];
const auditDouble = {
  record: vi.fn((record: { action: string; detail?: Record<string, unknown> }) => {
    recorded.push(record);
    return Promise.resolve({});
  }),
} as unknown as AuditService;

beforeEach(() => {
  recorded.length = 0;
});

function serviceWith(config: Partial<Env>, candidates: Candidate[] = []) {
  const search = vi.fn().mockResolvedValue(candidates);
  const embed = vi.fn().mockResolvedValue([0.1, 0.2]);
  return {
    service: new RetrievalService(
      { search } as unknown as HybridSearchRepository,
      {
        EMBEDDING_MODEL: 'BAAI/bge-m3',
        RETRIEVAL_CANDIDATE_LIMIT: 60,
        RETRIEVAL_KEEP_TOP: 8,
        RETRIEVAL_RELEVANCE_FLOOR: 0,
        ...config,
      } as Env,
      { embed } as unknown as QuestionEmbeddingCache,
      auditDouble,
      {
        transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
      } as unknown as Database,
    ),
    search,
    embed,
  };
}

describe('RetrievalService', () => {
  it('embeds the question once and searches with that vector', async () => {
    const { service, embed, search } = serviceWith({});
    await service.search(ACTOR, 'phương thức thanh toán');
    expect(embed).toHaveBeenCalledWith('BAAI/bge-m3', 'phương thức thanh toán');
    expect(search.mock.calls[0]![0]).toMatchObject({
      userId: 'u-1',
      queryText: 'phương thức thanh toán',
      queryEmbedding: [0.1, 0.2],
    });
  });

  it('takes the candidate limit from configuration, not from a constant', async () => {
    const { service, search } = serviceWith({ RETRIEVAL_CANDIDATE_LIMIT: 17 });
    await service.search(ACTOR, 'x');
    expect(search.mock.calls[0]![0]).toMatchObject({ candidateLimit: 17 });
  });

  it('passes a workspace narrowing through untouched', async () => {
    const { service, search } = serviceWith({});
    await service.search(ACTOR, 'x', ['w-1']);
    expect(search.mock.calls[0]![0]).toMatchObject({ workspaceIds: ['w-1'] });
  });

  it('keeps at most the configured number of passages', async () => {
    const many = Array.from({ length: 20 }, (_, i) => candidate(`c-${i}`, BOTH_FIRST));
    const { service } = serviceWith({ RETRIEVAL_KEEP_TOP: 3 }, many);
    expect(await service.search(ACTOR, 'x')).toHaveLength(3);
  });

  it('reports relevance on the 0–1 scale the floor is written in', async () => {
    const { service } = serviceWith({}, [candidate('c-1', BOTH_FIRST)]);
    const [passage] = await service.search(ACTOR, 'x');
    expect(passage!.relevance).toBeCloseTo(1, 10);
  });

  // The configured default is 0.35, and a raw RRF score never exceeds 0.0328. Read against raw
  // scores this floor would empty every search; these two cases are the boundary it turns on.
  it('returns nothing when the floor is above what the passages scored', async () => {
    const { service } = serviceWith({ RETRIEVAL_RELEVANCE_FLOOR: 0.6 }, [
      candidate('c-1', ONE_FIRST),
    ]);
    expect(await service.search(ACTOR, 'x')).toEqual([]);
  });

  it('returns that same passage when the floor drops below it', async () => {
    const { service } = serviceWith({ RETRIEVAL_RELEVANCE_FLOOR: 0.4 }, [
      candidate('c-1', ONE_FIRST),
    ]);
    expect(await service.search(ACTOR, 'x')).toHaveLength(1);
  });

  it('changes how many come back as the floor moves, with no code change', async () => {
    const mixed = [
      candidate('strong', BOTH_FIRST),
      candidate('middling', ONE_FIRST),
      candidate('weak', ONE_LAST),
    ];
    const counts = await Promise.all(
      [0, 0.4, 0.9].map(
        async (floor) =>
          (
            await serviceWith({ RETRIEVAL_RELEVANCE_FLOOR: floor }, mixed).service.search(
              ACTOR,
              'x',
            )
          ).length,
      ),
    );
    expect(counts).toEqual([3, 2, 1]);
  });

  it('holds the default of 0.35 against a real fused score rather than emptying the result', async () => {
    const { service } = serviceWith({ RETRIEVAL_RELEVANCE_FLOOR: 0.35 }, [
      candidate('c-1', BOTH_FIRST),
      candidate('c-2', ONE_FIRST),
    ]);
    expect(await service.search(ACTOR, 'x')).toHaveLength(2);
  });

  it('returns nothing, and searches for nothing, when the question cannot be embedded', async () => {
    const search = vi.fn();
    const empty = new RetrievalService(
      { search } as unknown as HybridSearchRepository,
      { RETRIEVAL_CANDIDATE_LIMIT: 60, RETRIEVAL_KEEP_TOP: 8, RETRIEVAL_RELEVANCE_FLOOR: 0 } as Env,
      { embed: vi.fn().mockResolvedValue(undefined) } as unknown as QuestionEmbeddingCache,
      auditDouble,
      {
        transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
      } as unknown as Database,
    );
    expect(await empty.search(ACTOR, 'x')).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});

describe('what a search records', () => {
  it('records exactly one event', async () => {
    const { service } = serviceWith({}, [candidate('c-1', BOTH_FIRST)]);
    await service.search(ACTOR, 'phương thức thanh toán');
    expect(recorded).toHaveLength(1);
  });

  it('records the question and who asked it', async () => {
    const { service } = serviceWith({}, [candidate('c-1', BOTH_FIRST)]);
    await service.search(ACTOR, 'phương thức thanh toán');
    expect(recorded[0]).toMatchObject({
      action: 'search.performed',
      objectKind: 'search',
      actorUserId: 'u-1',
      correlationId: 'c-1',
      detail: { question: 'phương thức thanh toán' },
    });
  });

  it('records the scope as every membership when none was named', async () => {
    const { service } = serviceWith({}, []);
    await service.search(ACTOR, 'x');
    expect(recorded[0]!.detail).toMatchObject({ scope: 'all-memberships' });
  });

  it('records the workspaces when the search was narrowed', async () => {
    const { service } = serviceWith({}, []);
    await service.search(ACTOR, 'x', ['w-2', 'w-1']);
    expect(recorded[0]!.detail).toMatchObject({ scope: ['w-1', 'w-2'] });
  });

  // T-2.4-07's own guard, and the one that matters: an Auditor may read this log without
  // belonging to the workspace the passage came from.
  it('records how many passages and which documents, never their text', async () => {
    const { service } = serviceWith({}, [candidate('c-1', BOTH_FIRST)]);
    await service.search(ACTOR, 'phương thức thanh toán');
    expect(recorded[0]!.detail).toMatchObject({ passages: 1, documentIds: ['d-1'] });
    expect(JSON.stringify(recorded)).not.toContain('Phương thức thanh toán');
  });

  it('carries no passage text even when many passages come back', async () => {
    const many = Array.from({ length: 8 }, (_, i) => candidate(`c-${i}`, BOTH_FIRST));
    const { service } = serviceWith({}, many);
    await service.search(ACTOR, 'x');
    const written = JSON.stringify(recorded);
    for (const passage of many) expect(written).not.toContain(passage.text);
  });

  it('records nothing when the question could not be embedded', async () => {
    const empty = new RetrievalService(
      { search: vi.fn() } as unknown as HybridSearchRepository,
      { RETRIEVAL_CANDIDATE_LIMIT: 60, RETRIEVAL_KEEP_TOP: 8, RETRIEVAL_RELEVANCE_FLOOR: 0 } as Env,
      { embed: vi.fn().mockResolvedValue(undefined) } as unknown as QuestionEmbeddingCache,
      auditDouble,
      {
        transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
      } as unknown as Database,
    );
    await empty.search(ACTOR, 'x');
    expect(recorded).toHaveLength(0);
  });
});
