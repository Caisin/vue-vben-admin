import { describe, expect, it } from 'vitest';

import {
  defaultMeilisearchConfig,
  meilisearchConfigFrom,
} from '../meilisearch-config';

describe('meilisearch installation config', () => {
  it('uses the official config.toml defaults', () => {
    expect(defaultMeilisearchConfig()).toMatchObject({
      db_path: './data.ms',
      dump_dir: 'dumps/',
      env: 'development',
      http_payload_size_limit: '100 MB',
      listen: 'localhost',
      log_level: 'INFO',
      port: 7700,
      schedule_snapshot: false,
      snapshot_dir: 'snapshots/',
    });
  });

  it('merges stored values without exposing internal credential fields', () => {
    const config = meilisearchConfigFrom({
      admin_credential_code: 'secret.meilisearch',
      env: 'production',
      max_indexing_threads: 4,
      port: 8800,
    });

    expect(config.env).toBe('production');
    expect(config.port).toBe(8800);
    expect(config.max_indexing_threads).toBe(4);
    expect(config).not.toHaveProperty('admin_credential_code');
  });
});
