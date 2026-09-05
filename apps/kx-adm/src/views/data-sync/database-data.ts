import type { DatabaseTable } from '#/api/data-sync-database';

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
