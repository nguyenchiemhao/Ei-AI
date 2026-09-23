import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { notImplemented } from '../../common/not-implemented';

// The allowlist API is T-2.2-05, deferred when WP-2.2 closed. Until it lands the route
// exists and refuses, so the screen and its contract test have something to hold.
@ApiTags('egress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('egress/allowlist')
export class EgressController {
  @Get()
  @Roles('egress.manage')
  @ApiOperation({ summary: 'Destinations the network may reach' })
  @ApiResponse({ status: 501, description: 'NOT_IMPLEMENTED — with the feature and its phase' })
  @ApiResponse({ status: 403, description: 'AUTHZ_ROLE_FORBIDDEN — decided before the stub runs' })
  allowlist(): never {
    return notImplemented('egress-administration');
  }
}
