import JsonBigint from 'json-bigint';

const jsonFormatter = JsonBigint({ strict: true });

export function formatJsonText(value: string, space: number) {
  if (!value.trim()) throw new SyntaxError('JSON 不能为空');

  const parsed = jsonFormatter.parse(value) as unknown;
  const normalizedSpace = Math.max(0, Math.min(10, Math.trunc(space)));
  const result = JsonBigint.stringify(parsed, null, normalizedSpace);
  if (result === undefined) throw new SyntaxError('JSON 格式不正确');
  return result;
}
