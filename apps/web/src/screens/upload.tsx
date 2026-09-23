import { useQueryClient } from '@tanstack/react-query';
import { type DragEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { ApiError, api } from '../lib/api-client';
import { formatBytes } from '../lib/documents';

type Outcome =
  | { state: 'uploading' }
  | { state: 'stored'; detail: string }
  | { state: 'refused'; code: string; detail: string };

interface Attempt {
  key: string;
  name: string;
  size: number;
  outcome: Outcome;
}

// Every refusal the upload path can raise, in the words a person can act on. The codes come from
// design §7.4; anything not listed falls through to the server's own detail rather than a shrug.
const REFUSALS: Record<string, string> = {
  DOC_TOO_LARGE: 'Larger than the 200 MB limit.',
  DOC_UNSUPPORTED_FORMAT: 'This file type is not one of the ten supported formats.',
  DOC_CONTENT_MISMATCH: 'The contents do not match the file extension.',
  DOC_DUPLICATE: 'An identical file is already in this workspace.',
  AUTHZ_ROLE_FORBIDDEN: 'Your role may not upload documents.',
  AUTHZ_WORKSPACE_FORBIDDEN: 'You need to be an Editor or Owner of this workspace.',
};

function refusalOf(error: unknown): { code: string; detail: string } {
  if (error instanceof ApiError) {
    return { code: error.code, detail: REFUSALS[error.code] ?? error.detail };
  }
  return { code: 'TRANSPORT_ERROR', detail: 'The file could not be sent.' };
}

export function UploadScreen() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [over, setOver] = useState(false);

  // One request per file, so one refusal fails one file. A single multipart body carrying twenty
  // documents would make the twentieth file's refusal lose the nineteen that were fine.
  const upload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const key = `${file.name}:${String(file.size)}:${String(Date.now())}`;
      setAttempts((current) => [
        ...current,
        { key, name: file.name, size: file.size, outcome: { state: 'uploading' } },
      ]);
      const body = new FormData();
      body.append('file', file);
      const outcome: Outcome = await api
        .upload<{ status?: string }>(`/workspaces/${workspaceId!}/documents`, body)
        .then(
          (stored): Outcome => ({ state: 'stored', detail: stored.status ?? 'uploaded' }),
          (error: unknown): Outcome => ({ state: 'refused', ...refusalOf(error) }),
        );
      setAttempts((current) =>
        current.map((attempt) => (attempt.key === key ? { ...attempt, outcome } : attempt)),
      );
    }
    await queryClient.invalidateQueries({ queryKey: ['documents', workspaceId] });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void upload(event.dataTransfer.files);
  };

  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Upload documents</h1>
        <Button asChild variant="outline" size="sm">
          <Link to={`/workspaces/${workspaceId!}`}>Back to documents</Link>
        </Button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`mt-6 rounded-lg border-2 border-dashed p-10 text-center ${
          over ? 'border-primary bg-accent' : 'border-border'
        }`}
      >
        <p className="text-sm text-muted-foreground">Drop files here, or choose them.</p>
        <label className="mt-3 inline-block cursor-pointer text-sm font-medium text-primary">
          Choose files
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) void upload(event.target.files);
            }}
          />
        </label>
      </div>

      {attempts.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {attempts.map((attempt) => (
            <li key={attempt.key} className="flex items-baseline gap-3 px-3 py-2">
              <span className="text-sm">{attempt.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(attempt.size)}</span>
              <span
                className={`ml-auto text-xs ${
                  attempt.outcome.state === 'refused' ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {attempt.outcome.state === 'uploading' && 'Uploading…'}
                {attempt.outcome.state === 'stored' && `Stored · ${attempt.outcome.detail}`}
                {attempt.outcome.state === 'refused' &&
                  `${attempt.outcome.code} — ${attempt.outcome.detail}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
