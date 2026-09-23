import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { notImplemented } from '../../common/not-implemented';

// The registry answers `GET /me` today; the administration surface — enabling a tool, reading the
// pre-authorisation list — is the 3A screen, and this is the route it will fill.
@ApiTags('tools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tools')
export class ToolsController {
  @Get()
  @Roles('tool.manage')
  @ApiOperation({ summary: 'The tool catalogue with classification, state and minimum role' })
  @ApiResponse({ status: 501, description: 'NOT_IMPLEMENTED — with the feature and its phase' })
  @ApiResponse({ status: 403, description: 'AUTHZ_ROLE_FORBIDDEN — decided before the stub runs' })
  catalogue(): never {
    return notImplemented('tool-administration');
  }
}
