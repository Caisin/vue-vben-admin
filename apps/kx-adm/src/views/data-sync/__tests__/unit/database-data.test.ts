import type { DatabaseTable, DatabaseWrite } from '#/api/data-sync-database';

import { describe, expect, it } from 'vitest';

import { jobForm, newBinding, setStrategy } from '../../data';
import { confirmAllTables, sourceTableLabels } from '../../database-data';

function pendingTable(name: string): DatabaseTable {
  const config = jobForm().config;
  config.storage_code = 'private';
  config.sources = [{ ...newBinding(), instance_code: 'shop', table: name }];
  return {
    target_table: name,
    confirmed: false,
    excluded_reason: null,
    config,
  };
}
function database(tables: DatabaseTable[]): DatabaseWrite {
  return {
    name: '全库同步',
    target_ds_code: 'bend',
    target_database: 'analytics',
    warehouse: null,
    allow_insecure: true,
    table_prefix: '',
    schema_prefix: false,
    storage_code: 'private',
    sources: [{ instance_code: 'shop', schema: 'public' }],
    tables,
  };
}

describe('全部确认', () => {
  it('覆盖全部分页且重复确认不改变策略', () => {
    const form = database(
      Array.from({ length: 25 }, (_, i) => pendingTable(`table_${i}`)),
    );
    const before = form.tables.map((table) => structuredClone(table.config));
    expect(confirmAllTables(form)).toEqual({ confirmed: 25, failures: [] });
    expect(form.tables.every((table) => table.confirmed)).toBe(true);
    expect(form.tables.map((table) => table.config)).toEqual(before);
    expect(confirmAllTables(form)).toEqual({ confirmed: 0, failures: [] });
  });

  it('跳过排除项和已确认项，缺字段的表保留待确认', () => {
    const excluded = pendingTable('excluded');
    excluded.excluded_reason = '不需要同步';
    const confirmed = pendingTable('confirmed');
    confirmed.confirmed = true;
    const invalid = pendingTable('invalid');
    invalid.config.sources[0] = {
      ...newBinding(),
      instance_code: 'shop',
      table: 'invalid',
      id_column: null,
    };
    const valid = pendingTable('valid');
    const result = confirmAllTables(
      database([excluded, confirmed, invalid, valid]),
    );
    expect(result.confirmed).toBe(1);
    expect(result.failures).toEqual([
      { table: 'invalid', reason: '源 1：请选择自增主键字段' },
    ]);
    expect(excluded.confirmed).toBe(false);
    expect(confirmed.confirmed).toBe(true);
    expect(invalid.confirmed).toBe(false);
    expect(valid.confirmed).toBe(true);
  });

  it('时间窗口的不可变前提不能被批量确认隐式勾选', () => {
    const table = pendingTable('events');
    setStrategy(table.config, 'time_window');
    const window = table.config.window;
    if (!window) throw new Error('missing window');
    window.start_at = '2026-01-01T00:00:00Z';
    expect(confirmAllTables(database([table])).failures).toEqual([
      { table: 'events', reason: '请确认分桶时间字段不可修改' },
    ]);
    expect(window.immutable_time_confirmed).toBe(false);
    expect(table.confirmed).toBe(false);
  });

  it('空列表没有副作用', () => {
    expect(confirmAllTables(database([]))).toEqual({
      confirmed: 0,
      failures: [],
    });
  });
});

describe('源表展示', () => {
  it('合并同名表，备注仍按实例和 Schema 精确匹配', () => {
    const table = {
      target_table: 'parameters',
      confirmed: false,
      excluded_reason: null,
      config: jobForm().config,
      source_comments: [
        {
          instance_code: 'a',
          schema: 'public',
          table: 'parameters',
          comment: '参数配置',
        },
        {
          instance_code: 'b',
          schema: 'other',
          table: 'parameters',
          comment: '旧备注不能显示',
        },
      ],
    };
    table.config.sources = ['a', 'b'].map((instance_code) => ({
      ...newBinding(),
      instance_code,
      schema: 'public',
      table: 'parameters',
    }));
    expect(sourceTableLabels(table)).toEqual([
      { name: 'parameters', comments: ['a: 参数配置', 'b: 表备注未获取'] },
    ]);
  });
  it('没有备注时有明确空状态，不生成数据库和 Schema 前缀', () => {
    const table = {
      target_table: 'orders',
      confirmed: true,
      excluded_reason: null,
      config: jobForm().config,
      source_comments: [
        { instance_code: 'a', schema: 'public', table: 'orders', comment: '' },
      ],
    };
    table.config.sources = [
      {
        ...newBinding(),
        instance_code: 'a',
        schema: 'public',
        table: 'orders',
      },
    ];
    expect(sourceTableLabels(table)).toEqual([
      { name: 'orders', comments: ['a: 暂无表备注'] },
    ]);
  });
});
