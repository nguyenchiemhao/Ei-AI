import { describe, expect, it } from 'vitest';
import { splitIntoBlocks } from './markdown-blocks';

function textsOf(source: string): string[] {
  return splitIntoBlocks(source).map((b) => source.slice(b.start, b.end));
}

function trailsOf(source: string): (readonly string[])[] {
  return splitIntoBlocks(source).map((b) => b.headingPath);
}

describe('splitIntoBlocks', () => {
  it('finds nothing in an empty source', () => {
    expect(splitIntoBlocks('')).toEqual([]);
  });

  it('finds nothing in whitespace alone', () => {
    expect(splitIntoBlocks('\n\n   \n')).toEqual([]);
  });

  it('separates paragraphs on blank lines', () => {
    expect(textsOf('một\nhai\n\nba\n')).toEqual(['một\nhai', 'ba']);
  });

  it('gives every block offsets that slice it back out of the source', () => {
    const source = '# Điều 1\n\nNội dung thứ nhất.\n\nNội dung thứ hai.\n';
    for (const block of splitIntoBlocks(source)) {
      expect(source.slice(block.start, block.end)).not.toContain('\n\n');
    }
    expect(textsOf(source)).toEqual(['# Điều 1', 'Nội dung thứ nhất.', 'Nội dung thứ hai.']);
  });

  it('makes a heading a block of its own even without a blank line after it', () => {
    expect(textsOf('# Tiêu đề\nNội dung ngay dưới.\n')).toEqual([
      '# Tiêu đề',
      'Nội dung ngay dưới.',
    ]);
  });

  it('builds a heading trail that deepens with the level', () => {
    const source = '# Hợp đồng\n\n## Điều 1\n\n### Thanh toán\n\nNội dung.\n';
    expect(trailsOf(source).at(-1)).toEqual(['Hợp đồng', 'Điều 1', 'Thanh toán']);
  });

  it('truncates the trail when a shallower heading arrives', () => {
    const source = '# A\n\n## B\n\n### C\n\n## D\n\nNội dung.\n';
    expect(trailsOf(source).at(-1)).toEqual(['A', 'D']);
  });

  it('leaves the trail empty for text before the first heading', () => {
    expect(trailsOf('Lời mở đầu.\n\n# A\n')[0]).toEqual([]);
  });

  it('keeps a fenced code block whole, blank lines and all', () => {
    const source = '```sql\nSELECT 1;\n\nSELECT 2;\n```\n\nSau đó.\n';
    expect(textsOf(source)).toEqual(['```sql\nSELECT 1;\n\nSELECT 2;\n```', 'Sau đó.']);
  });

  it('does not read a hash inside a fence as a heading', () => {
    const source = '# Thật\n\n```\n# giả\n```\n\nNội dung.\n';
    expect(trailsOf(source).at(-1)).toEqual(['Thật']);
  });

  it('closes a tilde fence only on a tilde fence', () => {
    const source = '~~~\n```\nvẫn ở trong\n~~~\n\nSau đó.\n';
    expect(textsOf(source)).toEqual(['~~~\n```\nvẫn ở trong\n~~~', 'Sau đó.']);
  });

  it('reads a closing-hash heading without keeping the hashes', () => {
    expect(trailsOf('## Điều 2 ##\n\nNội dung.\n').at(-1)).toEqual(['Điều 2']);
  });

  it('keeps a table together as one block', () => {
    const source = '| a | b |\n| --- | --- |\n| 1 | 2 |\n\nSau đó.\n';
    expect(textsOf(source)).toEqual(['| a | b |\n| --- | --- |\n| 1 | 2 |', 'Sau đó.']);
  });
});
