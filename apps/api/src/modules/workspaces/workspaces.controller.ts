import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../../common/api-docs';
import { AppException } from '../../common/app-exception';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, WorkspaceRole } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard';
import type { AuthenticatedRequest, Principal } from '../../common/http.types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  type CreateWorkspaceRequest,
  createWorkspaceSchema,
  type MemberRequest,
  memberSchema,
  type UpdateWorkspaceRequest,
  updateWorkspaceSchema,
  type WorkspaceView,
} from './dto/workspace.dto';
import { actorOf } from '../audit/audit-context';
import { ContentLengthGuard } from './content-length.guard';
import { DocumentsListingService } from './documents-listing.service';
import { MembershipsService } from './memberships.service';
import type { MembershipView } from './workspace-members.repository';
import { UploadLimitFilter } from './upload-limit.filter';
import { MAX_UPLOAD_MB } from './upload-limits';
import { type UploadedFile as MultipartFile, UploadService } from './upload.service';
import { WorkspacesService } from './workspaces.service';

function principalOf(request: AuthenticatedRequest): Principal {
  if (!request.principal) {
    throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
  }
  return request.principal;
}

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceRoleGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly uploads: UploadService,
    private readonly documentsListing: DocumentsListingService,
  ) {}

  @Get()
  // No matrix row: this lists the caller's own memberships and is scoped by them.
  @ApiOperation({ summary: 'Workspaces the caller belongs to, archived ones included' })
  list(@Req() request: AuthenticatedRequest): Promise<WorkspaceView[]> {
    return this.workspaces.listFor(principalOf(request).userId);
  }

  @Post()
  @Roles('workspace.manage')
  @ApiOperation({ summary: 'Create a workspace; the creator becomes its Owner' })
  @ApiZodBody(createWorkspaceSchema)
  @ApiResponse({
    status: 409,
    description: 'WORKSPACE_NAME_TAKEN — the name is unique system-wide',
  })
  create(
    @Body(new ZodValidationPipe(createWorkspaceSchema)) body: CreateWorkspaceRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceView> {
    return this.workspaces.create(body, actorOf(request));
  }

  @Get(':id')
  @WorkspaceRole('workspace.read')
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  read(@Param('id') id: string): Promise<WorkspaceView> {
    return this.workspaces.read(id);
  }

  @Patch(':id')
  @WorkspaceRole('workspace.settings')
  @ApiOperation({ summary: 'Rename, describe, archive or unarchive' })
  @ApiZodBody(updateWorkspaceSchema)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) body: UpdateWorkspaceRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceView> {
    return this.workspaces.update(id, body, actorOf(request));
  }

  @Get(':id/members')
  @WorkspaceRole('workspace.members')
  @ApiOperation({ summary: 'Members of the workspace; Owner only' })
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN' })
  listMembers(@Param('id') id: string): Promise<MembershipView[]> {
    return this.memberships.list(id);
  }

  @Post(':id/members')
  @WorkspaceRole('workspace.members')
  @ApiOperation({ summary: 'Add a member or change a role; Owner only' })
  @ApiZodBody(memberSchema)
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN' })
  @ApiResponse({ status: 409, description: 'WORKSPACE_LAST_OWNER' })
  putMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(memberSchema)) body: MemberRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<MembershipView> {
    return this.memberships.put(id, body, actorOf(request));
  }

  @Delete(':id/members/:userId')
  @WorkspaceRole('workspace.members')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a member; Owner only' })
  @ApiResponse({ status: 409, description: 'WORKSPACE_LAST_OWNER' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.memberships.remove(id, userId, actorOf(request));
  }

  @Get(':id/documents')
  @WorkspaceRole('workspace.read')
  @ApiOperation({ summary: 'Documents in a workspace, with the ingestion state of each' })
  @ApiResponse({ status: 200, description: 'Reader and above' })
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN — not a member' })
  listDocuments(@Param('id') id: string): Promise<unknown[]> {
    return this.documentsListing.list(id);
  }

  @Post(':id/documents')
  @Roles('document.manage')
  @WorkspaceRole('workspace.documents')
  @UseGuards(ContentLengthGuard)
  @UseFilters(UploadLimitFilter)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: `Upload a document, up to ${MAX_UPLOAD_MB} MB` })
  @ApiResponse({ status: 201, description: 'Stored; the storage key is derived from the content' })
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN — Editor or Owner required' })
  @ApiResponse({ status: 413, description: 'DOC_TOO_LARGE — the response states the limit' })
  upload(
    @Param('id') id: string,
    @UploadedFile() file: MultipartFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    if (!file) {
      throw new AppException('VALIDATION_FAILED', 'Missing the "file" part of the multipart body');
    }
    return this.uploads.store(id, actorOf(request), file);
  }
}
