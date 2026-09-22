import type { FeatureStatusMap, OperatingMode, ToolGroups } from '@ei-ai/shared-types';
import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppException } from '../../common/app-exception';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/http.types';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { ToolsService } from '../tools/tools.service';
import { AuthService } from './auth.service';
import { featureStatusOf } from './feature-status';
import { UsersRepository } from './users.repository';

export interface MeResponse {
  user: { id: string; email: string; displayName: string; systemRole: string };
  memberships: { workspaceId: string; workspaceName: string; workspaceRole: string }[];
  operatingMode: OperatingMode;
  toolGroups: ToolGroups;
  featureStatus: FeatureStatusMap;
}

// No `@Roles`: every authenticated caller reads their own identity, whatever their role. The
// decision is recorded in scripts/check-route-decisions.mjs, which otherwise reports the route.
@ApiTags('identity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersRepository,
    private readonly tools: ToolsService,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The caller, their memberships, the operating mode and feature status' })
  @ApiResponse({ status: 200, description: 'The caller' })
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponse> {
    const principal = request.principal;
    if (!principal) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
    }
    // Through activeUser rather than findById, so a disabled or locked account cannot read itself
    // back with a token issued before it was closed.
    const user = await this.auth.activeUser(principal.userId);
    const mode = await this.tools.operatingMode();
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        systemRole: user.systemRole,
      },
      memberships: await this.users.listWorkspaceMemberships(user.id),
      operatingMode: mode.operatingMode,
      toolGroups: mode.toolGroups,
      featureStatus: featureStatusOf(this.config),
    };
  }
}
