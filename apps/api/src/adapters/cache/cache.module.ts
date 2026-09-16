import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';

export const REDIS = Symbol('REDIS');

// Global for the same reason as the database pool: one process wants one connection, and every
// module that needs it needs exactly this one.
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [CONFIG],
      useFactory: (config: Env): Redis => new Redis(config.REDIS_URL),
    },
  ],
  exports: [REDIS],
})
export class CacheModule {}
