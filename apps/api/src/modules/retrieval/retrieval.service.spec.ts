import { describe, expect, it, vi } from 'vitest';
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
    ),
    search,
    embed,
  };
}

describe('RetrievalService', () => {
  it('embeds the question once and searches with that vector', async () => {
    const { service, embed, search } = serviceWith({});
    await service.search('u-1', 'phương thức thanh toán');
    expect(embed).toHaveBeenCalledWith('BAAI/bge-m3', 'phương thức thanh toán');
    expect(search.mock.calls[0]![0]).toMatchObject({
      userId: 'u-1',
      queryText: 'phương thức thanh toán',
      queryEmbedding: [0.1, 0.2],
    });
  });

  it('takes the candidate limit from configuration, not from a constant', async () => {
    const { service, search } = serviceWith({ RETRIEVAL_CANDIDATE_LIMIT: 17 });
    await service.search('u-1', 'x');
    expect(search.mock.calls[0]![0]).toMatchObject({ candidateLimit: 17 });
  });

  it('passes a workspace narrowing through untouched', async () => {
    const { service, search } = serviceWith({});
    await service.search('u-1', 'x', ['w-1']);
    expect(search.mock.calls[0]![0]).toMatchObject({ workspaceIds: ['w-1'] });
  });

  it('keeps at most the configured number of passages', async () => {
    const many = Array.from({ length: 20 }, (_, i) => candidate(`c-${i}`, BOTH_FIRST));
    const { service } = serviceWith({ RETRIEVAL_KEEP_TOP: 3 }, many);
    expect(await service.search('u-1', 'x')).toHaveLength(3);
  });

  it('reports relevance on the 0–1 scale the floor is written in', async () => {
    const { service } = serviceWith({}, [candidate('c-1', BOTH_FIRST)]);
    const [passage] = await service.search('u-1', 'x');
    expect(passage!.relevance).toBeCloseTo(1, 10);
  });

  // The configured default is 0.35, and a raw RRF score never exceeds 0.0328. Read against raw
  // scores this floor would empty every search; these two cases are the boundary it turns on.
  it('returns nothing when the floor is above what the passages scored', async () => {
    const { service } = serviceWith({ RETRIEVAL_RELEVANCE_FLOOR: 0.6 }, [
      candidate('c-1', ONE_FIRST),
    ]);
    expect(await service.search('u-1', 'x')).toEqual([]);
  });

  it('returns that same passage when the floor drops below it', async () => {
    const { service } = serviceWith({ RETRIEVAL_RELEVANCE_FLOOR: 0.4 }, [
      candidate('c-1', ONE_FIRST),
    ]);
    expect(await service.search('u-1', 'x')).toHaveLength(1);
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
              'u-1',
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
    expect(await service.search('u-1', 'x')).toHaveLength(2);
  });

  it('returns nothing, and searches for nothing, when the question cannot be embedded', async () => {
    const search = vi.fn();
    const empty = new RetrievalService(
      { search } as unknown as HybridSearchRepository,
      { RETRIEVAL_CANDIDATE_LIMIT: 60, RETRIEVAL_KEEP_TOP: 8, RETRIEVAL_RELEVANCE_FLOOR: 0 } as Env,
      { embed: vi.fn().mockResolvedValue(undefined) } as unknown as QuestionEmbeddingCache,
    );
    expect(await empty.search('u-1', 'x')).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
