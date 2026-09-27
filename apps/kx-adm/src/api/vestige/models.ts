import type { TaskRun } from '#/api/task/run';

import { requestClient } from '#/api/request';

export type ModelAction =
  | 'model_activate'
  | 'model_evaluate'
  | 'model_install'
  | 'model_migrate';
export interface ModelMigration {
  state: string;
  completed: number;
  total: number;
  requestKey?: string;
}
export interface ModelEvaluation {
  completed_at: string;
  corpus_size: number;
  recall_at_5: null | number;
  ndcg_at_10: null | number;
}
export interface RoleModel {
  profile: {
    profile_id: string;
    display_name: string;
    model_id: string;
    embedding_dimension: number;
  };
  state: string;
  evaluation: ModelEvaluation | null;
  vectorCount: number;
  missingVectors: number;
  hasCompletedMigration: boolean;
  latestMigration?: ModelMigration;
}
export interface ModelOperation {
  requestKey: string;
  actorId: string;
  canRetry: boolean;
  operation: {
    kind: ModelAction;
    profile_id: string;
    expected_active?: string;
  };
  migration?: ModelMigration;
  task?: TaskRun;
  result: null | {
    evaluation?: ModelEvaluation;
    evaluationScope?: string;
    qualityComparison?: boolean;
  };
}
export interface RoleModelState {
  active: { active_profile_id: string };
  profiles: RoleModel[];
  operations: ModelOperation[];
  canManage: boolean;
  migrationAvailable: boolean;
  available: {
    legacy_nomic_ready: boolean;
    profiles: {
      profile_id: string;
      model_id: string;
      dimensions: number;
      device: string;
    }[];
  };
}
const root = (role: string) => `/vestige/roles/${encodeURIComponent(role)}`;
export const ModelApi = {
  status: (role: string) =>
    requestClient.get<RoleModelState>(`${root(role)}/models`),
  submit: (
    role: string,
    action: ModelAction,
    profileId: string,
    request_key: string,
    expectedActive?: string,
    confirm?: boolean,
  ) =>
    requestClient.post<TaskRun>(`${root(role)}/maintenance`, {
      action,
      profileId,
      request_key,
      ...(expectedActive ? { expectedActive } : {}),
      ...(confirm ? { confirm } : {}),
    }),
  cancel: (role: string, task: number | string) =>
    requestClient.post(
      `${root(role)}/maintenance/${encodeURIComponent(String(task))}/cancel`,
      {},
    ),
};
