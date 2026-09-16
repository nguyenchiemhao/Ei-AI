import { isIP } from 'node:net';
import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../../common/api-docs';
import { AppException } from '../../common/app-exception';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type {
  AuthenticatedRequest,
  CookieRequest,
  CookieResponse,
  RequestLike,
} from '../../common/http.types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { AuthService } from './auth.service';
import { type AuthenticatedUser, type LoginRequest, loginSchema } from './dto/login.dto';
import { REFRESH_COOKIE, refreshCookieOptions } from './refresh-cookie';
import { RefreshTokenService } from './refresh-token.service';
import { RevocationService } from './revocation.service';
import { TokenService } from './token.service';
import type { UserRecord } from './users.repository';

// The ingress sets X-Forwarded-For; anything that is not an address is dropped rather than
// handed to an INET column, where it would turn a bad header into a failed login.
function clientIpOf(request: RequestLike): string | null {
  const raw = request.headers['x-forwarded-for'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const first = header?.split(',')[0]?.trim();
  return first && isIP(first) ? first : null;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly revocations: RevocationService,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu local' })
  @ApiZodBody(loginSchema)
  @ApiResponse({ status: 200, description: 'Access token 15 phút; refresh token đặt trong cookie' })
  @ApiResponse({
    status: 401,
    description:
      'AUTH_INVALID_CREDENTIALS — giống hệt nhau cho email sai, mật khẩu sai và tài khoản bị vô hiệu',
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED' })
  @ApiResponse({ status: 423, description: 'AUTH_ACCOUNT_LOCKED — sau 10 lần sai liên tiếp' })
  @ApiResponse({ status: 429, description: 'RATE_LIMITED — quá 10 lần trong 15 phút' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthenticatedUser> {
    const user = await this.auth.authenticate({
      email: body.email,
      password: body.password,
      ip: clientIpOf(request),
    });
    return this.issueSession(user, response);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi refresh token lấy access token mới; token cũ chết ngay' })
  @ApiResponse({ status: 200, description: 'Access token mới; cookie được xoay sang token mới' })
  @ApiResponse({
    status: 401,
    description: 'AUTH_INVALID_CREDENTIALS, AUTH_TOKEN_REUSE hoặc AUTH_TOKEN_EXPIRED',
  })
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthenticatedUser> {
    const presented = request.cookies?.[REFRESH_COOKIE];
    if (!presented) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Thiếu refresh token');
    }
    const rotated = await this.refreshTokens.rotate(presented);
    const user = await this.auth.activeUser(rotated.userId);
    response.cookie(REFRESH_COOKIE, rotated.refreshToken, refreshCookieOptions(this.config));
    return this.summarise(user, await this.accessTokenFor(user));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kết thúc phiên: thu hồi cả họ refresh token và access token đang cầm' })
  @ApiResponse({ status: 204, description: 'Phiên đã kết thúc; cookie bị xoá' })
  @ApiResponse({ status: 401, description: 'AUTH_INVALID_CREDENTIALS hoặc AUTH_TOKEN_EXPIRED' })
  async logout(
    @Req() request: CookieRequest & AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    const principal = request.principal;
    if (principal) {
      await this.refreshTokens.revokeSession(request.cookies?.[REFRESH_COOKIE], principal.userId);
      await this.revocations.revokeToken(principal);
    }
    response.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.config));
  }

  // The refresh token goes into the cookie and nowhere else: it is never part of a body, so it
  // cannot end up in a log line, a browser history entry or a client's local storage.
  private async issueSession(
    user: UserRecord,
    response: CookieResponse,
  ): Promise<AuthenticatedUser> {
    const issued = await this.refreshTokens.issueForUser(user.id);
    response.cookie(REFRESH_COOKIE, issued.refreshToken, refreshCookieOptions(this.config));
    return this.summarise(user, await this.accessTokenFor(user));
  }

  private async accessTokenFor(user: UserRecord): Promise<string> {
    const { accessToken } = await this.tokens.issueAccessToken(user);
    return accessToken;
  }

  private summarise(user: UserRecord, accessToken: string): AuthenticatedUser {
    return {
      accessToken,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      systemRole: user.systemRole,
    };
  }
}
