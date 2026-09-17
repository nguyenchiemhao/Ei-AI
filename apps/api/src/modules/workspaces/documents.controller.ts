import { Controller, Get, Param, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppException } from '../../common/app-exception';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest, ResponseLike } from '../../common/http.types';
import { DownloadsService } from './downloads.service';

// RFC 5987. A Vietnamese filename is not latin-1, and a bare `filename=` would arrive mangled.
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly downloads: DownloadsService) {}

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download the current version; always an attachment, never rendered',
  })
  @ApiResponse({ status: 200, description: 'The file contents, Content-Disposition: attachment' })
  @ApiResponse({ status: 403, description: 'AUTHZ_WORKSPACE_FORBIDDEN' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  async download(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: ResponseLike,
  ): Promise<StreamableFile> {
    const principal = request.principal;
    if (!principal) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Missing access token');
    }
    const document = await this.downloads.current(id, principal.userId);

    // Attachment so no browser renders it, and nosniff so none second-guesses the type it was
    // given. An uploaded file is never executed server-side either: it is streamed, never read.
    response.setHeader('Content-Disposition', contentDisposition(document.filename));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Type', document.contentType);
    response.setHeader('Content-Length', String(document.byteSize));
    return new StreamableFile(document.body);
  }
}
