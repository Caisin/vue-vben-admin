import type { Binding, JobDetail, JobWrite, SyncConfig } from '#/api/data-sync';

export const strategyOptions = [
  { value: 'id_and_time', label: '主键 + 更新时间增量' },
  { value: 'id_append', label: '主键追加' },
  { value: 'full_table', label: '每次全表刷新' },
  { value: 'time_window', label: '时间窗口刷新' },
];
export function setStrategy(config: SyncConfig, mode: SyncConfig['mode']) {
  const previous = config.mode;
  config.mode = mode;
  const snapshot = mode === 'full_table' || mode === 'time_window';
  for (const source of config.sources) {
    source.id_column = snapshot ? null : source.id_column;
    if (mode === 'full_table' || mode === 'id_append')
      source.updated_column = null;
    if (
      mode !== previous &&
      (mode === 'time_window' || previous === 'time_window')
    )
      source.updated_column = null;
  }
  config.window =
    mode === 'time_window'
      ? (config.window ?? {
          unit: 'day',
          timezone: 'UTC',
          start_at: '',
          lookback_windows: 3,
          include_open_window: false,
          immutable_time_confirmed: false,
        })
      : null;
}

export const states: Record<string, string> = {
  draft: '草稿',
  validated: '已检查',
  active: '已启用',
  ready: '就绪',
  paused: '已暂停',
  running: '执行中',
  blocked: '待对账',
  failed: '失败',
  cancelled: '已取消',
  succeeded: '成功',
  prepared: '已准备',
  publishing: '提交中',
  unknown: '提交待确认',
  committed: '已确认',
};
export const operations: Record<string, string> = {
  inspect: '结构检查',
  activate: '建表启用',
  sync: '数据同步',
  reconcile: '回执对账',
};
export function newBinding(): Binding {
  return {
    instance_code: '',
    schema: 'public',
    table: '',
    id_column: 'id',
    updated_column: 'updated_at',
    soft_delete_column: null,
    source_timezone: 'UTC',
    fields: [],
  };
}
export function jobForm(detail?: JobDetail): JobWrite {
  if (detail)
    return JSON.parse(
      JSON.stringify({
        name: detail.job.name,
        target_ds_code: detail.job.target_ds_code,
        target_database: detail.job.target_database,
        target_table: detail.job.target_table,
        warehouse: detail.job.warehouse,
        allow_insecure: detail.job.allow_insecure,
        version: detail.job.version,
        config: detail.draft?.config ?? detail.active?.config,
      }),
    );
  return {
    name: '',
    target_ds_code: '',
    target_database: '',
    target_table: '',
    warehouse: null,
    allow_insecure: true,
    config: {
      mode: 'id_and_time',
      storage_code: '',
      sources: [newBinding()],
      limits: {
        id_span: 10_000,
        max_rows: 5000,
        max_bytes: 16 * 1024 * 1024,
        source_concurrency: 4,
        overlap_seconds: 600,
        settle_delay_seconds: 60,
        snapshot_max_bytes: 1_073_741_824,
      },
    },
  };
}
export function validateForm(form: JobWrite): string | undefined {
  if (!form.name.trim()) return '请填写任务名称';
  if (!form.target_ds_code.trim()) return '请选择 Databend 数据源';
  if (!form.target_database.trim()) return '请选择目标数据库';
  if (!form.target_table.trim()) return '请填写目标表名';
  if (!form.config.storage_code.trim()) return '请选择私有批次存储';
  if (form.config.sources.length === 0) return '至少添加一个源实例';
  const snapshot = ['full_table', 'time_window'].includes(form.config.mode);
  if (form.config.mode === 'time_window') {
    const window = form.config.window;
    if (!window?.start_at.trim()) return '请填写首次同步起点';
    if (!window.timezone.trim()) return '请填写窗口时区';
    if (!window.immutable_time_confirmed) return '请确认分桶时间字段不可修改';
  }
  const seen = new Set<string>();
  for (const [index, source] of form.config.sources.entries()) {
    const prefix = `源 ${index + 1}：`;
    if (!source.instance_code.trim()) return `${prefix}请选择实例`;
    if (!source.schema.trim()) return `${prefix}请选择 Schema / 源库`;
    if (!source.table.trim()) return `${prefix}请选择源表`;
    if (!snapshot && !source.id_column?.trim())
      return `${prefix}请选择自增主键字段`;
    if (seen.has(source.instance_code)) return '同一任务不能重复绑定实例';
    seen.add(source.instance_code);
    if (
      ['id_and_time', 'time_window'].includes(form.config.mode) &&
      !source.updated_column?.trim()
    )
      return `${prefix}请选择${form.config.mode === 'time_window' ? '分桶时间' : '更新时间'}字段`;
    if (
      source.fields.some(
        (field) =>
          !field.source || !field.target || field.target === 'instance_code',
      )
    )
      return '字段映射不完整或占用 instance_code';
    if (
      source.fields.length > 0 &&
      !snapshot &&
      !source.fields.some((field) => field.source === source.id_column)
    )
      return '字段映射必须保留源主键';
  }
  return undefined;
}

/** 仅首次填写空目标表；不覆盖用户自定义名称或其它源绑定。 */
export function fillDefaultTargetTable(form: JobWrite) {
  if (!form.target_table.trim()) {
    form.target_table = form.config.sources[0]?.table.trim() || '';
  }
}
