import { formatForFilename } from '../workspaces/supported-formats';

// The formats the Markdown pass-through can read without a parser. Everything else is stored and
// stops at `uploaded` until the parser worker attaches in milestone 2A, which is Detail's own
// wording — the documents list then says so honestly rather than pretending to index them.
const PASS_THROUGH = new Set(['md', 'txt', 'csv']);

export function needsNoParser(filename: string): boolean {
  const format = formatForFilename(filename);
  return format !== undefined && PASS_THROUGH.has(format.id);
}
