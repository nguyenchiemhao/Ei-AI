import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';

// Only a count: FR-78 asks whether any server is registered, and the registration screens and the
// MCP client that would say more belong to the connectors module in milestone 3A.
@Injectable()
export class McpServersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('mcp_servers')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}
