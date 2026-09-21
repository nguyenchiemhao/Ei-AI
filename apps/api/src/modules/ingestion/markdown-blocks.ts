// A block is a range of the source, never a copy of it: every chunk is a contiguous slice, which
// is what lets `char_start`/`char_end` resolve back to the original file exactly (FR-04).
export interface MarkdownBlock {
  start: number;
  end: number;
  headingPath: readonly string[];
}

const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;

function headingTrail(trail: string[], level: number, title: string): string[] {
  return [...trail.slice(0, level - 1), title];
}

// Blank lines separate blocks, a heading is a block of its own, and a fenced code block is atomic —
// a blank line or a `#` inside a fence is content, not structure.
export function splitIntoBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let trail: string[] = [];
  let start: number | null = null;
  let end = 0;
  let fence: string | null = null;
  let offset = 0;

  const close = (): void => {
    if (start !== null) blocks.push({ start, end, headingPath: trail });
    start = null;
  };

  for (const line of source.split('\n')) {
    const lineStart = offset;
    offset += line.length + 1;

    const fenceMark = FENCE.exec(line)?.[1];
    if (fence !== null) {
      end = lineStart + line.length;
      if (fenceMark === fence) {
        fence = null;
        close();
      }
      continue;
    }
    if (fenceMark !== undefined) {
      close();
      fence = fenceMark;
      start = lineStart;
      end = lineStart + line.length;
      continue;
    }

    if (line.trim() === '') {
      close();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      close();
      trail = headingTrail(trail, heading[1]!.length, heading[2]!);
      blocks.push({
        start: lineStart,
        end: lineStart + line.length,
        headingPath: trail,
      });
      continue;
    }

    if (start === null) start = lineStart;
    end = lineStart + line.length;
  }
  close();
  return blocks;
}
