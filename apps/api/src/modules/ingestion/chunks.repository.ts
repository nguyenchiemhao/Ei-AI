import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';
import type { Chunk } from './chunker';

// The embedding is not optional. A chunk cannot be written without one, which is what makes
// `count(*) FROM chunks WHERE embedding IS NULL` structurally zero rather than something the
// pipeline has to check afterwards — and reading chunks back is WP-2.5 rule 1's to refuse.
export interface StoredChunk extends Chunk {
  chunkNo: number;
  embedding: readonly number[];
}

// halfvec has no Kysely type, and pg sends an array as a Postgres array rather than a vector
// literal. The text form is what both pgvector and the driver agree on.
function toHalfvec(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`;
}

@Injectable()
export class ChunksRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private on(tx?: Tx): Database {
    return tx ?? this.db;
  }

  // Replaced rather than appended, for the same reason as pages: a re-ingest produces the same
  // chunk numbers, and `chunks_unique` would refuse the second run rather than correct the first.
  async replaceAll(
    documentVersionId: string,
    chunks: readonly StoredChunk[],
    tx?: Tx,
  ): Promise<void> {
    const db = this.on(tx);
    await db.deleteFrom('chunks').where('document_version_id', '=', documentVersionId).execute();
    if (chunks.length === 0) return;
    await db
      .insertInto('chunks')
      .values(
        chunks.map((chunk) => ({
          document_version_id: documentVersionId,
          chunk_no: chunk.chunkNo,
          text: chunk.text,
          token_count: chunk.tokenCount,
          // One page for the Markdown pass-through; the parser fills real page numbers in 2A.
          page_from: 1,
          page_to: 1,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
          heading_path: chunk.headingPath,
          embedding: sql<never>`${toHalfvec(chunk.embedding)}::halfvec`,
        })),
      )
      .execute();
  }
}
