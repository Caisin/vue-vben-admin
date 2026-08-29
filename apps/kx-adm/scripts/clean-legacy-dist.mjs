import { readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const RES_OUTPUT = 'res';
const scriptPath = fileURLToPath(import.meta.url);
const defaultDistDir = resolve(dirname(scriptPath), '../dist');

export async function cleanLegacyDist(distDir = defaultDistDir) {
  let entries;
  try {
    entries = await readdir(distDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const removed = [];
  for (const entry of entries) {
    if (entry.name === RES_OUTPUT) continue;

    // RES 只部署 dist/res，根目录中的其它产物都属于旧多产品布局。
    await rm(resolve(distDir, entry.name), { force: true, recursive: true });
    removed.push(entry.name);
  }
  return removed.toSorted((left, right) => left.localeCompare(right));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await cleanLegacyDist();
}
