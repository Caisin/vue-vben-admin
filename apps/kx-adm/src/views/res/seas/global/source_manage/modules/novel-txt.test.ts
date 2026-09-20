import { describe, expect, it } from 'vitest';

import { decodeNovelText } from './novel-txt';
describe('小说 TXT 编码', () => {
  it('读取 UTF-8 和 GB18030 中文', () => {
    expect(
      decodeNovelText(new TextEncoder().encode('第一章\n你好').buffer, 'auto')
        .content,
    ).toBe('第一章\n你好');
    const decoded = decodeNovelText(
      new Uint8Array([196, 227, 186, 195]).buffer,
      'auto',
    );
    expect(decoded.encoding).toBe('gb18030');
    expect(decoded.content).toBe('你好');
  });
  it('识别 UTF-16 BOM 且不把空文件或错误编码当正文', () => {
    expect(
      decodeNovelText(new Uint8Array([255, 254, 65, 0, 66, 0]).buffer, 'auto')
        .content,
    ).toBe('AB');
    expect(() => decodeNovelText(new ArrayBuffer(0), 'auto')).toThrow(
      '正文为空或编码不正确',
    );
    expect(() =>
      decodeNovelText(new Uint8Array([0, 65, 0, 66]).buffer, 'utf8'),
    ).toThrow('正文为空或编码不正确');
    expect(() =>
      decodeNovelText(new ArrayBuffer(10 * 1024 * 1024 + 1), 'auto'),
    ).toThrow('10 MB');
  });
});

it('does not read docx as plain text and prepares bounded binary payload', async () => {
  const file = new File([new Uint8Array([80, 75, 3, 4])], 'book.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const { prepareNovelFile } = await import('./novel-txt');
  const result = await prepareNovelFile(file, 'auto');
  expect(result.encoding).toBe('docx');
  expect(result.content).toBeUndefined();
  expect(result.file_base64).toBeTruthy();
});
