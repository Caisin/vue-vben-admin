import { describe, expect, it } from 'vitest';

import { formatTargetDdl } from '../../sql-format';

describe('目标 DDL 格式化', () => {
  it('展开字段并保留限定表名、精度及注释内容', () => {
    const result = formatTargetDdl(
      `CREATE TABLE "analytics"."orders" ("instance_code" STRING NOT NULL, "amount" DECIMAL(18,6) NULL COMMENT '金额,含税') ENGINE=FUSE COMMENT='kx_data_sync:job:1'`,
    );
    expect(result.formatted).toBe(true);
    expect(result.sql.split('\n').length).toBeGreaterThan(3);
    for (const value of [
      '"analytics"."orders"',
      "'金额,含税'",
      "'kx_data_sync:job:1'",
    ])
      expect(result.sql).toContain(value);
    expect(result.sql).toMatch(/DECIMAL\(18,\s*6\)/);
  });
  it('不能解析时保留完整原文，空输入不生成 SQL', () => {
    const original = "CREATE TABLE t (v STRING COMMENT 'unterminated";
    expect(formatTargetDdl(original)).toEqual({
      sql: original,
      formatted: false,
    });
    expect(formatTargetDdl(' ')).toEqual({ sql: '', formatted: true });
  });
});
