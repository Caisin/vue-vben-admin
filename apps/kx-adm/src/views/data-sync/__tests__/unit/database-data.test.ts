import type {
  DatabasePlanRow,
  DatabaseTable,
  DatabaseWrite,
} from '#/api/data-sync-database';

import { describe, expect, it } from 'vitest';

import { jobForm, newBinding, setStrategy } from '../../data';
import {
  confirmAllTables,
  databaseTableError,
  filterDatabaseTables,
  sourceTableLabels,
  splitDatabaseTableSource,
} from '../../database-data';

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

describe('新增源单独配置', () => {
  it('只拆未启用的新源，原表策略及源配置不受影响', () => {
    const table = pendingTable('orders');
    const added = { ...newBinding(), instance_code: 'west', table: 'orders' };
    table.config.sources.push(added);
    const before = JSON.stringify(table);
    const { main, separate } = splitDatabaseTableSource(
      table,
      'west',
      ['shop'],
      'west_orders',
    );
    expect(main.config.sources.map((source) => source.instance_code)).toEqual([
      'shop',
    ]);
    expect(
      separate.config.sources.map((source) => source.instance_code),
    ).toEqual(['west']);
    expect(separate.target_table).toBe('west_orders');
    expect(separate.confirmed).toBe(false);
    expect(separate.existing_job_id).toBeNull();
    separate.config.limits.max_rows = 99;
    expect(main.config.limits.max_rows).not.toBe(99);
    expect(JSON.stringify(table)).toBe(before);
    expect(() =>
      splitDatabaseTableSource(table, 'shop', ['shop'], 'other'),
    ).toThrow('已启用');
    expect(() => splitDatabaseTableSource(main, 'shop', [], 'other')).toThrow(
      '已启用',
    );
  });
});

describe('逐表策略搜索与错误定位', () => {
  const failure: DatabasePlanRow = {
    target_table: 'orders',
    job_id: null,
    revision_id: null,
    plan_hash: null,
    state: 'failed',
    error: 'data_sync_reserved_column',
  };
  const plans = new Map([['orders', failure]]);
  const filter = { keyword: '', onlyErrors: false };

  it('搜索覆盖完整清单的源表、目标表、备注和中英文错误，保留原对象引用', () => {
    const tables = Array.from({ length: 25 }, (_, i) =>
      pendingTable(`table_${i}`),
    );
    const order = pendingTable('orders');
    const source = order.config.sources[0];
    if (!source) throw new Error('missing source fixture');
    source.table = 'source_orders';
    order.source_comments = [
      {
        instance_code: 'shop',
        schema: source.schema,
        table: 'source_orders',
        comment: '订单金额',
      },
    ];
    tables.push(order);
    const before = structuredClone(tables);
    for (const keyword of [
      ' ORDERS ',
      'SOURCE_ORDERS',
      '订单金额',
      '同步标识重名',
      'data_sync_reserved_column',
    ]) {
      expect(
        filterDatabaseTables(tables, plans, { ...filter, keyword }),
      ).toEqual([order]);
      expect(
        filterDatabaseTables(tables, plans, { ...filter, keyword })[0],
      ).toBe(order);
    }
    expect(tables).toEqual(before);
    expect(
      filterDatabaseTables(tables, plans, { ...filter, keyword: '不存在' }),
    ).toEqual([]);
    expect(filterDatabaseTables(tables, plans, filter)).toHaveLength(26);
  });

  it('错误筛选包含无错误文本的失败和推荐错误，不包括排除项及已成功的旧推荐错误', () => {
    const order = pendingTable('orders');
    const pending = pendingTable('pending');
    pending.suggestion_error = '缺少时间字段';
    const excluded = pendingTable('excluded');
    excluded.excluded_reason = '无需同步';
    excluded.suggestion_error = '旧错误';
    const succeeded = pendingTable('succeeded');
    succeeded.suggestion_error = '旧错误';
    const emptyFailure = pendingTable('empty_failure');
    const rows = new Map([
      ...plans,
      ['empty_failure', { ...failure, error: null }],
      ['succeeded', { ...failure, state: 'succeeded', error: null }],
    ]);
    const tables = [order, pending, excluded, succeeded, emptyFailure];
    expect(
      filterDatabaseTables(tables, rows, { ...filter, onlyErrors: true }),
    ).toEqual([order, pending, emptyFailure]);
    expect(
      filterDatabaseTables(tables, rows, { keyword: '时间', onlyErrors: true }),
    ).toEqual([pending]);
    expect(databaseTableError(emptyFailure, rows.get('empty_failure'))).toBe(
      '检查或执行失败',
    );
  });

  it('按完整目标表名精确定位，不误命中相似名或把名称当成正则', () => {
    const tables = ['orders', 'orders_archive', 'orders.2026'].map((name) =>
      pendingTable(name),
    );
    expect(
      filterDatabaseTables(tables, plans, {
        ...filter,
        keyword: 'orders',
        target: 'orders',
      }),
    ).toEqual([tables[0]]);
    expect(
      filterDatabaseTables(tables, plans, { ...filter, target: 'orders.2026' }),
    ).toEqual([tables[2]]);
    expect(
      filterDatabaseTables(tables, plans, { ...filter, target: 'deleted' }),
    ).toEqual([]);
  });
});

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
