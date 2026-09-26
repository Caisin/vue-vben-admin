import { plaintextRequestClient, requestClient } from '#/api/request';

export interface ScriptProject {
  id: number;
  title: string;
  input_mode: 'adaptation' | 'existing_script' | 'original';
  state: string;
  revision: number;
  updated_at: number;
}
export interface WorkflowGroup {
  id: number;
  project_id: number;
  group_key: string;
  name: string;
  purpose: string;
  kind: string;
  state: string;
  workflow_hash: string;
  input_snapshot_hash: string;
  run_namespace: string;
  revision: number;
}
export interface WorkflowRevision {
  id: number;
  project_id: number;
  revision: number;
  name: string;
  state: string;
  content_hash: string;
  created_at: number;
}
export interface TestBatch {
  id: number;
  state: string;
  batch_key: string;
  objective: string;
  group_ids: number[];
}
export interface ScriptProjectWrite {
  title: string;
  input_mode: 'adaptation' | 'existing_script' | 'original';
  settings?: Record<string, unknown>;
}
export interface WorkflowGroupWrite {
  group_key: string;
  name: string;
  purpose?: string;
  kind?: string;
  workflow_revision_id: number;
  input_snapshot_hash: string;
  model_profile?: Record<string, unknown>;
  budget?: Record<string, unknown>;
}
export interface WorkflowRevisionWrite {
  name: string;
  graph: Record<string, unknown>;
}
export interface TestBatchWrite {
  batch_key: string;
  objective: string;
  input_snapshot_hash: string;
  selection?: Record<string, unknown>;
  group_ids: number[];
}
export interface PromptOverrideWrite {
  node_run_id: number;
  base_prompt_revision_id: number;
  fields: Record<string, unknown>;
  reason: string;
  scope_key: string;
  input_set_hash: string;
}
export interface DebugRunWrite {
  source_run_id: number;
  source_node_run_id: number;
  mode: string;
  checkpoint_id?: number;
  override_id?: number;
}
export const ScriptPipelineApi = {
  projects: () =>
    requestClient.get<ScriptProject[]>('/script-pipeline/projects'),
  createProject: (body: ScriptProjectWrite) =>
    requestClient.post<ScriptProject>('/script-pipeline/projects', body),
  groups: (projectId: number) =>
    requestClient.get<WorkflowGroup[]>(
      `/script-pipeline/projects/${projectId}/workflow-groups`,
    ),
  createGroup: (projectId: number, body: WorkflowGroupWrite) =>
    requestClient.post<WorkflowGroup>(
      `/script-pipeline/projects/${projectId}/workflow-groups`,
      body,
    ),
  createRevision: (projectId: number, body: WorkflowRevisionWrite) =>
    requestClient.post<WorkflowRevision>(
      `/script-pipeline/projects/${projectId}/workflow-revisions`,
      body,
    ),
  publishRevision: (id: number) =>
    requestClient.post<WorkflowRevision>(
      `/script-pipeline/workflow-revisions/${id}/publish`,
    ),
  createBatch: (projectId: number, body: TestBatchWrite) =>
    requestClient.post<TestBatch>(
      `/script-pipeline/projects/${projectId}/test-batches`,
      body,
    ),
  override: (body: PromptOverrideWrite) =>
    requestClient.post('/script-pipeline/node-prompt-overrides', body),
  debug: (body: DebugRunWrite) =>
    requestClient.post('/script-pipeline/node-debug-runs', body),
};

export interface PublishedProject {
  id: number;
  title: string;
}
export interface PublishedVersion {
  id: number;
  title: string;
  created_at: number;
}
export interface PublishedShot {
  key: string;
  duration_ms: number;
  action: string;
  emotion: string;
  characters: string[];
  dialogue: string[];
}
export interface PublishedPrompt {
  scene_key: string;
  clip_key: string;
  target_model: string;
  aspect_ratio: string;
  prompt: string;
  shots: PublishedShot[];
  references: Array<{
    key: string;
    media_key: string;
    kind: string;
    voice_character?: null | string;
  }>;
}
export interface PublishedDetail {
  version: PublishedVersion;
  items: PublishedPrompt[];
  next_cursor?: null | number;
}
export interface PublishedMedia {
  key: string;
  subject_key: string;
  purpose: string;
  mime: string;
  file_name: string;
  size: number;
  sha256: string;
}
export interface PublishedMediaPage {
  items: PublishedMedia[];
  next_cursor?: null | string;
}
export const PublishedScriptPipelineApi = {
  projects: () =>
    requestClient.get<PublishedProject[]>(
      '/script-pipeline/published-projects',
    ),
  versions: (projectId: number) =>
    requestClient.get<PublishedVersion[]>(
      `/script-pipeline/projects/${projectId}/published-products`,
    ),
  detail: (publicationId: number) =>
    requestClient.get<PublishedDetail>(
      `/script-pipeline/published-products/${publicationId}`,
    ),
  media: (publicationId: number) =>
    requestClient.get<PublishedMediaPage>(
      `/script-pipeline/published-products/${publicationId}/media`,
    ),
  mediaDownload: (publicationId: number, key: string) =>
    plaintextRequestClient.download<Blob>(
      `/script-pipeline/published-products/${publicationId}/media/${key}`,
    ),
};
