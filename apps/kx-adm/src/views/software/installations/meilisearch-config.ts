import type { MeilisearchInstallConfig } from '#/api/software';

export function defaultMeilisearchConfig(): MeilisearchInstallConfig {
  return {
    db_path: './data.ms',
    dump_dir: 'dumps/',
    env: 'development',
    experimental_enable_metrics: false,
    experimental_reduce_indexing_memory_usage: false,
    http_payload_size_limit: '100 MB',
    ignore_dump_if_db_exists: false,
    ignore_missing_dump: false,
    ignore_missing_snapshot: false,
    ignore_snapshot_if_db_exists: false,
    listen: 'localhost',
    log_level: 'INFO',
    no_analytics: false,
    port: 7700,
    schedule_snapshot: false,
    snapshot_dir: 'snapshots/',
    ssl_require_auth: false,
    ssl_resumption: false,
    ssl_tickets: false,
  };
}

export function meilisearchConfigFrom(
  value: Record<string, unknown>,
): MeilisearchInstallConfig {
  const defaults = defaultMeilisearchConfig();
  const known = Object.fromEntries(
    Object.keys(defaults)
      .filter((key) => key in value)
      .map((key) => [key, value[key]]),
  );
  for (const key of [
    'experimental_max_number_of_batched_tasks',
    'import_dump',
    'import_snapshot',
    'max_indexing_memory',
    'max_indexing_threads',
    'ssl_auth_path',
    'ssl_cert_path',
    'ssl_key_path',
    'ssl_ocsp_path',
  ]) {
    if (key in value) known[key] = value[key];
  }
  return { ...defaults, ...known } as MeilisearchInstallConfig;
}
