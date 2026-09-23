import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdentityModule } from '../identity/identity.module';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

// Global for the same reason as the database pool: every module that acts has something to record,
// and none of them should have to import the audit module to do it. Nothing here reaches into
// another module, so architecture rule 3 is unaffected.
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [AuditController],
  providers: [RolesGuard, AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
