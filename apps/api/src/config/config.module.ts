import { Global, Module } from '@nestjs/common';
import { loadConfig } from './configuration';
import type { Env } from './env.schema';

export const CONFIG = Symbol('CONFIG');

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: (): Env => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
