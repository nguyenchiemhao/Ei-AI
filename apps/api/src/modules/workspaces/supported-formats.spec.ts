import { describe, expect, it } from 'vitest';
import {
  describeSupportedFormats,
  formatForFilename,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_FORMATS,
} from './supported-formats';

describe('supported formats', () => {
  // FR-02 and design §2 name ten and no more. A eleventh arriving unnoticed is how "ten formats"
  // quietly becomes "whatever we happened to accept".
  it('holds exactly the ten FR-02 names', () => {
    expect(SUPPORTED_FORMATS.map((format) => format.id)).toEqual([
      'pdf',
      'docx',
      'xlsx',
      'pptx',
      'txt',
      'md',
      'csv',
      'png',
      'jpg',
      'tiff',
    ]);
  });

  it('gives every format a distinct content type', () => {
    const types = SUPPORTED_FORMATS.map((format) => format.contentType);

    expect(new Set(types).size).toBe(types.length);
  });

  it('claims no extension twice', () => {
    expect(new Set(SUPPORTED_EXTENSIONS).size).toBe(SUPPORTED_EXTENSIONS.length);
  });

  it.each([
    ['hợp đồng.pdf', 'pdf'],
    ['báo cáo.DOCX', 'docx'],
    ['notes.md', 'md'],
    ['notes.markdown', 'md'],
    ['ảnh.JPG', 'jpg'],
    ['ảnh.jpeg', 'jpg'],
    ['scan.tif', 'tiff'],
    ['scan.tiff', 'tiff'],
  ])('reads %s as %s', (filename, id) => {
    expect(formatForFilename(filename)?.id).toBe(id);
  });

  it.each([['payload.exe'], ['bundle.zip'], ['page.html'], ['noextension'], ['archive.tar.gz']])(
    'does not recognise %s',
    (filename) => {
      expect(formatForFilename(filename)).toBeUndefined();
    },
  );

  it('names every format when it describes the list', () => {
    const description = describeSupportedFormats();

    for (const format of SUPPORTED_FORMATS) {
      expect(description).toContain(format.id.toUpperCase());
    }
  });
});
