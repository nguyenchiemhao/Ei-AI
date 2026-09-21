import { z } from 'zod';

export const searchSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  // Absent means every workspace the caller belongs to. Naming workspaces narrows the search; the
  // permission predicate decides what is readable either way, so this can never widen it.
  workspaceIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

export type SearchRequest = z.infer<typeof searchSchema>;

// What a passage has to carry for a reader to check it: which file it came from, where in that
// file, and the text itself. No generated prose anywhere — Phase 1 returns passages, not answers.
export interface PassageView {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  title: string;
  sourceFilename: string;
  chunkNo: number;
  charStart: number;
  charEnd: number;
  pageFrom: number;
  pageTo: number;
  headingPath: string | null;
  text: string;
  relevance: number;
}
