import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttemptsRepository } from './login-attempts.repository';
import { MeController } from './me.controller';
import { PasswordService } from './password.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenService } from './refresh-token.service';
import { RevocationService } from './revocation.service';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [CONFIG],
      useFactory: (config: Env) => ({ secret: config.JWT_SECRET }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    LoginAttemptsRepository,
    PasswordService,
    RefreshTokenRepository,
    RefreshTokenService,
    RevocationService,
    TokenService,
    UsersRepository,
    JwtAuthGuard,
  ],
  exports: [
    PasswordService,
    RefreshTokenService,
    RevocationService,
    TokenService,
    UsersRepository,
    JwtAuthGuard,
  ],
})
export class IdentityModule {}
