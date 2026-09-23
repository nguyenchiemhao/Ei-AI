import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../lib/api-client';
import { type DocumentListing, INDEXED, stillWorking, type Workspace } from '../lib/documents';

// The document count and index state are counted here rather than read from the workspace: the API
// has no count on `GET /workspaces`, so one listing per workspace is what produces the number.
// Recorded as an open question in docs/plan/notes/WP-3.6.md — it belongs on the server.
function useWorkspaceCounts(workspaces: Workspace[]) {
  return useQueries({
    queries: workspaces.map((workspace) => ({
      queryKey: ['documents', workspace.id],
      queryFn: () => api.get<DocumentListing[]>(`/workspaces/${workspace.id}/documents`),
      refetchInterval: (query: { state: { data: DocumentListing[] | undefined } }) =>
        stillWorking(query.state.data) ? 2000 : false,
    })),
    combine: (results) =>
      new Map(
        workspaces.map((workspace, index) => {
          const documents = results[index]?.data;
          return [
            workspace.id,
            documents === undefined
              ? null
              : {
                  total: documents.length,
                  indexed: documents.filter((d) => d.status === INDEXED).length,
                },
          ];
        }),
      ),
  });
}

export function WorkspacesScreen() {
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<Workspace[]>('/workspaces'),
  });
  const counts = useWorkspaceCounts(workspaces.data ?? []);

  return (
    <section className="px-6 py-8">
      {/* The heading stays put through loading and failure — see workspace-documents.tsx. */}
      <h1 className="text-xl font-semibold">Workspaces</h1>
      {workspaces.isPending && <p className="mt-6 text-sm">Loading workspaces…</p>}
      {workspaces.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {workspaces.error.message}
        </p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(workspaces.data ?? []).map((workspace) => {
          const count = counts.get(workspace.id);
          return (
            <li key={workspace.id} className="rounded-lg border border-border p-4">
              <Link to={`/workspaces/${workspace.id}`} className="font-medium hover:underline">
                {workspace.name}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {workspace.description ?? 'No description'}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {count === null || count === undefined
                  ? 'Counting…'
                  : `${count.total} documents · ${count.indexed} indexed`}
                {workspace.status === 'archived' && ' · archived'}
              </p>
            </li>
          );
        })}
      </ul>
      {workspaces.isSuccess && workspaces.data.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          You are not a member of any workspace yet.
        </p>
      )}
    </section>
  );
}
