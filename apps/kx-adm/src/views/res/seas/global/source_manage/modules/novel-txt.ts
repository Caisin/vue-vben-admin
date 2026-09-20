export type TextEncoding =
  | 'auto'
  | 'gb18030'
  | 'utf8'
  | 'utf-16be'
  | 'utf-16le';
export function decodeNovelText(bytes: ArrayBuffer, encoding: TextEncoding) {
  if (bytes.byteLength > 10 * 1024 * 1024)
    throw new Error('TXT 文件不能超过 10 MB');
  const data = new Uint8Array(bytes);
  let selected = encoding;
  if (selected === 'auto') {
    if (data[0] === 255 && data[1] === 254) selected = 'utf-16le';
    else if (data[0] === 254 && data[1] === 255) selected = 'utf-16be';
    else {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(data);
        selected = 'utf8';
      } catch {
        selected = 'gb18030';
      }
    }
  }
  const content = new TextDecoder(selected, { fatal: true })
    .decode(data)
    .replace(/^\uFEFF/, '');
  if (content.includes('\u0000') || !content.trim())
    throw new Error('正文为空或编码不正确，请切换编码');
  return { content, encoding: selected };
}

export async function prepareNovelFile(file: File, encoding: TextEncoding) {
  const bytes = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith('.docx')) {
    if (bytes.byteLength > 10 * 1024 * 1024)
      throw new Error('Word 文件不能超过 10 MB');
    const data = new Uint8Array(bytes);
    let binary = '';
    const chunk = 32_768;
    for (let index = 0; index < data.length; index += chunk)
      binary += String.fromCodePoint(
        ...data.subarray(index, Math.min(index + chunk, data.length)),
      );
    return {
      file_base64: btoa(binary),
      content: undefined,
      encoding: 'docx' as const,
    };
  }
  const decoded = decodeNovelText(bytes, encoding);
  return {
    file_base64: undefined,
    content: decoded.content,
    encoding: decoded.encoding,
  };
}
