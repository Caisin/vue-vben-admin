import type { Buffer } from 'node:buffer';

export function tarHeader(name: string, size: number): Buffer;
export function writeReleaseArchive(
  output: string,
  metadata: { size: number; [key: string]: unknown },
  source: string,
): Promise<void>;
