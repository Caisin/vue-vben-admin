import { describe, expect, it } from 'vitest';

import { jobForm, newBinding } from '../../data';
import { sourceTableLabels } from '../../database-data';

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
