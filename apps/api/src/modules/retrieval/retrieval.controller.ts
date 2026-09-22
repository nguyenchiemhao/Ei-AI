import { Body, Controller, HttpCode, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../../common/api-docs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/http.types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type PassageView, type SearchRequest, searchSchema } from './dto/search.dto';
import { actorOf } from '../audit/audit-context';
import { RetrievalService } from './retrieval.service';

@ApiTags('retrieval')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class RetrievalController {
  constructor(private readonly retrieval: RetrievalService) {}

  // 200 rather than 201: a search creates nothing. It is a POST because a question is a body,
  // not a path — and because a question does not belong in a URL that gets logged.
  @Post()
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(searchSchema))
  @ApiZodBody(searchSchema)
  @ApiOperation({
    summary: 'Search indexed documents; returns cited passages, never generated text',
  })
  @ApiResponse({ status: 200, description: 'Passages with file name and character span' })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED' })
  async search(
    @Body() body: SearchRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<PassageView[]> {
    const passages = await this.retrieval.search(
      actorOf(request),
      body.question,
      body.workspaceIds,
    );
    return passages.map(({ score: _score, ...passage }) => passage);
  }
}
