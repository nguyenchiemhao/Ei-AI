import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from '@ei-ai/shared-types';
import { CONFIG } from '../../config/config.module';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { withTransaction } from '../../database/transaction';
import type { ActorContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
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
    private readonly audit: AuditService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  // Three configured numbers and no constants: how many candidates each branch fetches, how
  // relevant a passage must be to be worth returning, and how many survive. FR-13 is the middle
  // one — returning nothing is a valid answer, and better than eight passages about nothing.
  async search(
    actor: ActorContext,
    question: string,
    workspaceIds?: readonly string[],
  ): Promise<Passage[]> {
    const queryEmbedding = await this.questionEmbeddings.embed(
      this.config.EMBEDDING_MODEL,
      question,
    );
    if (queryEmbedding === undefined) return [];
    const candidates = await this.hybridSearch.search({
      userId: actor.actorUserId,
      workspaceIds,
      queryEmbedding,
      queryText: question,
      candidateLimit: this.config.RETRIEVAL_CANDIDATE_LIMIT,
    });
    const relevant = aboveFloor(candidates, this.config.RETRIEVAL_RELEVANCE_FLOOR);
    const passages = keepTop(relevant, this.config.RETRIEVAL_KEEP_TOP).map((candidate) => ({
      ...candidate,
      relevance: normalise(candidate.score),
    }));
    await this.recordSearch(actor, question, workspaceIds, passages);
    return passages;
  }

  // The question and the scope, and of the results only how many and which documents they came
  // from. Not one character of a passage: an audit log is read by an Auditor who may not belong to
  // the workspace the answer came from, and FR-11 does not stop applying because the text left by
  // a different door.
  private recordSearch(
    actor: ActorContext,
    question: string,
    workspaceIds: readonly string[] | undefined,
    passages: readonly Passage[],
  ): Promise<unknown> {
    return withTransaction(this.db, (tx) =>
      this.audit.record(
        {
          ...actor,
          action: AUDIT_ACTIONS.SEARCH_PERFORMED,
          objectKind: AUDIT_OBJECTS.SEARCH,
          objectId: null,
          workspaceId: workspaceIds?.length === 1 ? workspaceIds[0]! : null,
          detail: {
            question,
            scope: workspaceIds === undefined ? 'all-memberships' : [...workspaceIds].sort(),
            passages: passages.length,
            documentIds: [...new Set(passages.map((passage) => passage.documentId))].sort(),
          },
        },
        tx,
      ),
    );
  }
}
