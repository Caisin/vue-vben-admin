// @vitest-environment node
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { it } from 'vitest';

import { verifyDesktopArtifact } from './verify-desktop-artifact.mjs';

it('发行包校验拒绝被替换的包、签名或公钥', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kx-release-'));
  try {
    const file = join(dir, 'app.tar.gz');
    const bytes = Buffer.from('signed artifact fixture');
    await writeFile(file, bytes);
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const rawKey = publicKey
      .export({ type: 'spki', format: 'der' })
      .subarray(-32);
    const header = Buffer.concat([Buffer.from('ED'), Buffer.alloc(8, 1)]);
    const pub = Buffer.from(
      `untrusted comment: fixture\n${Buffer.concat([header, rawKey]).toString('base64')}\n`,
    ).toString('base64');
    const sig = sign(
      null,
      createHash('blake2b512').update(bytes).digest(),
      privateKey,
    );
    const comment = 'timestamp:1\tfile:app.tar.gz';
    const globalSig = sign(
      null,
      Buffer.concat([sig, Buffer.from(comment)]),
      privateKey,
    );
    const signature = Buffer.from(
      `untrusted comment: fixture\n${Buffer.concat([header, sig]).toString('base64')}\ntrusted comment: ${comment}\n${globalSig.toString('base64')}\n`,
    ).toString('base64');
    await verifyDesktopArtifact(file, signature, pub);
    await writeFile(file, 'replaced');
    await assert.rejects(
      verifyDesktopArtifact(file, signature, pub),
      /验证失败/,
    );
    await writeFile(file, bytes);
    await assert.rejects(
      verifyDesktopArtifact(file, 'invalid', pub),
      /格式或公钥/,
    );
    await assert.rejects(
      verifyDesktopArtifact(file, signature, 'wrong-key'),
      /格式或公钥/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
