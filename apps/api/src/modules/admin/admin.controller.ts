import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { notImplemented } from '../../common/not-implemented';

// `/health` stays public and outside this controller: CI and a load balancer poll it without a
// token, and FR-78's indicator tiles are the part that arrives in 4A.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  @Get('users')
  @Roles('user.manage')
  @ApiOperation({ summary: 'Users, their auth source, status and roles' })
  @ApiResponse({ status: 501, description: 'NOT_IMPLEMENTED — with the feature and its phase' })
  @ApiResponse({ status: 403, description: 'AUTHZ_ROLE_FORBIDDEN — decided before the stub runs' })
  users(): never {
    return notImplemented('administration');
  }

  @Get('restore')
  @Roles('backup.manage')
  @ApiOperation({ summary: 'Backups and their verification status' })
  @ApiResponse({ status: 501, description: 'NOT_IMPLEMENTED — with the feature and its phase' })
  @ApiResponse({ status: 403, description: 'AUTHZ_ROLE_FORBIDDEN — decided before the stub runs' })
  restore(): never {
    return notImplemented('administration');
  }
}
