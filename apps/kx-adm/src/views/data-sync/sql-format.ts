import { format } from 'sql-formatter';

export function formatTargetDdl(sql: string) {
  if (!sql.trim()) return { sql: '', formatted: true };
  try {
    return {
      sql: format(sql, {
        language: 'postgresql',
        keywordCase: 'upper',
        tabWidth: 2,
        expressionWidth: 40,
      }),
      formatted: true,
    };
  } catch {
    // Databend 扩展语法超出格式器能力时保留原文，不改变实际执行的 DDL。
    return { sql, formatted: false };
  }
}
