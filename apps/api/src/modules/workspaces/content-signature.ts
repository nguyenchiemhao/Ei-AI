export interface Signature {
  offset: number;
  bytes: readonly number[];
}

// Magic bytes for the ten formats, hand-written rather than pulled from a library: `file-type`
// has been ESM-only since v17 while this application compiles to CommonJS, its last CommonJS
// release is from 2021, and it recognises some two hundred formats where ten are admitted.
const SIGNATURES: Readonly<Record<string, readonly Signature[]>> = {
  pdf: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  // The OOXML trio are ZIP containers; the part that tells them apart is inside the archive,
  // which is why they share one signature here and their extension decides which they claim.
  docx: [{ offset: 0, bytes: [0x50, 0x4b] }],
  xlsx: [{ offset: 0, bytes: [0x50, 0x4b] }],
  pptx: [{ offset: 0, bytes: [0x50, 0x4b] }],
  png: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  jpg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  tiff: [
    { offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00] }, // little endian
    { offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // big endian
  ],
};

// TXT, MD and CSV have no signature at all — they are whatever bytes a person typed. Refusing
// them for lacking one would refuse every valid text file, so they are checked for being text
// rather than for matching a pattern.
const TEXT_FORMATS = new Set(['txt', 'md', 'csv']);

export const SIGNATURE_SAMPLE_BYTES = 512;

function matches(sample: Buffer, signature: Signature): boolean {
  return signature.bytes.every((byte, index) => sample[signature.offset + index] === byte);
}

// Control characters no text file contains. NUL is the one that decides: an ELF header carries
// one within its first eight bytes, and UTF-8 text never does.
function isBinaryByte(byte: number): boolean {
  return byte < 0x09 || byte === 0x0b || byte === 0x0c || (byte >= 0x0e && byte <= 0x1f);
}

function looksBinary(sample: Buffer): boolean {
  return sample.some(isBinaryByte);
}

export function contentMatchesFormat(formatId: string, sample: Buffer): boolean {
  if (TEXT_FORMATS.has(formatId)) {
    return !looksBinary(sample);
  }
  const signatures = SIGNATURES[formatId];
  return signatures !== undefined && signatures.some((signature) => matches(sample, signature));
}
