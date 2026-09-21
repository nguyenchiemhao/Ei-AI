export interface AttemptState {
  attemptsMade: number;
  attempts: number;
}

// BullMQ emits `failed` on every attempt, not only the last. A version is marked failed once the
// queue has given up, so the status a reader sees is not "failed" while a retry is still pending.
export function isFinalAttempt({ attemptsMade, attempts }: AttemptState): boolean {
  return attemptsMade >= Math.max(attempts, 1);
}

// The message alone, and only the first line of it: `status_reason` is read by a person looking at
// a document that did not index, and a stack trace in that column helps nobody.
export function failureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split('\n')[0]!.trim();
  return firstLine.length > 0 ? firstLine.slice(0, 500) : 'Ingestion failed without a message';
}
