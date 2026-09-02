import type { FileInputValue } from '#/components/file-picker/file-ref';

import { normalizeFileId } from '#/components/file-picker/file-ref';

export function normalizeArtifactFileId(value: FileInputValue) {
  const fileId = Number(normalizeFileId(value));
  return Number.isSafeInteger(fileId) && fileId > 0 ? fileId : undefined;
}
