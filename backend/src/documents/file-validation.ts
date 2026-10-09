import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENTS = {
  '.pdf': { mimeType: 'application/pdf', label: 'PDF' },
  '.png': { mimeType: 'image/png', label: 'PNG' },
  '.jpg': { mimeType: 'image/jpeg', label: 'JPEG' },
  '.jpeg': { mimeType: 'image/jpeg', label: 'JPEG' },
  '.docx': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'DOCX' },
  '.xlsx': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'XLSX' },
} as const;

export interface IncomingDocumentFile { originalname: string; mimetype: string; buffer: Buffer; size: number }
export interface ValidatedDocumentFile { originalFilename: string; mimeType: string; extension: string; content: Buffer; size: number }

export function validateDocumentFile(file: IncomingDocumentFile | undefined): ValidatedDocumentFile {
  if (!file || !Buffer.isBuffer(file.buffer)) throw new BadRequestException('A file is required.');
  const size = file.buffer.length;
  if (size > MAX_DOCUMENT_SIZE) throw new PayloadTooLargeException('Maximum file size is 10 MB.');
  if (size === 0) throw new BadRequestException('Empty files are not allowed.');

  const originalFilename = safeOriginalFilename(file.originalname);
  const extension = originalFilename.slice(originalFilename.lastIndexOf('.')).toLowerCase();
  const allowed = ALLOWED_DOCUMENTS[extension as keyof typeof ALLOWED_DOCUMENTS];
  if (!allowed || file.mimetype.toLowerCase() !== allowed.mimeType || !contentMatches(extension, file.buffer)) {
    throw new BadRequestException('File extension, MIME type, or content is not allowed.');
  }
  return { originalFilename, mimeType: allowed.mimeType, extension, content: file.buffer, size };
}

export function safeOriginalFilename(input: string): string {
  if (input.includes('/') || input.includes('\\')) throw new BadRequestException('Filename paths are not allowed.');
  const safe = input.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!safe || safe === '.' || safe === '..' || safe.length > 255) throw new BadRequestException('Invalid filename.');
  return safe;
}

// se valida la firma real del archivo, no solo la extensión
function contentMatches(extension: string, content: Buffer): boolean {
  if (extension === '.pdf') return content.length >= 5 && content.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.png') return content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.jpg' || extension === '.jpeg') return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (extension === '.docx' || extension === '.xlsx') {
    const entries = zipEntryNames(content);
    const common = entries.has('[Content_Types].xml');
    return extension === '.docx' ? common && entries.has('word/document.xml') : common && entries.has('xl/workbook.xml');
  }
  return false;
}

function zipEntryNames(content: Buffer): Set<string> {
  const names = new Set<string>();
  const minimum = Math.max(0, content.length - 65_557);
  let endRecord = -1;
  for (let offset = content.length - 22; offset >= minimum; offset -= 1) {
    if (content.readUInt32LE(offset) === 0x06054b50) { endRecord = offset; break; }
  }
  if (endRecord < 0) return names;
  const count = content.readUInt16LE(endRecord + 10);
  let offset = content.readUInt32LE(endRecord + 16);
  for (let index = 0; index < count && offset + 46 <= content.length; index += 1) {
    if (content.readUInt32LE(offset) !== 0x02014b50) break;
    const nameLength = content.readUInt16LE(offset + 28);
    const extraLength = content.readUInt16LE(offset + 30);
    const commentLength = content.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength + extraLength + commentLength > content.length) break;
    names.add(content.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
