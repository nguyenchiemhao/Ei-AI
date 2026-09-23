import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { api } from '../lib/api-client';
import { type DocumentListing, formatBytes, stillWorking } from '../lib/documents';

// The reason is shown beside the state, not hidden behind a hover: a document stuck at `failed` is
// the one thing a person on this screen most needs to act on.
function StateCell({ document }: { document: DocumentListing }) {
  return (
    <td className="px-3 py-2 align-top">
      <span className="text-sm">{document.status ?? 'no version'}</span>
      {document.statusReason !== null && (
        <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{document.statusReason}</p>
      )}
    </td>
  );
}

export function WorkspaceDocumentsScreen() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const documents = useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: () => api.get<DocumentListing[]>(`/workspaces/${workspaceId!}/documents`),
    // Ingestion is a queue and a worker, so the state changes without the reader doing anything.
    // Polling stops as soon as every document has settled.
    refetchInterval: (query) => (stillWorking(query.state.data) ? 2000 : false),
  });

  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between">
        {/* The heading stays put through loading and failure: a screen that drops its title while
            it waits leaves the reader unsure which screen they are on. */}
        <h1 className="text-xl font-semibold">Documents</h1>
        <Button asChild size="sm">
          <Link to={`/workspaces/${workspaceId!}/upload`}>Upload</Link>
        </Button>
      </div>
      {documents.isPending && <p className="mt-6 text-sm">Loading documents…</p>}
      {documents.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {documents.error.message}
        </p>
      )}
      {documents.isSuccess && (
        <>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left">
          <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Pages</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(documents.data ?? []).map((document) => (
              <tr key={document.id}>
                <td className="px-3 py-2 align-top">
                  <Link to={`/documents/${document.id}`} className="text-sm hover:underline">
                    {document.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{document.sourceFilename}</p>
                </td>
                <StateCell document={document} />
                <td className="px-3 py-2 align-top text-sm">{document.pageCount ?? '—'}</td>
                <td className="px-3 py-2 align-top text-sm">{formatBytes(document.byteSize)}</td>
                <td className="px-3 py-2 align-top text-sm">
                  {new Date(document.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
          {documents.data.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              This workspace has no documents yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}
