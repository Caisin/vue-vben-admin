import type { AgentTask } from './writer';

import { writerCommand } from './writer';
export type ProjectFormat = 'film' | 'short_drama' | 'tv_series' | 'web_series';
export type DraftKind = 'episode' | 'outline' | 'scene';
export interface WriterProject {
  id: string;
  role_id: string;
  role_version: number;
  name: string;
  format: ProjectFormat;
  brief: string;
  canon: Record<string, unknown>;
  revision: number;
  created_at: string;
  updated_at: string;
}
export interface ProjectWrite {
  name: string;
  format: ProjectFormat;
  brief: string;
  canon: Record<string, unknown>;
  role_version: number;
}
export interface DraftSummary {
  id: string;
  revision: number;
  project_id: string;
  role_version: number;
  kind: DraftKind;
  title: string;
  characters: number;
  created_at: string;
}
export interface WriterDraft extends DraftSummary {
  content: string;
}
export interface WriterReview {
  id: string;
  draft_id: string;
  draft_revision: number;
  role_version: number;
  summary: string;
  findings: {
    severity: 'error' | 'info' | 'warning';
    quote: string;
    issue: string;
    suggestion: string;
  }[];
  created_at: string;
}
export const ProjectApi = {
  list: (role: string, offset = 0) =>
    writerCommand<{ projects: WriterProject[] }>(role, 'writer_project', {
      action: 'list',
      offset,
      limit: 16,
    }),
  get: (role: string, id: string) =>
    writerCommand<{ project: WriterProject }>(role, 'writer_project', {
      action: 'get',
      project_id: id,
    }),
  create: (role: string, input: ProjectWrite) =>
    writerCommand<{ project: WriterProject }>(role, 'writer_project', {
      action: 'create',
      ...input,
    }),
  update: (
    role: string,
    project: string,
    revision: number,
    input: ProjectWrite,
  ) =>
    writerCommand<{ project: WriterProject }>(role, 'writer_project', {
      action: 'update',
      project_id: project,
      expected_revision: revision,
      ...input,
    }),
  remove: (role: string, id: string) =>
    writerCommand(role, 'writer_project', {
      action: 'delete',
      project_id: id,
      confirm: true,
    }),
  drafts: (role: string, project: string, offset = 0) =>
    writerCommand<{ drafts: DraftSummary[] }>(role, 'writer_draft', {
      action: 'list',
      project_id: project,
      summary_only: true,
      offset,
      limit: 16,
    }),
  draft: (role: string, id: string, revision?: number) =>
    writerCommand<{ draft: WriterDraft }>(role, 'writer_draft', {
      action: 'get',
      draft_id: id,
      ...(revision === undefined ? {} : { revision }),
    }),
  save: (role: string, draft: WriterDraft, title: string, content: string) =>
    writerCommand<{ draft: WriterDraft }>(role, 'writer_draft', {
      action: 'save',
      project_id: draft.project_id,
      draft_id: draft.id,
      expected_revision: draft.revision,
      role_version: draft.role_version,
      kind: draft.kind,
      title,
      content,
    }),
  removeDraft: (role: string, id: string) =>
    writerCommand(role, 'writer_draft', {
      action: 'delete',
      draft_id: id,
      confirm: true,
    }),
  reviews: (role: string, draft: string, offset = 0) =>
    writerCommand<{ reviews: WriterReview[] }>(role, 'writer_review', {
      action: 'list',
      draft_id: draft,
      offset,
      limit: 16,
    }),
  write: (
    role: string,
    project: WriterProject,
    kind: DraftKind,
    requirements: string,
  ) =>
    writerCommand<{ task: AgentTask }>(role, 'writer_task', {
      action: 'create',
      project_id: project.id,
      kind: 'write',
      input: { kind, requirements, project_revision: project.revision },
    }),
  review: (
    role: string,
    project: WriterProject,
    draft: WriterDraft,
    requirements: string,
  ) =>
    writerCommand<{ task: AgentTask }>(role, 'writer_task', {
      action: 'create',
      project_id: project.id,
      kind: 'review',
      input: {
        draft_id: draft.id,
        draft_revision: draft.revision,
        project_revision: project.revision,
        requirements,
      },
    }),
};
