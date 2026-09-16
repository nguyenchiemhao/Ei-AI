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
import { ContentLengthGuard } from './content-length.guard';
import { MembershipsService } from './memberships.service';
import type { MembershipView } from './workspace-members.repository';
import { UploadLimitFilter } from './upload-limit.filter';
import { MAX_UPLOAD_MB } from './upload-limits';
import { type UploadedFile as MultipartFile, UploadService } from './upload.service';
import { WorkspacesService } from './workspaces.service';

function principalOf(request: AuthenticatedRequest): Principal {
  if (!request.principal) {
    throw new AppException('AUTH_INVALID_CREDENTIALS', 'Thiếu access token');
  }
  return request.principal;
}

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly uploads: UploadService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Workspace mà người gọi là thành viên, kể cả đã lưu trữ' })
  list(@Req() request: AuthenticatedRequest): Promise<WorkspaceView[]> {
    return this.workspaces.listFor(principalOf(request).userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo workspace; người tạo trở thành Owner' })
  @ApiZodBody(createWorkspaceSchema)
  @ApiResponse({ status: 409, description: 'WORKSPACE_NAME_TAKEN — tên là duy nhất toàn hệ thống' })
  create(
    @Body(new ZodValidationPipe(createWorkspaceSchema)) body: CreateWorkspaceRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceView> {
    return this.workspaces.create(body, principalOf(request).userId);
  }

  @Get(':id')
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  read(@Param('id') id: string): Promise<WorkspaceView> {
    return this.workspaces.read(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Đổi tên, mô tả, hoặc lưu trữ / bỏ lưu trữ' })
  @ApiZodBody(updateWorkspaceSchema)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) body: UpdateWorkspaceRequest,
  ): Promise<WorkspaceView> {
    return this.workspaces.update(id, body);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Thành viên của workspace; chỉ Owner đọc được' })
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN' })
  listMembers(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<MembershipView[]> {
    return this.memberships.list(id, principalOf(request).userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Thêm thành viên hoặc đổi vai trò; chỉ Owner' })
  @ApiZodBody(memberSchema)
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN' })
  @ApiResponse({ status: 409, description: 'WORKSPACE_LAST_OWNER' })
  putMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(memberSchema)) body: MemberRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<MembershipView> {
    return this.memberships.put(id, body, principalOf(request).userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Gỡ thành viên; chỉ Owner' })
  @ApiResponse({ status: 409, description: 'WORKSPACE_LAST_OWNER' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.memberships.remove(id, userId, principalOf(request).userId);
  }

  @Post(':id/documents')
  @UseGuards(ContentLengthGuard)
  @UseFilters(UploadLimitFilter)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: `Tải tài liệu lên, tối đa ${MAX_UPLOAD_MB} MB` })
  @ApiResponse({ status: 201, description: 'Đã lưu; khoá lưu trữ suy ra từ nội dung' })
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN — cần Editor hoặc Owner' })
  @ApiResponse({ status: 413, description: 'DOC_TOO_LARGE — có nêu giới hạn trong phản hồi' })
  upload(
    @Param('id') id: string,
    @UploadedFile() file: MultipartFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    if (!file) {
      throw new AppException('VALIDATION_FAILED', 'Thiếu phần "file" trong multipart');
    }
    return this.uploads.store(id, principalOf(request).userId, file);
  }
}
