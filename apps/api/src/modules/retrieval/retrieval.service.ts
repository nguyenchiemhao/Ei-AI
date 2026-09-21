import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import type { Candidate } from './hybrid-search.repository';
import { HybridSearchRepository } from './hybrid-search.repository';
import { QuestionEmbeddingCache } from './question-embedding.cache';
import { aboveFloor, keepTop, normalise } from './rank-fusion';

export interface Passage extends Candidate {
  relevance: number;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly hybridSearch: HybridSearchRepository,
    @Inject(CONFIG) private readonly config: Env,
    private readonly questionEmbeddings: QuestionEmbeddingCache,
  ) {}

  // Three configured numbers and no constants: how many candidates each branch fetches, how
  // relevant a passage must be to be worth returning, and how many survive. FR-13 is the middle
  // one — returning nothing is a valid answer, and better than eight passages about nothing.
  async search(
    userId: string,
    question: string,
    workspaceIds?: readonly string[],
  ): Promise<Passage[]> {
    const queryEmbedding = await this.questionEmbeddings.embed(
      this.config.EMBEDDING_MODEL,
      question,
    );
    if (queryEmbedding === undefined) return [];
    const candidates = await this.hybridSearch.search({
      userId,
      workspaceIds,
      queryEmbedding,
      queryText: question,
      candidateLimit: this.config.RETRIEVAL_CANDIDATE_LIMIT,
    });
    const relevant = aboveFloor(candidates, this.config.RETRIEVAL_RELEVANCE_FLOOR);
    return keepTop(relevant, this.config.RETRIEVAL_KEEP_TOP).map((candidate) => ({
      ...candidate,
      relevance: normalise(candidate.score),
    }));
  }
}
