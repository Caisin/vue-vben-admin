import type { UploadFile } from '#/api/storage';

const MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac',
  avi: 'video/x-msvideo',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  m4a: 'audio/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  wav: 'audio/wav',
  webm: 'video/webm',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

interface FileTypeCandidate {
  extension: string;
  mime: string;
}

export function normalizeAccept(accept?: string | string[]) {
  const values = Array.isArray(accept) ? accept : (accept?.split(',') ?? []);
  return [
    ...new Set(
      values.map((value) => value.trim().toLowerCase()).filter(Boolean),
    ),
  ];
}

function extensionFromName(name: string) {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index + 1).toLowerCase();
}

function matches(candidate: FileTypeCandidate, accept?: string | string[]) {
  const rules = normalizeAccept(accept);
  if (rules.length === 0 || rules.includes('*/*')) return true;

  return rules.some((rule) => {
    if (rule.startsWith('.')) return candidate.extension === rule.slice(1);
    if (rule.endsWith('/*')) {
      return (
        Boolean(candidate.mime) && candidate.mime.startsWith(rule.slice(0, -1))
      );
    }
    return Boolean(candidate.mime) && candidate.mime === rule;
  });
}

export function acceptsBrowserFile(file: File, accept?: string | string[]) {
  const extension = extensionFromName(file.name);
  return matches(
    {
      extension,
      mime: file.type.toLowerCase() || MIME_BY_EXTENSION[extension] || '',
    },
    accept,
  );
}

export function acceptsStoredFile(
  file: UploadFile,
  accept?: string | string[],
) {
  const extension = file.file_ext.toLowerCase();
  return matches(
    { extension, mime: MIME_BY_EXTENSION[extension] || '' },
    accept,
  );
}
