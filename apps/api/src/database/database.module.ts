import { Global, Module } from '@nestjs/common';
import { CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';
import { createDatabase, type Database } from './db';

export const DATABASE = Symbol('DATABASE');

// T-1.2-10 built the Kysely instance and the generated types but never wired them into Nest,
// so `createDatabase` had no caller. Global because one process wants exactly one pool.
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [CONFIG],
      useFactory: (config: Env): Database => createDatabase(config.DATABASE_URL),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
