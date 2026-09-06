import type {
  DatabasePlanRow,
  DatabaseTable,
  DatabaseWrite,
} from '#/api/data-sync-database';

import { jobForm, validateForm } from './data';

export function databaseErrorText(code: string) {
  const messages: Record<string, string> = {
    data_sync_table_not_enabled:
      '该表未确认、已排除或不属于当前全库配置，无法同步',
    data_sync_database_busy: '已有全库或单表任务正在处理，请等待完成',
    data_sync_table_frequency_invalid: '同步频率必须在 1 分钟至 31 天之间',
    data_sync_link_existing_job_active:
      '重复任务已有启用记录、水位或运行，不能自动替代，请先核对归属',
    data_sync_job_superseded:
      '该草稿已被原同步任务替代，请从全库配置查看关联任务',
    data_sync_target_owned_elsewhere:
      '目标表已有其它任务归属，只有同源且归属可验证的任务才能关联',
    data_sync_database_tables_failed:
      '部分表未通过检查或执行，请查看逐表失败原因',
    data_sync_unbounded_numeric:
      '源 numeric 未限定精度，请重新检查结构，或明确配置 Decimal 精度',
    data_sync_reserved_column:
      '源 instance_code 与同步标识重名，请重新检查自动映射或调整目标列名',
    data_sync_table_strategy_confirmation_required:
      '尚未确认同步策略，请确认后保存配置',
    data_sync_plan_missing: '缺少结构检查计划，请先检查所有表',
    data_sync_link_target_mismatch: '已有任务的目标数据源、数据库或表不匹配',
    data_sync_link_sources_mismatch: '已有任务的源实例或源表范围不一致',
    data_sync_link_schedule_enabled:
      '请先禁用已有任务的独立定时，再关联到全库同步',
    data_sync_managed_job: '任务已由全库配置管理，请检查关联归属',
    data_sync_receipt_copy_mismatch:
      '回执迁移校验不一致，已保留原回执，请核对后重试',
    data_sync_receipt_owned_elsewhere: '回执目标表不属于当前任务，不能接管',
    data_sync_receipt_table_missing:
      '历史回执表不存在，不能自动创建空回执继续同步',
    data_sync_database_no_confirmed_tables:
      '没有已确认且未排除的表，请先确认至少一张表的同步策略',
  };
  return messages[code] ?? code;
}

export function splitDatabaseTableSource(
  table: DatabaseTable,
  instance: string,
  active: string[],
  target: string,
) {
  if (table.config.sources.length < 2 || active.includes(instance))
    throw new Error('已启用的源绑定不能拆出');
  const main = JSON.parse(JSON.stringify(table)) as DatabaseTable;
  const separate = JSON.parse(JSON.stringify(table)) as DatabaseTable;
  const source = separate.config.sources.find(
    (source) => source.instance_code === instance,
  );
  if (!source) throw new Error('源绑定不存在');
  main.config.sources = main.config.sources.filter(
    (source) => source.instance_code !== instance,
  );
  separate.config.sources = [source];
  separate.target_table = target;
  separate.existing_job_id = null;
  separate.confirmed = false;
  separate.excluded_reason = null;
  separate.suggestion_error = null;
  separate.source_comments = separate.source_comments?.filter(
    (comment) => comment.instance_code === instance,
  );
  return { main, separate };
}

export function databaseTableError(
  table: DatabaseTable,
  plan?: DatabasePlanRow,
) {
  if (table.excluded_reason !== null) return '';
  const error =
    plan?.error || (plan?.state === 'failed' ? '检查或执行失败' : '');
  return databaseErrorText(
    error || (plan?.state === 'succeeded' ? '' : table.suggestion_error || ''),
  );
}

/** 完整配置本地筛选，保留原对象引用；保存和批量确认仍使用完整表清单。 */
export function filterDatabaseTables(
  tables: DatabaseTable[],
  plans: ReadonlyMap<string, DatabasePlanRow>,
  filter: { keyword: string; onlyErrors: boolean; target?: string },
) {
  const keyword = filter.keyword.trim().toLowerCase();
  return tables.filter((table) => {
    if (filter.target && table.target_table !== filter.target) return false;
    const plan = plans.get(table.target_table);
    const error = databaseTableError(table, plan);
    if (filter.onlyErrors && !error) return false;
    if (filter.target || !keyword) return true;
    return [
      table.target_table,
      ...table.config.sources.map((source) => source.table),
      ...sourceTableLabels(table).flatMap((source) => source.comments),
      error,
      plan?.error || '',
    ].some((value) => value.toLowerCase().includes(keyword));
  });
}

export function validateDatabaseTable(
  form: DatabaseWrite,
  table: DatabaseTable,
) {
  const interval = table.sync_interval_seconds;
  if (
    interval !== null &&
    interval !== undefined &&
    (!Number.isInteger(interval) || interval < 60 || interval > 2_678_400)
  )
    return '同步频率必须在 1 分钟至 31 天之间';
  return validateForm({
    ...jobForm(),
    name: form.name,
    target_ds_code: form.target_ds_code,
    target_database: form.target_database,
    target_table: table.target_table,
    config: table.config,
  });
}

export function tableFrequencyLabel(seconds?: null | number) {
  if (seconds === null || seconds === undefined) return '跟随全库定时';
  for (const [unit, label] of [
    [86_400, '天'],
    [3600, '小时'],
    [60, '分钟'],
  ] as const) {
    if (seconds % unit === 0) return `每 ${seconds / unit} ${label}`;
  }
  return `每 ${seconds} 秒`;
}

/** 只确认完整配置，不替用户选择策略或确认时间字段不可变等业务前提。 */
export function confirmAllTables(form: DatabaseWrite) {
  let confirmed = 0;
  const failures: { reason: string; table: string }[] = [];
  for (const table of form.tables) {
    if (table.confirmed || table.excluded_reason !== null) continue;
    const reason = validateDatabaseTable(form, table);
    if (reason) {
      failures.push({ table: table.target_table, reason });
      continue;
    }
    table.confirmed = true;
    table.suggestion_error = null;
    confirmed++;
  }
  return { confirmed, failures };
}

/** 同名多实例表只展示一次；悬浮备注仍按完整源身份匹配，避免换表后显示旧备注。 */
export function sourceTableLabels(table: DatabaseTable) {
  return [...new Set(table.config.sources.map((source) => source.table))].map(
    (name) => ({
      name,
      comments: table.config.sources
        .filter((source) => source.table === name)
        .map((source) => {
          const metadata = table.source_comments?.find(
            (item) =>
              item.instance_code === source.instance_code &&
              item.schema === source.schema &&
              item.table === source.table,
          );
          const comment = metadata
            ? metadata.comment || '暂无表备注'
            : '表备注未获取';
          return `${source.instance_code}: ${comment}`;
        }),
    }),
  );
}
