import { describe, expect, it } from 'vitest';

import { formatJsonText } from './json-format';

describe('jSON 文本格式转换', () => {
  it('按指定缩进格式化对象和数组', () => {
    expect(formatJsonText('{"items":[1,{"ok":true}]}', 2)).toBe(`{
  "items": [
    1,
    {
      "ok": true
    }
  ]
}`);
  });

  it('压缩为单行且保留字符串内部空白', () => {
    expect(formatJsonText('{ "message": "a  b", "ok": true }', 0)).toBe(
      '{"message":"a  b","ok":true}',
    );
  });

  it('保留超过 JavaScript 安全范围的整数类型', () => {
    expect(formatJsonText('{"id":9223372036854775807}', 2)).toContain(
      '"id": 9223372036854775807',
    );
    expect(formatJsonText('{"id":9223372036854775807}', 0)).toBe(
      '{"id":9223372036854775807}',
    );
  });

  it('拒绝空内容和非法 JSON', () => {
    expect(() => formatJsonText('', 2)).toThrow('JSON 不能为空');
    expect(() => formatJsonText('{"missing":}', 2)).toThrow(/.+/);
  });
});
