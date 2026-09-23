import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { notImplemented } from '../../common/not-implemented';

// The write side is built and chained; reading it back, exporting it and verifying the chain are
// FR-67 and FR-68, which arrive in 2D. §9.1 gives this to the Administrator and the Auditor.
@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  @Get()
  @Roles('audit.read')
  @ApiOperation({ summary: 'The audit log, filterable, with a chain-verification result' })
  @ApiResponse({ status: 501, description: 'NOT_IMPLEMENTED — with the feature and its phase' })
  @ApiResponse({ status: 403, description: 'AUTHZ_ROLE_FORBIDDEN — decided before the stub runs' })
  events(): never {
    return notImplemented('audit-log');
  }
}
