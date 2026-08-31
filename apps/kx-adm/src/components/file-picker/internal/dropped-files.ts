function readFile(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(entry: FileSystemDirectoryEntry) {
  const reader = entry.createReader();
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const result: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(result);
          return;
        }
        result.push(...entries);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function filesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) return [await readFile(entry as FileSystemFileEntry)];
  if (!entry.isDirectory) return [];
  const children = await readDirectoryEntries(
    entry as FileSystemDirectoryEntry,
  );
  const nested = await Promise.all(
    children.map((child) => filesFromEntry(child)),
  );
  return nested.flat();
}

export async function filesFromDataTransfer(dataTransfer: DataTransfer) {
  const entries = [...dataTransfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter(
      (entry): entry is FileSystemEntry =>
        entry !== null && entry !== undefined,
    );
  if (entries.length === 0) return [...dataTransfer.files];
  const nested = await Promise.all(
    entries.map((entry) => filesFromEntry(entry)),
  );
  return nested.flat();
}
