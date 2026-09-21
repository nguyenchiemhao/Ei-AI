import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { IdentityModule } from '../identity/identity.module';
import { IngestQueueModule } from '../ingestion/ingest-queue.module';
import { ContentLengthGuard } from './content-length.guard';
import { DocumentVersionsRepository } from './document-versions.repository';
import { DocumentsController } from './documents.controller';
import { DocumentsListingService } from './documents-listing.service';
import { DocumentsRepository } from './documents.repository';
import { DownloadsService } from './downloads.service';
import { MembershipsService } from './memberships.service';
import { WorkspaceMembersRepository } from './workspace-members.repository';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesRepository } from './workspaces.repository';
import { MAX_UPLOAD_BYTES } from './upload-limits';
import { UploadService } from './upload.service';
import { WorkspacesService } from './workspaces.service';

// IdentityModule is imported for JwtAuthGuard, which it provides. Design §5.4 already has the
// API gateway depending on Identity; nothing here reaches into another module's service.
// Multer writes to a directory beside the objects rather than into memory: a 200 MB file held
// in RAM per concurrent upload is the kind of limit that only shows up under load.
@Module({
  imports: [
    IdentityModule,
    IngestQueueModule,
    MulterModule.registerAsync({
      inject: [CONFIG],
      useFactory: (config: Env) => {
        const destination = join(config.UPLOADS_DIR, 'incoming');
        mkdirSync(destination, { recursive: true });
        return { storage: diskStorage({ destination }), limits: { fileSize: MAX_UPLOAD_BYTES } };
      },
    }),
  ],
  controllers: [WorkspacesController, DocumentsController],
  providers: [
    WorkspacesService,
    MembershipsService,
    UploadService,
    DocumentsListingService,
    ContentLengthGuard,
    DocumentsRepository,
    DocumentVersionsRepository,
    DownloadsService,
    WorkspacesRepository,
    WorkspaceMembersRepository,
  ],
  exports: [
    WorkspacesService,
    MembershipsService,
    WorkspacesRepository,
    WorkspaceMembersRepository,
    // Read by the ingestion pipeline, which owns no documents table of its own. A repository is
    // not a *.service.ts, so architecture rule 3 is satisfied by exporting it rather than bypassed.
    DocumentsRepository,
    DocumentVersionsRepository,
  ],
})
export class WorkspacesModule {}
