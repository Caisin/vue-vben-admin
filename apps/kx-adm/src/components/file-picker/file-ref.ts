import type { FileId } from './types';

import type { UploadFile } from '#/api/storage';

export type StorageFileMediaType = 'file' | 'image' | 'video';

export interface StorageFileReference {
  file_ext?: string;
  file_id: FileId;
  file_name?: string;
  media_type?: StorageFileMediaType;
  size?: number | string;
}

export type FileInputValue = '' | FileId | StorageFileReference;
export type FileListInputValue = Array<FileId | StorageFileReference> | string;

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);
const VIDEO_EXTENSIONS = new Set([
  'avi',
  'm4v',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'webm',
]);

export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export function isFileReference(value: unknown): value is StorageFileReference {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'file_id' in value,
  );
}

export function normalizeFileId(value: unknown): FileId | undefined {
  if (isFileReference(value)) return normalizeFileId(value.file_id);
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const trimmed: string = String(value).trim();
  if (!trimmed || isHttpUrl(trimmed)) return undefined;
  const storageMatch = /^storage:file:(.+)$/i.exec(trimmed);
  const id = storageMatch?.[1] || trimmed;
  if (/^[1-9]\d*$/u.test(id)) {
    const numeric = Number(id);
    if (Number.isSafeInteger(numeric)) return numeric;
  }
  return id;
}

export function fileKindFromExt(ext?: string): StorageFileMediaType {
  const normalized = String(ext ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  if (IMAGE_EXTENSIONS.has(normalized)) return 'image';
  if (VIDEO_EXTENSIONS.has(normalized)) return 'video';
  return 'file';
}

export function fileKindFromName(name?: string): StorageFileMediaType {
  const ext = String(name ?? '')
    .split('.')
    .pop();
  return fileKindFromExt(ext);
}

function fileKindFromExtOrName(
  ext?: string,
  name?: string,
): StorageFileMediaType {
  const extKind = fileKindFromExt(ext);
  if (extKind !== 'file') return extKind;
  return fileKindFromName(name);
}

export function fileKindFromReference(value: unknown): StorageFileMediaType {
  if (isFileReference(value)) {
    if (value.media_type === 'image' || value.media_type === 'video') {
      return value.media_type;
    }
    return fileKindFromExtOrName(value.file_ext, value.file_name);
  }
  if (typeof value === 'string' && isHttpUrl(value))
    return fileKindFromName(value);
  return 'file';
}

export function toFileReference(file: UploadFile): StorageFileReference {
  return {
    file_ext: file.file_ext,
    file_id: file.file_id,
    file_name: file.file_name,
    media_type: fileKindFromExtOrName(file.file_ext, file.file_name),
    size: file.size,
  };
}

export function displayFileReference(
  value: FileId | StorageFileReference,
): string {
  if (isFileReference(value)) {
    const name = value.file_name?.trim();
    const ext = value.file_ext?.trim();
    if (name && ext && !name.endsWith(`.${ext}`)) return `${name}.${ext}`;
    return name || String(value.file_id);
  }
  return String(value);
}

export function parseFileListValue(
  value: FileListInputValue | undefined,
): Array<FileId | StorageFileReference> {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
