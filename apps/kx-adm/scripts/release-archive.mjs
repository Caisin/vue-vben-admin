import { Buffer } from 'node:buffer';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

/** 固定两个普通文件的 USTAR 归档；大文件按块读取，不改变安装包字节。 */
export function tarHeader(name, size) {
  if (!Number.isSafeInteger(size) || size < 0)
    throw new Error('归档文件大小无效');
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000600\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  if (size <= 8_589_934_591) {
    header.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  } else {
    header[124] = 0x80;
    header.writeBigUInt64BE(BigInt(size), 128);
  }
  header.write('00000000000\0', 136);
  header.fill(32, 148, 156);
  header[156] = 48;
  header.write('ustar\0', 257);
  header.write('00', 263);
  const sum = header.reduce((total, value) => total + value, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return header;
}

export async function writeReleaseArchive(output, metadata, source) {
  const json = Buffer.from(JSON.stringify(metadata));
  if (json.length === 0 || json.length > 65_536)
    throw new Error('发行说明过长');
  async function* archive() {
    yield tarHeader('release.json', json.length);
    yield json;
    yield Buffer.alloc((512 - (json.length % 512)) % 512);
    yield tarHeader('installer', metadata.size);
    let size = 0;
    for await (const chunk of createReadStream(source)) {
      size += chunk.length;
      if (size > metadata.size) throw new Error('打包期间安装包发生变化');
      yield chunk;
    }
    if (size !== metadata.size) throw new Error('打包期间安装包发生变化');
    yield Buffer.alloc((512 - (size % 512)) % 512);
    yield Buffer.alloc(1024);
  }
  await pipeline(
    Readable.from(archive()),
    createGzip(),
    createWriteStream(output),
  );
}
