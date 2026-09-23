import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdentityModule } from '../identity/identity.module';
import { AdminController } from './admin.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [IdentityModule],
  controllers: [HealthController, AdminController],
  providers: [RolesGuard],
})
export class AdminModule {}
