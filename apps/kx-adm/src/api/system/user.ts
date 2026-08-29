import type {
  AdminUser,
  AdminUserDetail,
  AdminUserWrite,
} from '#/api/auth/admin';
import type {
  LegacyPage,
  LegacyPageQuery,
  StatusValue,
} from '#/api/system/shared';
import type { TaskRun } from '#/api/task';

import { requestClient } from '#/api/request';
import {
  enabledFromStatus,
  pageParams,
  statusFromEnabled,
} from '#/api/system/shared';

export interface SystemUser {
  apiIds?: string[];
  avatar?: string;
  createTime?: number | string;
  deptId?: number | string;
  email?: string;
  homePermId?: null | string;
  id: string;
  name: string;
  permissions?: string[];
  platform?: string;
  remark?: null | string;
  roles?: string[];
  status: StatusValue;
  tel?: string;
}

export type SystemUserWrite = Partial<Omit<SystemUser, 'createTime' | 'id'>> & {
  password?: string;
};

export interface UserWeeklyReportTemplateRequest {
  current_week_end: string;
  current_week_start: string;
  dept_id: number;
  next_week_end: string;
  next_week_start: string;
  report_date: string;
  reporter: string;
  week_no: number;
}

export interface UserWeeklyReportDingTalkRequest extends UserWeeklyReportTemplateRequest {
  channel_id: number;
  knowledge_target_id: number;
  notification_style: WeeklyReportNotificationStyle;
}

export interface WeeklyReportRepublishRequest {
  channel_id: number;
  notification_style: WeeklyReportNotificationStyle;
}

export type WeeklyReportNotificationStyle =
  | 'action_card'
  | 'link_card'
  | 'markdown';

export type WeeklyReportPublishStatus =
  | 'content_written'
  | 'document_created'
  | 'failed'
  | 'message_queued'
  | 'pending';
export type WeeklyReportReminderStatus =
  | 'all_completed'
  | 'failed'
  | 'mapping_invalid'
  | 'not_checked'
  | 'pending';
export type WeeklyReportParticipantStatus =
  | 'completed'
  | 'mapping_invalid'
  | 'pending';

export interface WeeklyReportPublish {
  channel_id: number | string;
  created_at: number | string;
  dept_id: number | string;
  doc_url?: null | string;
  id: number | string;
  knowledge_target_id: number | string;
  last_checked_at?: null | number | string;
  last_reminded_at?: null | number | string;
  notification_style?: null | WeeklyReportNotificationStyle;
  notify_message_id?: null | number | string;
  publish_key: string;
  reminder_round: number;
  reminder_status: WeeklyReportReminderStatus;
  report_date: string;
  sheet_id?: null | string;
  status: WeeklyReportPublishStatus;
  task_run_id?: null | number | string;
  title: string;
  updated_at: number | string;
  week_no: number;
}

export interface WeeklyReportParticipant {
  dingtalk_user_id?: null | string;
  display_name: string;
  id: number | string;
  last_checked_at?: null | number | string;
  last_reminded_at?: null | number | string;
  publish_id: number | string;
  reminder_count: number;
  sheet_row: number;
  status: WeeklyReportParticipantStatus;
  uid: number | string;
}

interface AdminUserSystem extends AdminUser {
  api_ids?: Array<number | string>;
  dept_id?: number | string;
  permission_ids?: Array<number | string>;
  remark?: null | string;
}

interface AdminUserSystemDetail extends AdminUserDetail {
  dept_id?: number | string;
  permission_ids?: Array<number | string>;
  remark?: null | string;
}

interface AdminUserSystemWrite extends AdminUserWrite {
  dept_id?: number | string;
  permission_ids?: Array<number | string>;
  remark?: null | string;
}

function homePermissionId(value: null | string | undefined) {
  return value ? Number(value) : null;
}

function toSystemUser(
  user: AdminUserSystem,
  permissions: Array<number | string> = [],
  roles: string[] = [],
): SystemUser {
  return {
    apiIds: (user.api_ids ?? []).map(String),
    avatar: user.avatar,
    createTime: user.created_at,
    deptId: user.dept_id,
    email: user.email,
    homePermId:
      user.home_perm_id === null || user.home_perm_id === undefined
        ? null
        : String(user.home_perm_id),
    id: String(user.id),
    name: user.name,
    permissions: permissions.map(String),
    platform: user.platform,
    remark: user.remark,
    roles,
    status: statusFromEnabled(user.enabled),
    tel: user.tel,
  };
}

function toUserWrite(
  data: SystemUserWrite,
  previous?: AdminUserSystemDetail,
): AdminUserSystemWrite {
  return {
    api_ids: (data.apiIds ?? previous?.api_ids ?? []).map(Number),
    avatar: data.avatar ?? previous?.avatar ?? '',
    dept_id: Object.hasOwn(data, 'deptId')
      ? Number(data.deptId || 0)
      : (previous?.dept_id ?? 0),
    email: data.email ?? previous?.email ?? '',
    enabled:
      data.status === undefined
        ? (previous?.enabled ?? true)
        : enabledFromStatus(data.status),
    home_perm_id: Object.hasOwn(data, 'homePermId')
      ? homePermissionId(data.homePermId)
      : (previous?.home_perm_id ?? null),
    is_guest: previous?.is_guest ?? false,
    name: data.name ?? previous?.name ?? '',
    os: previous?.os ?? '',
    password: data.password,
    permission_ids: (data.permissions ?? previous?.permission_ids ?? []).map(
      Number,
    ),
    platform: data.platform ?? previous?.platform ?? '',
    reg_ip: previous?.reg_ip ?? '',
    remark: data.remark ?? previous?.remark ?? null,
    role_ids: (data.roles ?? previous?.role_ids ?? []).map(String),
    tel: data.tel ?? previous?.tel ?? '',
  };
}

export const SystemUserApi = {
  async options(params: LegacyPageQuery = {}): Promise<LegacyPage<SystemUser>> {
    const result = await requestClient.get<
      import('#/api/request').Page<AdminUserSystem>
    >('/auth/user-admin', {
      params: {
        ...pageParams(params),
        keyword: params.keyword,
      },
    });
    return {
      items: result.items.map((item) => toSystemUser(item)),
      total: result.total,
    };
  },
  async list(params: LegacyPageQuery = {}): Promise<LegacyPage<SystemUser>> {
    const result = await requestClient.get<
      import('#/api/request').Page<AdminUserSystem>
    >('/auth/user-admin', {
      params: {
        ...pageParams(params),
        dept_id: params.deptId || undefined,
        dept_ids: params.deptIds?.length ? params.deptIds.join(',') : undefined,
        keyword: params.keyword,
      },
    });
    const items = await Promise.all(
      result.items.map(async (item) => {
        const detail = await requestClient.get<AdminUserSystemDetail>(
          `/auth/user-admin/${item.id}`,
        );
        return toSystemUser(
          { ...item, ...detail, api_ids: detail.api_ids },
          detail.permission_ids,
          detail.role_ids,
        );
      }),
    );
    return { items, total: result.total };
  },
  async create(data: SystemUserWrite) {
    const user = await requestClient.post<AdminUserSystem>(
      '/auth/user-admin',
      toUserWrite(data),
    );
    return {
      ...toSystemUser(user, data.permissions, data.roles),
      apiIds: data.apiIds?.map(String) ?? [],
    };
  },
  async update(id: string, data: SystemUserWrite) {
    const detail = await requestClient.get<AdminUserSystemDetail>(
      `/auth/user-admin/${id}`,
    );
    const write = toUserWrite(data, detail);
    const user = await requestClient.put<AdminUserSystem>(
      `/auth/user-admin/${id}`,
      write,
    );
    return {
      ...toSystemUser(user, write.permission_ids, write.role_ids),
      apiIds: write.api_ids?.map(String) ?? [],
    };
  },
  remove: (id: string) =>
    requestClient.delete<boolean>(`/auth/user-admin/${id}`),
  reindexSearch: () =>
    requestClient.post<{ indexed: number }>('/auth/user-admin/search/reindex'),
  reset_totp: (id: string) =>
    requestClient.delete<boolean>(`/auth/user-admin/${id}/mfa/totp`),
  weekly_report_template: (data: UserWeeklyReportTemplateRequest) =>
    requestClient.download<Blob>(
      '/auth/user-admin/actions/weekly-report-template',
      { data, method: 'POST' },
    ),
  weekly_report_dingtalk: (data: UserWeeklyReportDingTalkRequest) =>
    requestClient.post<TaskRun>(
      '/auth/user-admin/actions/weekly-report-dingtalk',
      data,
    ),
  weekly_report_publishes: (params?: LegacyPageQuery) =>
    requestClient.get<import('#/api/request').Page<WeeklyReportPublish>>(
      '/auth/user-admin/weekly-report-publishes',
      { params: pageParams(params ?? {}) },
    ),
  weekly_report_publish: (id: number | string) =>
    requestClient.get<WeeklyReportPublish>(
      `/auth/user-admin/weekly-report-publishes/${id}`,
    ),
  weekly_report_participants: (id: number | string) =>
    requestClient.get<WeeklyReportParticipant[]>(
      `/auth/user-admin/weekly-report-publishes/${id}/participants`,
    ),
  weekly_report_preview_missing: (id: number | string) =>
    requestClient.post<WeeklyReportParticipant[]>(
      `/auth/user-admin/weekly-report-publishes/${id}/actions/preview-missing`,
    ),
  weekly_report_remind_missing: (id: number | string) =>
    requestClient.post<TaskRun>(
      `/auth/user-admin/weekly-report-publishes/${id}/actions/remind-missing`,
    ),
  weekly_report_republish: (
    id: number | string,
    data: WeeklyReportRepublishRequest,
  ) =>
    requestClient.post<TaskRun>(
      `/auth/user-admin/weekly-report-publishes/${id}/actions/republish`,
      data,
    ),
};
