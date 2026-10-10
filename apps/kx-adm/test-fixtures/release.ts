import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';

import { tarHeader } from '../scripts/release-archive.mjs';

export function releaseTgz(
  override: Record<string, unknown> = {},
  payload = new Uint8Array([1, 2, 3]),
  declaredSize = payload.length,
) {
  const data = {
    version: '0.1.1',
    notes: '说明',
    name: 'app.app.tar.gz',
    target: 'darwin-aarch64',
    signature: 'signed',
    size: payload.length,
    ...override,
  };
  const metadata = Buffer.from(JSON.stringify(data));
  return gzipSync(
    Buffer.concat([
      tarHeader('release.json', metadata.length),
      metadata,
      Buffer.alloc((512 - (metadata.length % 512)) % 512),
      tarHeader('installer', declaredSize),
      Buffer.from(payload),
      Buffer.alloc((512 - (payload.length % 512)) % 512),
      Buffer.alloc(1024),
    ]),
  );
}
