import { describe, expect, it } from 'vitest';

import {
  fillDefaultTargetTable,
  jobForm,
  setStrategy,
  validateForm,
} from '../../data';
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('测试对象未初始化');
  return value;
}
function valid() {
  const form = jobForm();
  Object.assign(form, {
    name: '订单',
    target_ds_code: 'bend',
    target_database: 'analytics',
    target_table: 'orders',
  });
  form.config.storage_code = 'private';
  Object.assign(required(form.config.sources[0]), {
    instance_code: 'shop_a',
    table: 'orders',
  });
  return form;
}
describe('同步配置', () => {
  it('新建目标默认允许不加密，已保存 TLS 配置保持不变', () => {
    expect(jobForm().allow_insecure).toBe(true);
    const original = valid();
    original.allow_insecure = false;
    expect(
      jobForm({
        job: { ...original, id: 1, code: 'job', state: 'ready', version: 1 },
        draft: {
          id: 1,
          revision_no: 1,
          state: 'draft',
          config: original.config,
        },
        active: null,
        instances: [],
        checkpoints: [],
      }).allow_insecure,
    ).toBe(false);
  });
  it('允许手工填写非惯用时间列名，由结构检查校验真实列', () => {
    const form = valid();
    required(form.config.sources[0]).updated_column = 'custom_changed_at';
    expect(validateForm(form)).toBeUndefined();
  });
  it('全表策略移除旧游标字段，不要求主键或时间列', () => {
    const form = valid();
    setStrategy(form.config, 'full_table');
    expect(required(form.config.sources[0]).id_column).toBeNull();
    expect(required(form.config.sources[0]).updated_column).toBeNull();
    expect(form.config.window).toBeNull();
    expect(validateForm(form)).toBeUndefined();
    setStrategy(form.config, 'id_append');
    expect(validateForm(form)).toContain('主键');
  });
  it('时间窗口策略必须明确起点、稳定时间列和确认', () => {
    const form = valid();
    setStrategy(form.config, 'time_window');
    expect(validateForm(form)).toContain('起点');
    required(form.config.window).start_at = '2026-01-01T00:00:00Z';
    expect(validateForm(form)).toContain('不可修改');
    required(form.config.window).immutable_time_confirmed = true;
    expect(validateForm(form)).toContain('分桶时间');
    required(form.config.sources[0]).updated_column = 'created_at';
    expect(validateForm(form)).toBeUndefined();
  });
  it('同名目标表只补空值，不覆盖已选名称', () => {
    const form = valid();
    form.target_table = '';
    required(form.config.sources[0]).table = 'fs_file';
    fillDefaultTargetTable(form);
    expect(form.target_table).toBe('fs_file');
    form.target_table = 'warehouse_files';
    required(form.config.sources[0]).table = 'other_file';
    fillDefaultTargetTable(form);
    expect(form.target_table).toBe('warehouse_files');
  });
  it('各目标必填项给出独立提示', () => {
    const form = valid();
    form.config.storage_code = '';
    expect(validateForm(form)).toBe('请选择私有批次存储');
    form.target_database = '';
    expect(validateForm(form)).toBe('请选择目标数据库');
    form.target_ds_code = '';
    expect(validateForm(form)).toBe('请选择 Databend 数据源');
    form.name = ' ';
    expect(validateForm(form)).toBe('请填写任务名称');
  });
  it('已填写名称、数据库和存储时明确提示缺少目标表', () => {
    const form = valid();
    form.config.mode = 'id_append';
    form.target_table = '';
    expect(validateForm(form)).toBe('请填写目标表名');
    form.target_table = '   ';
    expect(validateForm(form)).toBe('请填写目标表名');
  });
  it('默认仅注入实例编码，不增加源主键副本', () => {
    const form = valid();
    expect(form.config.sources[0]?.id_column).toBe('id');
    expect(form.config.sources[0]?.fields).toEqual([]);
    expect(validateForm(form)).toBeUndefined();
  });
  it('拒绝重复实例及遗漏主键的映射', () => {
    const form = valid();
    form.config.sources.push({ ...required(form.config.sources[0]) });
    expect(validateForm(form)).toContain('重复绑定');
    form.config.sources.pop();
    required(form.config.sources[0]).fields = [
      { source: 'name', target: 'buyer', transform: { kind: 'identity' } },
    ];
    expect(validateForm(form)).toContain('保留源主键');
    const field = required(required(form.config.sources[0]).fields[0]);
    field.source = 'id';
    field.target = 'pri_id';
    expect(validateForm(form)).toBeUndefined();
  });
  it('时间增量必须配置时间字段', () => {
    const form = valid();
    required(form.config.sources[0]).updated_column = null;
    expect(validateForm(form)).toContain('更新时间');
    form.config.mode = 'id_append';
    expect(validateForm(form)).toBeUndefined();
  });
});
