import type { TaskRun } from '#/api/task/run';

import { plaintextRequestClient, requestClient } from '#/api/request';

export interface Evidence {
  source_id?: string;
  segment_id?: string;
  message_id?: string;
  quote: string;
}
export interface WriterRule {
  id: string;
  category: string;
  title: string;
  instruction: string;
  rationale?: string;
  applies_to?: string;
  exceptions?: string;
  evidence: Evidence[];
}
export interface WriterVersion {
  version: number;
  base_version: number;
  status: 'draft' | 'published';
  summary: string;
  rules: WriterRule[];
  task_id?: string;
  created_at: string;
}
export interface WriterMessage {
  id: string;
  speaker: 'assistant' | 'user';
  content: string;
  task_id: string;
  created_at: string;
}
export interface WriterProfile {
  role: {
    id: string;
    name: string;
    active_version: number;
    source_count: number;
  };
  active: WriterVersion;
}
export interface WriterSource {
  id: string;
  title: string;
  filename: string;
  format: string;
  bytes: number;
  characters: number;
  segment_count: number;
  metadata: { author?: string; episode?: string };
  created_at: string;
}
export interface SourcePage {
  source: WriterSource;
  segments: {
    id: string;
    ordinal: number;
    text: string;
    start_line: number;
    end_line: number;
  }[];
  has_more: boolean;
  next_offset: null | number;
}
export interface AgentTask {
  id: string;
  kind: string;
  status: string;
  base_version: number;
  agent_id?: string;
  lease_until?: number;
  candidate_version?: number;
  prompt_preview?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}
export interface UploadState {
  id: string;
  role_id: string;
  actor_id: string;
  state: string;
  source_id?: null | string;
  duplicate: boolean;
  error_code?: null | string;
  filename?: null | string;
  title?: null | string;
  source_deleted: boolean;
  created_at: string;
  updated_at: string;
  can_retry: boolean;
  can_cancel: boolean;
}
const path = (role: string) =>
  `/vestige/roles/${encodeURIComponent(role)}/writer`;
function run<T>(
  role: string,
  tool: string,
  arguments_: Record<string, unknown>,
) {
  return requestClient.post<T>(path(role), { tool, arguments: arguments_ });
}
export const WriterApi = {
  profile: (role: string) =>
    run<WriterProfile>(role, 'writer_role', {
      action: 'get',
      include_messages: false,
    }),
  versions: (role: string, offset = 0) =>
    run<{ versions: WriterVersion[] }>(role, 'writer_role', {
      action: 'versions',
      offset,
      limit: 11,
    }),
  publish: (role: string, version: number, expected_version: number) =>
    run(role, 'writer_role', { action: 'publish', version, expected_version }),
  rollback: (role: string, version: number, expected_version: number) =>
    run(role, 'writer_role', { action: 'rollback', version, expected_version }),
  sources: (role: string, offset = 0) =>
    run<{ sources: WriterSource[] }>(role, 'writer_source', {
      action: 'list',
      offset,
      limit: 26,
    }),
  source: (role: string, id: string, offset = 0, segment?: string) =>
    run<SourcePage>(role, 'writer_source', {
      action: 'get',
      source_id: id,
      offset,
      limit: 5,
      ...(segment ? { segment_id: segment } : {}),
    }),
  removeSource: (role: string, id: string) =>
    run(role, 'writer_source', {
      action: 'delete',
      source_id: id,
      confirm: true,
    }),
  messages: (role: string, offset = 0, message?: string) =>
    run<{
      messages: WriterMessage[];
      has_more: boolean;
      next_offset: null | number;
    }>(role, 'writer_role', {
      action: 'messages',
      offset,
      limit: 25,
      ...(message ? { message_id: message } : {}),
    }),
  tasks: (role: string, offset = 0) =>
    run<{ tasks: AgentTask[] }>(role, 'writer_task', {
      action: 'list',
      summary_only: true,
      offset,
      limit: 26,
    }),
  extract: (role: string) =>
    run<{ task: AgentTask }>(role, 'writer_task', {
      action: 'create',
      kind: 'extract',
    }),
  chat: (role: string, message: string) =>
    run<{ task: AgentTask }>(role, 'writer_task', {
      action: 'create',
      kind: 'role_chat',
      input: { message },
    }),
  cancelTask: (role: string, id: string) =>
    run(role, 'writer_task', { action: 'cancel', task_id: id }),
  upload: (
    role: string,
    file: File,
    title: string,
    author: string,
    episode: string,
    request_key: string,
  ) =>
    plaintextRequestClient.upload<{ upload: UploadState; task: TaskRun }>(
      `${path(role)}/uploads`,
      { file, title, author, episode, request_key },
    ),
  uploads: (role: string, offset = 0) =>
    requestClient.get<UploadState[]>(`${path(role)}/uploads`, {
      params: { offset, limit: 26 },
    }),
  retryUpload: (role: string, id: string) =>
    requestClient.post(
      `${path(role)}/uploads/${encodeURIComponent(id)}/retry`,
      {},
    ),
  cancelUpload: (role: string, id: string) =>
    requestClient.post<UploadState>(
      `${path(role)}/uploads/${encodeURIComponent(id)}/cancel`,
      {},
    ),
};

export { run as writerCommand };
