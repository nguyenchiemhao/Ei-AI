import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  languageHint: z.string().trim().min(2).max(16).optional(),
});

// Every field optional, but not all of them absent: a PATCH that changes nothing is a mistake
// worth naming rather than a request to serve.
export const updateWorkspaceSchema = createWorkspaceSchema
  .partial()
  .extend({ status: z.enum(['active', 'archived']).optional() })
  .refine((body) => Object.keys(body).length > 0, { message: 'no fields to update' });

export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceSchema>;

export interface WorkspaceView {
  id: string;
  name: string;
  description: string | null;
  languageHint: string;
  status: string;
  createdBy: string;
  createdAt: Date;
}

export const memberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['Owner', 'Editor', 'Reader']),
});

export type MemberRequest = z.infer<typeof memberSchema>;
