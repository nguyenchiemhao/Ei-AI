export interface DocumentListing {
  id: string;
  title: string;
  sourceFilename: string;
  contentType: string;
  createdAt: string;
  versionId: string | null;
  versionNo: number | null;
  status: string | null;
  statusReason: string | null;
  byteSize: number | null;
  pageCount: number | null;
  chunkerVersion: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  languageHint: string;
  status: string;
  createdAt: string;
}

export const INDEXED = 'indexed';

// `indexed` and `failed` are the two states nothing moves out of on its own; a document in any
// other state has a worker still working on it. A table of ingestion states that never refetches
// shows the state at the moment the page opened and calls it the state.
const SETTLED = new Set([INDEXED, 'failed']);

export function stillWorking(documents: DocumentListing[] | undefined): boolean {
  return (documents ?? []).some((document) => !SETTLED.has(document.status ?? ''));
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
