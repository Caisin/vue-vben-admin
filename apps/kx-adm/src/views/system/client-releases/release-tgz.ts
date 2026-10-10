/** 只接受发行协议的两个普通条目，不向文件系统解压任意路径。 */
export async function readReleaseTgz(file: File, maxSize: number) {
  const reader = file
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  let pending = new Uint8Array(0);
  let offset = 0;
  async function take(size: number): Promise<Uint8Array[]> {
    const parts: Uint8Array[] = [];
    while (size > 0) {
      if (offset === pending.length) {
        const next = await reader.read();
        if (next.done) throw new Error('发行包内容不完整');
        pending = next.value;
        offset = 0;
      }
      const count = Math.min(size, pending.length - offset);
      parts.push(pending.slice(offset, offset + count));
      offset += count;
      size -= count;
    }
    return parts;
  }
  async function block(size: number) {
    const bytes = new Uint8Array(size);
    let index = 0;
    for (const part of await take(size)) {
      bytes.set(part, index);
      index += part.length;
    }
    return bytes;
  }
  function number(bytes: Uint8Array) {
    let value: number;
    if (bytes[0] === 0x80) {
      let large = 0;
      for (const byte of bytes.slice(1)) large = large * 256 + byte;
      value = large;
    } else {
      const text = new TextDecoder().decode(bytes).replaceAll('\0', '').trim();
      if (!/^[0-7]+$/.test(text)) throw new Error('发行包 tar 数值无效');
      value = Number.parseInt(text, 8);
    }
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('发行包 tar 大小无效');
    return value;
  }
  async function header(expected: string) {
    const bytes = await block(512);
    const checksum = bytes.reduce(
      (sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value),
      0,
    );
    const name = new TextDecoder().decode(bytes.slice(0, 100)).split('\0')[0];
    if (
      name !== expected ||
      (bytes[156] !== 48 && bytes[156] !== 0) ||
      bytes.slice(157, 257).some(Boolean) ||
      bytes.slice(345, 500).some(Boolean) ||
      new TextDecoder().decode(bytes.slice(257, 263)) !== 'ustar\0' ||
      number(bytes.slice(148, 156)) !== checksum
    )
      throw new Error('发行包 tar 结构无效');
    return number(bytes.slice(124, 136));
  }
  async function padding(size: number) {
    const bytes = await block((512 - (size % 512)) % 512);
    if (bytes.some(Boolean)) throw new Error('发行包 tar 填充无效');
  }
  try {
    const metadataSize = await header('release.json');
    if (metadataSize === 0 || metadataSize > 65_536)
      throw new Error('发行包元信息大小无效');
    const data: unknown = JSON.parse(
      new TextDecoder().decode(await block(metadataSize)),
    );
    await padding(metadataSize);
    const size = await header('installer');
    if (size > maxSize) throw new Error('更新安装包不能超过 512 MiB');
    if (
      !data ||
      typeof data !== 'object' ||
      !('size' in data) ||
      data.size !== size ||
      size === 0
    )
      throw new Error('发行包长度不完整');
    const parts = await take(size);
    await padding(size);
    const end = await block(1024);
    if (end.some(Boolean)) throw new Error('发行包包含额外文件或缺少结束块');
    let tail = pending.slice(offset);
    let tailSize = 0;
    while (true) {
      tailSize += tail.length;
      if (tail.some(Boolean) || tailSize > 1024 * 1024)
        throw new Error('发行包包含额外内容');
      const next = await reader.read();
      if (next.done) break;
      tail = next.value;
    }
    return { data, parts };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
