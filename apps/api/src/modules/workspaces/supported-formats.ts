import { extname } from 'node:path';

export interface SupportedFormat {
  id: string;
  extensions: readonly string[];
  contentType: string;
}

// The ten of FR-02 and design §2, and no more. ZIP is refused here on purpose: expansion is
// WP-5.1, and a format accepted before anything can read it is a document stuck at `uploaded`.
export const SUPPORTED_FORMATS: readonly SupportedFormat[] = [
  { id: 'pdf', extensions: ['.pdf'], contentType: 'application/pdf' },
  {
    id: 'docx',
    extensions: ['.docx'],
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    id: 'xlsx',
    extensions: ['.xlsx'],
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    id: 'pptx',
    extensions: ['.pptx'],
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  { id: 'txt', extensions: ['.txt'], contentType: 'text/plain' },
  { id: 'md', extensions: ['.md', '.markdown'], contentType: 'text/markdown' },
  { id: 'csv', extensions: ['.csv'], contentType: 'text/csv' },
  { id: 'png', extensions: ['.png'], contentType: 'image/png' },
  { id: 'jpg', extensions: ['.jpg', '.jpeg'], contentType: 'image/jpeg' },
  { id: 'tiff', extensions: ['.tiff', '.tif'], contentType: 'image/tiff' },
];

export const SUPPORTED_EXTENSIONS: readonly string[] = SUPPORTED_FORMATS.flatMap(
  (format) => format.extensions,
);

export function describeSupportedFormats(): string {
  return SUPPORTED_FORMATS.map((format) => format.id.toUpperCase()).join(', ');
}

export function formatForFilename(filename: string): SupportedFormat | undefined {
  const extension = extname(filename).toLowerCase();
  return SUPPORTED_FORMATS.find((format) => format.extensions.includes(extension));
}
