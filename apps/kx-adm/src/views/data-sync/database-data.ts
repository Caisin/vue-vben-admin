import type { DatabaseTable, DatabaseWrite } from '#/api/data-sync-database';

import { jobForm, validateForm } from './data';

export function databaseErrorText(code: string) {
  const messages: Record<string, string> = {
    data_sync_database_tables_failed:
      '部分表未通过检查或执行，请查看逐表失败原因',
    data_sync_unbounded_numeric:
      '源 numeric 未限定精度，请重新检查结构，或明确配置 Decimal 精度',
    data_sync_reserved_column:
      '源 instance_code 与同步标识重名，请重新检查自动映射或调整目标列名',
    data_sync_table_strategy_confirmation_required:
      '尚未确认同步策略，请确认后保存配置',
    data_sync_plan_missing: '缺少结构检查计划，请先检查所有表',
  };
  return messages[code] ?? code;
}

export function validateDatabaseTable(
  form: DatabaseWrite,
  table: DatabaseTable,
) {
  return validateForm({
    ...jobForm(),
    name: form.name,
    target_ds_code: form.target_ds_code,
    target_database: form.target_database,
    target_table: table.target_table,
    config: table.config,
  });
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
