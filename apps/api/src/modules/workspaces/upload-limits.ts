// The number is the one `document_versions.byte_size` already enforces with a CHECK, so it is
// written once here and not made configurable: a configured limit above the CHECK would let a
// file through the API only to be refused by the database.
export const MAX_UPLOAD_BYTES = 209_715_200;

export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

export function describeLimit(): string {
  return `Tài liệu vượt quá ${MAX_UPLOAD_MB} MB`;
}

// A declared length above the limit is refused before a single byte of the body is read. It is
// only the client's own claim, so the byte counter behind it is what actually decides.
export function declaredLengthExceedsLimit(header: string | string[] | undefined): boolean {
  const raw = Array.isArray(header) ? header[0] : header;
  const declared = Number(raw);
  return Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES;
}
