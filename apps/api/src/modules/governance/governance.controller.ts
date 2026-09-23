import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { notImplemented } from '../../common/not-implemented';

@ApiTags('governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approvals')
export class GovernanceController {
  @Get()
  @Roles('approval.decide')
  @ApiOperation({ summary: 'Write actions waiting for a decision' })
  @ApiResponse({ status: 501, description: 'NOT_IMPLEMENTED — with the feature and its phase' })
  @ApiResponse({ status: 403, description: 'AUTHZ_ROLE_FORBIDDEN — decided before the stub runs' })
  pending(): never {
    return notImplemented('approvals');
  }
}
