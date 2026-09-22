import { SetMetadata } from '@nestjs/common';
import type { SystemAction, WorkspaceAction } from '@ei-ai/shared-types';

export const SYSTEM_ACTION = 'ei-ai:system-action';
export const WORKSPACE_ACTION = 'ei-ai:workspace-action';

/** The workspace a `@WorkspaceRole()` route is about, when it is not the `:id` parameter. */
export type WorkspaceSource = 'param' | 'document';

export interface WorkspaceActionMetadata {
  action: WorkspaceAction;
  from: WorkspaceSource;
  param: string;
}

// The route says which row of design §9.1 it is, and nothing else. Which roles that admits is the
// table's business, so a permission change is one edit in `shared-types` rather than a search.
export const Roles = (action: SystemAction) => SetMetadata(SYSTEM_ACTION, action);

// `from` exists because a workspace is not always in the path: `/documents/:id` names a document
// and the guard resolves the workspace through it.
export const WorkspaceRole = (
  action: WorkspaceAction,
  options: { from?: WorkspaceSource; param?: string } = {},
) =>
  SetMetadata<string, WorkspaceActionMetadata>(WORKSPACE_ACTION, {
    action,
    from: options.from ?? 'param',
    param: options.param ?? 'id',
  });
