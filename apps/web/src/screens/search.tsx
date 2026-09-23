import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api-client';
import { useAuth } from '../state/auth.store';

interface Passage {
  chunkId: string;
  documentId: string;
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

const ALL = 'all';

export function SearchScreen() {
  const memberships = useAuth((state) => state.me?.memberships ?? []);
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<string>(ALL);

  const search = useMutation({
    mutationFn: (asked: string) =>
      api.post<Passage[]>('/search', {
        question: asked,
        ...(scope === ALL ? {} : { workspaceIds: [scope] }),
      }),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (question.trim() !== '') search.mutate(question);
  };

  return (
    <section className="px-6 py-8">
      <h1 className="text-xl font-semibold">Search documents</h1>
      {/* Phase 1 returns passages, never prose. Saying so on the screen is the difference between
          a person checking a quotation and a person trusting a summary nothing generated. */}
      <p className="mt-1 text-sm text-muted-foreground">
        Passages from your documents, with the file and position they came from. No generated text.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-wrap gap-2">
        <Input
          aria-label="Question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ví dụ: điều khoản thanh toán trong hợp đồng"
          className="min-w-64 flex-1"
        />
        <select
          aria-label="Workspace"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value={ALL}>All my workspaces</option>
          {memberships.map((membership) => (
            <option key={membership.workspaceId} value={membership.workspaceId}>
              {membership.workspaceName}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={search.isPending}>
          {search.isPending ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {search.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {search.error.message}
        </p>
      )}

      {search.isSuccess && search.data.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing matched. Nothing was invented to fill the gap.
        </p>
      )}

      <ol className="mt-6 space-y-4" data-testid="passages">
        {(search.data ?? []).map((passage) => (
          <li key={passage.chunkId} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
              <Link to={`/documents/${passage.documentId}`} className="font-medium hover:underline">
                {passage.sourceFilename}
              </Link>
              <span>
                chunk {passage.chunkNo} · characters {passage.charStart}–{passage.charEnd} · pages{' '}
                {passage.pageFrom}–{passage.pageTo}
              </span>
              <span className="ml-auto">relevance {passage.relevance.toFixed(3)}</span>
            </div>
            {passage.headingPath !== null && (
              <p className="mt-1 text-xs text-muted-foreground">{passage.headingPath}</p>
            )}
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{passage.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
