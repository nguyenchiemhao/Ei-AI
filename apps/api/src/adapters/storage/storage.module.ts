import { Global, Module } from '@nestjs/common';
import { STORAGE_PORT } from '../../ports/storage.port';
import { LocalFsAdapter } from './local-fs.adapter';

// The port is what every module depends on; which adapter satisfies it is decided here and
// nowhere else, which is the whole point of design §5.4's three seams.
@Global()
@Module({
  providers: [{ provide: STORAGE_PORT, useClass: LocalFsAdapter }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
