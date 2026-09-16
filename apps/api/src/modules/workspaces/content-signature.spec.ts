import { describe, expect, it } from 'vitest';
import { contentMatchesFormat, SIGNATURE_SAMPLE_BYTES } from './content-signature';

const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const TIFF_LE = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00]);
const TIFF_BE = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x08]);

describe('contentMatchesFormat, the formats with a signature', () => {
  it.each([
    ['pdf', PDF],
    ['png', PNG],
    ['jpg', JPG],
    ['tiff', TIFF_LE],
    ['tiff', TIFF_BE],
    ['docx', ZIP],
    ['xlsx', ZIP],
    ['pptx', ZIP],
  ])('accepts %s bytes', (format, sample) => {
    expect(contentMatchesFormat(format, sample)).toBe(true);
  });

  // The case FR-09 and this package's proving command exist for.
  it('refuses an ELF binary claiming to be a PDF', () => {
    expect(contentMatchesFormat('pdf', ELF)).toBe(false);
  });

  it.each([
    ['png', JPG],
    ['jpg', PNG],
    ['pdf', ZIP],
    ['tiff', PDF],
  ])('refuses %s when the bytes are another format', (format, sample) => {
    expect(contentMatchesFormat(format, sample)).toBe(false);
  });

  it('refuses a file too short to carry the signature', () => {
    expect(contentMatchesFormat('png', Buffer.from([0x89, 0x50]))).toBe(false);
    expect(contentMatchesFormat('pdf', Buffer.alloc(0))).toBe(false);
  });
});

describe('contentMatchesFormat, the formats with none', () => {
  // TXT, MD and CSV are whatever a person typed. Demanding a signature would refuse every one.
  it.each([['txt'], ['md'], ['csv']])('accepts %s that is plain text', (format) => {
    expect(contentMatchesFormat(format, Buffer.from('Hợp đồng số 118\nNgày 31/12/2026\n'))).toBe(
      true,
    );
  });

  it.each([['txt'], ['md'], ['csv']])('refuses %s whose bytes are a binary', (format) => {
    expect(contentMatchesFormat(format, ELF)).toBe(false);
    expect(contentMatchesFormat(format, PNG)).toBe(false);
  });

  it('accepts text carrying tabs and both kinds of line ending', () => {
    expect(contentMatchesFormat('csv', Buffer.from('a\tb\r\nc\td\n'))).toBe(true);
  });

  it('accepts an empty text file', () => {
    expect(contentMatchesFormat('md', Buffer.alloc(0))).toBe(true);
  });
});

describe('contentMatchesFormat, the rest', () => {
  it('refuses a format it has never heard of', () => {
    expect(contentMatchesFormat('exe', ELF)).toBe(false);
  });

  it('samples enough bytes to reach past a header', () => {
    expect(SIGNATURE_SAMPLE_BYTES).toBeGreaterThanOrEqual(512);
  });
});
