import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import type { Tx } from '../../database/transaction';

export interface NewPage {
  pageNo: number;
  text: string;
  extractionMethod: 'text_layer' | 'ocr' | 'markdown';
}

@Injectable()
export class PagesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private on(tx?: Tx): Database {
    return tx ?? this.db;
  }

  // Replaced rather than appended: a re-ingest of a version produces the same pages, and
  // `pages_unique` would refuse the second run rather than let it correct the first.
  async replaceAll(documentVersionId: string, pages: readonly NewPage[], tx?: Tx): Promise<void> {
    await this.on(tx)
      .deleteFrom('pages')
      .where('document_version_id', '=', documentVersionId)
      .execute();
    if (pages.length === 0) return;
    await this.on(tx)
      .insertInto('pages')
      .values(
        pages.map((page) => ({
          document_version_id: documentVersionId,
          page_no: page.pageNo,
          text: page.text,
          extraction_method: page.extractionMethod,
        })),
      )
      .execute();
  }

  async countFor(documentVersionId: string, tx?: Tx): Promise<number> {
    const row = await this.on(tx)
      .selectFrom('pages')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('document_version_id', '=', documentVersionId)
      .executeTakeFirst();
    return Number(row?.total ?? 0);
  }
}
