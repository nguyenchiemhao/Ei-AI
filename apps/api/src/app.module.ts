import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [ConfigModule, AdminModule],
})
export class AppModule {}
