import { describe, expect, it } from 'vitest';

import { filesFromDataTransfer } from '../internal/dropped-files';

function fileEntry(name: string) {
  return {
    isDirectory: false,
    isFile: true,
    file(success: (file: File) => void) {
      success(new File([name], name));
    },
  };
}

function directoryEntry(...batches: unknown[][]) {
  let index = 0;
  return {
    isDirectory: true,
    isFile: false,
    createReader: () => ({
      readEntries(success: (entries: unknown[]) => void) {
        success(batches[index++] ?? []);
      },
    }),
  };
}

describe('filesFromDataTransfer', () => {
  it('recursively reads every file from dropped directories', async () => {
    const nested = directoryEntry([fileEntry('nested.txt')], []);
    const root = directoryEntry(
      [fileEntry('first.txt')],
      [nested, fileEntry('last.txt')],
      [],
    );
    const transfer = {
      files: [],
      items: [{ webkitGetAsEntry: () => root }],
    } as unknown as DataTransfer;

    const files = await filesFromDataTransfer(transfer);
    expect(files.map((file) => file.name)).toEqual([
      'first.txt',
      'nested.txt',
      'last.txt',
    ]);
  });
});
