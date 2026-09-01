import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type SoftwareState = 'disabled' | 'enabled';
export type ServerAccessKind = 'local' | 'ssh';
export type InstallationState =
  | 'failed'
  | 'installing'
  | 'removed'
  | 'running'
  | 'stopped'
  | 'unknown';
export type OperationState =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'running'
  | 'succeeded';

export interface SoftwareServer {
  access_kind: ServerAccessKind;
  arch: string;
  code: string;
  credential_code: string;
  host: string;
  host_key_fingerprint: string;
  id: number | string;
  last_error: string;
  last_seen_at: number | string;
  name: string;
  os: string;
  port: number;
  service_manager: string;
  state: SoftwareState;
  updated_at: number | string;
  version: number | string;
}

export interface ServerWrite {
  access_kind: ServerAccessKind;
  code: string;
  credential_code: string;
  expected_version?: number | string;
  host: string;
  host_key_fingerprint?: string;
  name: string;
  port: number;
  state: SoftwareState;
}

export interface ServerProbe {
  arch: string;
  host_key_fingerprint: string;
  os: string;
  run_user: string;
  service_manager: string;
  trusted: boolean;
}

export interface SoftwareApplication {
  application_kind: 'application' | 'service';
  code: string;
  description: string;
  driver_kind: string;
  id: number | string;
  install_root: string;
  name: string;
  provider: string;
  service_name: string;
  service_spec: null | {
    default_port?: number;
  };
  source: Record<string, unknown>;
  source_kind: string;
  state: SoftwareState;
  updated_at: number | string;
  version: number | string;
}

export interface ApplicationWrite {
  application_kind?: 'application' | 'service';
  code: string;
  description?: string;
  driver_kind?: string;
  expected_version?: number | string;
  install_root: string;
  name: string;
  provider: string;
  service_name?: string;
  source: Record<string, unknown>;
  source_kind?: string;
  state: SoftwareState;
}

export interface SoftwareVersion {
  application_id: number | string;
  display_version: string;
  discovered_at: number | string;
  id: number | string;
  immutable_ref: string;
  released_at: number | string;
  source_ref: string;
  state: SoftwareState;
}

export interface SoftwareArtifact {
  arch: string;
  artifact_url: string;
  checksum: string;
  checksum_kind: string;
  id: number | string;
  immutable_ref: string;
  is_current: boolean;
  metadata: Record<string, unknown>;
  platform: string;
  size_bytes: number | string;
  version_id: number | string;
}

export interface MeilisearchInstallConfig {
  db_path: string;
  dump_dir: string;
  env: 'development' | 'production';
  experimental_enable_metrics: boolean;
  experimental_max_number_of_batched_tasks?: number;
  experimental_reduce_indexing_memory_usage: boolean;
  http_payload_size_limit: string;
  ignore_dump_if_db_exists: boolean;
  ignore_missing_dump: boolean;
  ignore_missing_snapshot: boolean;
  ignore_snapshot_if_db_exists: boolean;
  import_dump?: string;
  import_snapshot?: string;
  listen: string;
  log_level: 'DEBUG' | 'ERROR' | 'INFO' | 'OFF' | 'TRACE' | 'WARN';
  max_indexing_memory?: string;
  max_indexing_threads?: number;
  no_analytics: boolean;
  port: number;
  schedule_snapshot: boolean | number;
  snapshot_dir: string;
  ssl_auth_path?: string;
  ssl_cert_path?: string;
  ssl_key_path?: string;
  ssl_ocsp_path?: string;
  ssl_require_auth: boolean;
  ssl_resumption: boolean;
  ssl_tickets: boolean;
}

export interface SoftwareInstallation {
  active_operation_id?: null | number | string;
  application_code: string;
  application_id: number | string;
  application_name: string;
  config_json: Record<string, unknown>;
  available_revision?: null | string;
  available_version?: null | string;
  desired_version: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  id: number | string;
  initial_revision?: null | string;
  initial_version?: null | string;
  install_path: string;
  instance_key: string;
  last_error: string;
  observed_version: string;
  previous_version: string;
  server_code: string;
  server_access_kind: ServerAccessKind;
  server_id: number | string;
  server_name: string;
  state: InstallationState;
  updated_at: number | string;
  version: number | string;
}

export interface InstallationCreate {
  admin_credential_code?: string;
  application_id: number | string;
  config_json?: Record<string, unknown>;
  instance_key: string;
  install_root?: string;
  server_id: number | string;
}

export interface InstallationConfigWrite {
  admin_credential_code?: string;
  config_json: Record<string, unknown>;
  expected_version: number | string;
}

export interface SoftwareOperation {
  action: string;
  application_id: number | string;
  created_at: number | string;
  error_summary: string;
  id: number | string;
  installation_id: number | string;
  state: OperationState;
  stage: string;
  stderr_tail: string;
  stdout_tail: string;
  step: number;
  target_version: string;
  finished_at: number | string;
  started_at: number | string;
}

export interface OperationWrite {
  confirmed?: boolean;
  expected_row_version: number | string;
  idempotency_key: string;
  target_version?: string;
}

export const SoftwareApi = {
  applications: (
    params?: PageQuery & {
      keyword?: string;
      provider?: string;
      state?: SoftwareState;
    },
  ) =>
    requestClient.get<Page<SoftwareApplication>>('/software/applications', {
      params,
    }),
  createApplication: (data: ApplicationWrite) =>
    requestClient.post<SoftwareApplication>('/software/applications', data),
  createInstallation: (data: InstallationCreate) =>
    requestClient.post<SoftwareInstallation>('/software/installations', data),
  updateInstallationConfig: (
    id: number | string,
    data: InstallationConfigWrite,
  ) =>
    requestClient.put<SoftwareInstallation>(
      `/software/installations/${id}/config`,
      data,
    ),
  deleteInstallation: (id: number | string) =>
    requestClient.delete<boolean>(`/software/installations/${id}`),
  createServer: (data: ServerWrite) =>
    requestClient.post<SoftwareServer>('/software/servers', data),
  installationAction: (
    id: number | string,
    action: string,
    data: OperationWrite,
  ) =>
    requestClient.post<SoftwareOperation>(
      `/software/installations/${id}/actions/${action}`,
      data,
    ),
  installations: (
    params?: PageQuery & {
      application_id?: number | string;
      server_id?: number | string;
      state?: InstallationState;
    },
  ) =>
    requestClient.get<Page<SoftwareInstallation>>('/software/installations', {
      params,
    }),
  applicationInstallations: (id: number | string) =>
    requestClient.get<Page<SoftwareInstallation>>(
      `/software/applications/${id}/installations`,
      { params: { page: 1, size: 200 } },
    ),
  operations: (
    params?: PageQuery & {
      application_id?: number | string;
      installation_id?: number | string;
      server_id?: number | string;
      state?: OperationState;
    },
  ) =>
    requestClient.get<Page<SoftwareOperation>>('/software/operations', {
      params,
    }),
  probeServer: (id: number | string, trustHostKey: boolean) =>
    requestClient.post<ServerProbe>(`/software/servers/${id}/probe`, {
      trust_host_key: trustHostKey,
    }),
  refreshVersions: (id: number | string) =>
    requestClient.post<SoftwareVersion[]>(
      `/software/applications/${id}/versions/refresh`,
    ),
  uploadVersionArtifact: (
    applicationId: number | string,
    versionId: number | string,
    data: { arch: string; file_id: number | string; platform: string },
  ) =>
    requestClient.post<SoftwareArtifact>(
      `/software/applications/${applicationId}/versions/${versionId}/artifacts`,
      data,
    ),
  servers: (params?: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<SoftwareServer>>('/software/servers', { params }),
  serverInstallations: (id: number | string) =>
    requestClient.get<Page<SoftwareInstallation>>(
      `/software/servers/${id}/installations`,
      { params: { page: 1, size: 200 } },
    ),
  updateApplication: (id: number | string, data: ApplicationWrite) =>
    requestClient.put<SoftwareApplication>(
      `/software/applications/${id}`,
      data,
    ),
  updateServer: (id: number | string, data: ServerWrite) =>
    requestClient.put<SoftwareServer>(`/software/servers/${id}`, data),
  versions: (id: number | string, params?: PageQuery) =>
    requestClient.get<Page<SoftwareVersion>>(
      `/software/applications/${id}/versions`,
      { params },
    ),
};
