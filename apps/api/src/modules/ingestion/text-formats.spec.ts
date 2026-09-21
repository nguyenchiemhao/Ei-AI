import { describe, expect, it } from 'vitest';
import { needsNoParser } from './text-formats';

describe('needsNoParser', () => {
  it.each(['hợp đồng.md', 'notes.markdown', 'ghi chú.txt', 'bảng giá.csv'])(
    'reads %s without a parser',
    (filename) => {
      expect(needsNoParser(filename)).toBe(true);
    },
  );

  it.each(['hợp đồng.pdf', 'báo cáo.docx', 'bảng.xlsx', 'slide.pptx', 'scan.png', 'scan.tiff'])(
    'leaves %s for the parser in 2A',
    (filename) => {
      expect(needsNoParser(filename)).toBe(false);
    },
  );

  it('refuses a format the system does not admit at all', () => {
    expect(needsNoParser('archive.zip')).toBe(false);
    expect(needsNoParser('page.html')).toBe(false);
  });

  it('reads the extension whatever its case', () => {
    expect(needsNoParser('HỢP ĐỒNG.MD')).toBe(true);
  });

  it('refuses a name with no extension at all', () => {
    expect(needsNoParser('hợp đồng')).toBe(false);
  });
});
