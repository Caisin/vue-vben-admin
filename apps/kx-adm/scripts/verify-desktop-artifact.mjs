import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** 校验 Tauri 当前签名格式的包和可信注释，防止误把其它版本/公钥的签名录入清单。 */
export async function verifyDesktopArtifact(file, signature, publicKey) {
  const publicLines = Buffer.from(publicKey.trim(), 'base64')
    .toString('utf8')
    .trim()
    .split(/\r?\n/);
  const lines = Buffer.from(signature.trim(), 'base64')
    .toString('utf8')
    .trim()
    .split(/\r?\n/);
  const pub = Buffer.from(publicLines[1] ?? '', 'base64');
  const packet = Buffer.from(lines[1] ?? '', 'base64');
  if (
    pub.length !== 42 ||
    packet.length !== 74 ||
    packet.subarray(0, 2).toString() !== 'ED' ||
    !lines[2]?.startsWith('trusted comment: ') ||
    !pub.subarray(2, 10).equals(packet.subarray(2, 10))
  )
    throw new Error('包签名格式或公钥不匹配');
  const key = createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      pub.subarray(10),
    ]),
    format: 'der',
    type: 'spki',
  });
  const digest = createHash('blake2b512');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  const sig = packet.subarray(10);
  const comment = Buffer.from(lines[2].slice('trusted comment: '.length));
  if (
    !verify(null, digest.digest(), key, sig) ||
    !verify(
      null,
      Buffer.concat([sig, comment]),
      key,
      Buffer.from(lines[3] ?? '', 'base64'),
    )
  )
    throw new Error('更新包或签名已变更，验证失败');
}
