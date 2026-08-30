import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type DingtalkKnowledgeTargetStatus = 'disabled' | 'enabled';

export interface DingtalkWorkspaceView {
  name: string;
  root_node_id: string;
  workspace_id: string;
  workspace_type: string;
}

export interface DingtalkNodeView {
  category: string;
  has_children: boolean;
  name: string;
  node_id: string;
  node_type: string;
  workspace_id: string;
}

export interface DingtalkRemotePage<T> {
  items: T[];
  next_token?: null | string;
}

export interface DingtalkKnowledgeTargetCfg {
  app_key: string;
  created_at: number | string;
  id: number | string;
  last_verified_at?: null | number | string;
  operator_union_id: string;
  parent_node_id: string;
  parent_node_name: string;
  parent_node_path: string;
  root_node_id: string;
  status: DingtalkKnowledgeTargetStatus;
  target_code: string;
  target_name: string;
  updated_at: number | string;
  workspace_id: string;
  workspace_name: string;
}

export interface DingtalkKnowledgeTargetWrite {
  app_key: string;
  operator_union_id: string;
  parent_node_id: string;
  parent_node_path: string;
  status: DingtalkKnowledgeTargetStatus;
  target_code: string;
  target_name: string;
  workspace_id: string;
}

export interface DingtalkKnowledgeTargetQuery extends PageQuery {
  app_key?: string;
  status?: DingtalkKnowledgeTargetStatus;
  target_code_prefix?: string;
  target_name_prefix?: string;
  workspace_id?: string;
}

export interface DingtalkAppOption {
  app_key: string;
  app_name: string;
  enabled: boolean;
  is_def: boolean;
}

export interface DingtalkGroupBotCfg {
  app_key: string;
  bot_code: string;
  bot_name: string;
  created_at: number | string;
  id: number | string;
  open_conversation_id: string;
  robot_code: string;
  updated_at: number | string;
}

export interface DingtalkGroupBotWrite {
  app_key: string;
  bot_code: string;
  bot_name: string;
  open_conversation_id: string;
  robot_code: string;
}

export interface DingtalkGroupBotQuery extends PageQuery {
  app_key?: string;
  bot_code_prefix?: string;
  bot_name_prefix?: string;
  open_conversation_id?: string;
}

export interface DingtalkCustomRobotCfg {
  credential_code: string;
  credential_configured: boolean;
  created_at: number | string;
  id: number | string;
  open_conversation_id?: null | string;
  robot_code: string;
  robot_name: string;
  updated_at: number | string;
}

export interface DingtalkCustomRobotWrite {
  credential_code: string;
  open_conversation_id: string;
  robot_code: string;
  robot_name: string;
}

export interface DingtalkCustomRobotSecretView {
  secret: string;
  webhook_url: string;
}

export interface DingtalkCustomRobotQuery extends PageQuery {
  open_conversation_id?: string;
  robot_code_prefix?: string;
  robot_name_prefix?: string;
}

export const DingtalkNotifyApi = {
  apps: () => requestClient.get<DingtalkAppOption[]>('/param/dingtalk/apps'),
  workspaces: (
    appKey: string,
    params: { next_token?: string; operator_union_id: string },
  ) =>
    requestClient.get<DingtalkRemotePage<DingtalkWorkspaceView>>(
      `/param/dingtalk/apps/${appKey}/workspaces`,
      { params },
    ),
  nodes: (
    appKey: string,
    workspaceId: string,
    params: {
      next_token?: string;
      operator_union_id: string;
      parent_node_id: string;
    },
  ) =>
    requestClient.get<DingtalkRemotePage<DingtalkNodeView>>(
      `/param/dingtalk/apps/${appKey}/workspaces/${workspaceId}/nodes`,
      { params },
    ),
  knowledge_targets: (params?: DingtalkKnowledgeTargetQuery) =>
    requestClient.get<Page<DingtalkKnowledgeTargetCfg>>(
      '/param/dingtalk/knowledge-targets',
      { params },
    ),
  create_knowledge_target: (data: DingtalkKnowledgeTargetWrite) =>
    requestClient.post<DingtalkKnowledgeTargetCfg>(
      '/param/dingtalk/knowledge-targets',
      data,
    ),
  update_knowledge_target: (
    id: number | string,
    data: DingtalkKnowledgeTargetWrite,
  ) =>
    requestClient.put<DingtalkKnowledgeTargetCfg>(
      `/param/dingtalk/knowledge-targets/${id}`,
      data,
    ),
  verify_knowledge_target: (id: number | string) =>
    requestClient.post<DingtalkKnowledgeTargetCfg>(
      `/param/dingtalk/knowledge-targets/${id}/actions/verify`,
    ),
  group_bots: (params?: DingtalkGroupBotQuery) =>
    requestClient.get<Page<DingtalkGroupBotCfg>>('/param/dingtalk/group-bots', {
      params,
    }),
  create_group_bot: (data: DingtalkGroupBotWrite) =>
    requestClient.post<DingtalkGroupBotCfg>('/param/dingtalk/group-bots', data),
  update_group_bot: (id: number | string, data: DingtalkGroupBotWrite) =>
    requestClient.put<DingtalkGroupBotCfg>(
      `/param/dingtalk/group-bots/${id}`,
      data,
    ),
  custom_robots: (params?: DingtalkCustomRobotQuery) =>
    requestClient.get<Page<DingtalkCustomRobotCfg>>(
      '/param/dingtalk/custom-robots',
      { params },
    ),
  create_custom_robot: (data: DingtalkCustomRobotWrite) =>
    requestClient.post<DingtalkCustomRobotCfg>(
      '/param/dingtalk/custom-robots',
      data,
    ),
  update_custom_robot: (id: number | string, data: DingtalkCustomRobotWrite) =>
    requestClient.put<DingtalkCustomRobotCfg>(
      `/param/dingtalk/custom-robots/${id}`,
      data,
    ),
  reveal_custom_robot: (id: number | string, step_up_token: string) =>
    requestClient.post<DingtalkCustomRobotSecretView>(
      `/param/dingtalk/custom-robots/${id}/reveal`,
      undefined,
      {
        headers: { 'X-Kx-Step-Up-Token': step_up_token },
      },
    ),
};
