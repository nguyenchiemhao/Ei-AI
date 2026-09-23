import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdentityModule } from '../identity/identity.module';
import { GovernanceController } from './governance.controller';

// Detail §7.1 — the module exists so its routes exist; the feature arrives in a later phase.
// IdentityModule is imported for JwtAuthGuard, as every other module with a guarded route does.
@Module({
  imports: [IdentityModule],
  controllers: [GovernanceController],
  providers: [RolesGuard],
})
export class GovernanceModule {}
