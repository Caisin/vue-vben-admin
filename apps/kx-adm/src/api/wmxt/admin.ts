import type { JsonValue, Page, PageQuery } from '#/api/request';
import type { TaskRun } from '#/api/task';

import { requestClient } from '#/api/request';

import { WmxtHomeEntryAdminApi } from './home-entry';
import { WmxtProfileEntryAdminApi } from './profile-entry';

export type EnabledStatus = 'active' | 'inactive';
export type ContentStatus = 'archived' | 'draft' | 'published';
export type TaskStatus = 'closed' | 'draft' | 'published';
export type TargetRole = 'all' | 'family' | 'org' | 'personal';
export type SubmissionStatus =
  | 'approved'
  | 'pending'
  | 'rectified'
  | 'rejected';
export type SurveyStatus = 'active' | 'closed';
export type SurveyTarget = 'all' | 'family' | 'org' | 'personal';
export type SnapshotStatus = SubmissionStatus;
export type SnapshotType = 'good_deed' | 'problem' | 'quick_submit';
export type WmxtRole = 'admin' | 'org' | 'personal';

export interface WmxtRecord {
  created_at?: number | string;
  id?: number | string;
  updated_at?: number | string;
}

export interface WmxtBanner extends WmxtRecord {
  description: string;
  link: string;
  link_type: string;
  material_type: string;
  sort_order: number;
  status: EnabledStatus;
  target: string;
  title: string;
  url: string;
}
export type WmxtBannerWrite = Omit<WmxtBanner, 'created_at' | 'updated_at'>;
export interface WmxtFamily extends WmxtRecord {
  available_score: number | string;
  creator_user_id: number | string;
  deleted_at: number | string;
  invite_code: string;
  is_del: boolean;
  member_count: number;
  name: string;
  total_score: number | string;
}
export interface WmxtFamilyWrite {
  creator_user_id: number | string;
  id?: number | string;
  invite_code: string;
  member_count: number;
  name: string;
}
export interface WmxtOrganization extends WmxtRecord {
  admin_user_id: number | string;
  available_score?: number | string;
  deleted_at: number | string;
  id: number | string;
  invite_code: string;
  is_del: boolean;
  member_count: number;
  name: string;
  org_code: string;
  total_score?: number | string;
}
export interface WmxtOrganizationView extends WmxtOrganization {
  balance?: WmxtPointBalance;
}
export interface WmxtOrganizationWrite {
  admin_user_id: number | string;
  id?: number | string;
  invite_code: string;
  member_count: number;
  name: string;
  org_code: string;
}
export interface WmxtTask extends WmxtRecord {
  category: string;
  deadline: number | string;
  description: string;
  id: number | string;
  images: JsonValue;
  is_del: boolean;
  location_name: string;
  location_required: boolean;
  points: number | string;
  publisher_user_id: number | string;
  status: TaskStatus;
  target_role: TargetRole;
  task_type: string;
  title: string;
}
export interface WmxtTaskWrite {
  category: string;
  deadline: number | string;
  description: string;
  id?: number | string;
  images: JsonValue;
  location_lat?: null | number;
  location_lng?: null | number;
  location_name: string;
  location_required: boolean;
  max_participants: number;
  points: number | string;
  status: TaskStatus;
  target_role: TargetRole;
  task_type: string;
  title: string;
}
export interface WmxtSubmission extends WmxtRecord {
  attachments: JsonValue;
  id: number | string;
  images: JsonValue;
  is_public: boolean;
  note: string;
  reviewer_user_id?: number | string;
  status: SubmissionStatus;
  submission_kind: string;
  submitter_name: string;
  submitter_type: string;
  submitter_user_id: number | string;
  task_id?: number | string;
}
export interface WmxtSnapshot extends WmxtRecord {
  category: string;
  description: string;
  id: number | string;
  is_del: boolean;
  location: string;
  media_urls: JsonValue;
  snapshot_type: SnapshotType;
  status: SnapshotStatus;
  title: string;
  user_id: number | string;
  user_name: string;
}
export interface WmxtSurvey extends WmxtRecord {
  deadline_at: number | string;
  description: string;
  id: number | string;
  is_del: boolean;
  points: number | string;
  status: SurveyStatus;
  target: SurveyTarget;
  title: string;
}
export interface WmxtSurveyMetaWrite {
  deadline_at: number | string;
  description: string;
  id?: number | string;
  points: number | string;
  status: SurveyStatus;
  target: SurveyTarget;
  title: string;
}
export interface WmxtSurveyQuestion {
  id?: number | string;
  options_json: JsonValue;
  q_type: string;
  required: boolean;
  sort: number;
  survey_id?: number | string;
  title: string;
}
export interface WmxtSurveyWrite {
  questions: WmxtSurveyQuestion[];
  survey: WmxtSurveyMetaWrite;
}
export interface WmxtSurveyDetail {
  questions: WmxtSurveyQuestion[];
  submission?: JsonValue;
  survey: WmxtSurvey;
}
export interface WmxtNotification extends WmxtRecord {
  content: string;
  id: number | string;
  notice_type: string;
  published_at: number | string;
  sort_order: number;
  status: EnabledStatus;
  target: string;
  title: string;
}
export interface WmxtNotificationWrite {
  content: string;
  id?: number | string;
  notice_type: string;
  published_at?: number | string;
  sort_order: number;
  status: EnabledStatus;
  target: string;
  title: string;
}
export interface WmxtModule extends WmxtRecord {
  id: number | string;
  module_code: string;
  module_name: string;
  page_code: string;
  sort_order: number;
  status: EnabledStatus;
  vote_enabled: boolean;
}
export interface WmxtContentPage extends WmxtRecord {
  code: string;
  id: number | string;
  name: string;
  sort_order: number;
  status: EnabledStatus;
}
export type WmxtContentPageWrite = Omit<
  WmxtContentPage,
  'created_at' | 'id' | 'updated_at'
>;
export interface WmxtModuleWrite {
  id?: number | string;
  module_code: string;
  module_name: string;
  page_code: string;
  sort_order: number;
  status: EnabledStatus;
  vote_enabled: boolean;
}
export interface WmxtOrderItem {
  id: number | string;
  sort_order: number;
}
export interface WmxtModuleOrderWrite {
  items: WmxtOrderItem[];
  page_code: string;
}
export interface WmxtModuleItem extends WmxtRecord {
  article_id?: number | string;
  content_type: string;
  content_url: string;
  cover_url: string;
  description: string;
  id: number | string;
  module_id: number | string;
  published_at?: number | string;
  sort_order: number;
  status: ContentStatus;
  title: string;
}
export interface WmxtModuleItemWrite {
  article_id?: number | string;
  content_type: string;
  content_url: string;
  cover_url: string;
  description: string;
  id?: number | string;
  module_id: number | string;
  published_at?: number | string;
  sort_order: number;
  status: ContentStatus;
  title: string;
}
export interface WmxtModuleItemOrderWrite {
  items: WmxtOrderItem[];
  module_id: number | string;
}
export interface WmxtPointRule extends WmxtRecord {
  activity_type: string;
  description: string;
  id: number | string;
  is_del: boolean;
  max_points: number;
  min_points: number;
  rule_name: string;
  status: EnabledStatus;
}
export interface WmxtPointRuleWrite {
  activity_type: string;
  description: string;
  id?: number | string;
  max_points: number;
  min_points: number;
  rule_name: string;
  status: EnabledStatus;
}
export interface WmxtPointBalance {
  available: number | string;
  frozen: number | string;
  total: number | string;
}
export interface WmxtPointYearOverview {
  budget_amount: number | string;
  has_config: boolean;
  id?: number | string;
  point_ratio: number | string;
  ratio_locked: boolean;
  remaining_points: number | string;
  remark?: string;
  sign_in_points: number | string;
  total_available_points: number | string;
  updated_at: number | string;
  used_points: number | string;
  year: number;
}
export interface WmxtPointConfigWrite {
  budget_amount: number;
  id?: number | string;
  point_ratio: number;
  remark?: string;
  year: number;
}
export interface WmxtCheckinConfigWrite {
  sign_in_points: number;
  year: number;
}
export interface WmxtPointHistoryItem extends WmxtRecord {
  amount?: number | string;
  created_at: number | string;
  id: number | string;
  reason?: string;
  source_id?: string;
  source_type?: string;
  uid?: number | string;
}
export interface WmxtAdminUser extends WmxtRecord {
  available_score: number | string;
  avatar: string;
  can_admin: boolean;
  can_org: boolean;
  can_personal: boolean;
  family_name?: null | string;
  id: number | string;
  is_admin: boolean;
  nickname: string;
  org_name?: null | string;
  role_labels: string[];
  roles: WmxtRole[];
  status: string;
  tel: string;
  total_score: number | string;
  user_id: number | string;
  username: string;
}
export interface WmxtAdminHomeStats {
  active_user_count: number;
  completed_task_count: number;
  pending_count: number;
  point_summary: WmxtPointYearOverview;
  task_count: number;
  total_points: number | string;
  user_count: number;
}
export interface WmxtMaterialWrite {
  attachments: JsonValue;
  note?: string;
  title: string;
}

export interface WmxtListQuery extends PageQuery {
  [key: string]: boolean | number | string | string[] | undefined;
}

const basePath = '/wmxt/admin';

export const WmxtAdminApi = {
  ...WmxtHomeEntryAdminApi,
  ...WmxtProfileEntryAdminApi,
  home_stats: () =>
    requestClient.get<WmxtAdminHomeStats>(`${basePath}/home/stats`),

  banners: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtBanner>>(`${basePath}/banners`, { params }),
  banner: (id: number | string) =>
    requestClient.get<WmxtBanner>(`${basePath}/banners/${id}`),
  create_banner: (data: WmxtBannerWrite) =>
    requestClient.post<WmxtBanner>(`${basePath}/banners`, data),
  update_banner: (id: number | string, data: WmxtBannerWrite) =>
    requestClient.put<WmxtBanner>(`${basePath}/banners/${id}`, data),
  remove_banner: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/banners/${id}`),

  families: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtFamily>>(`${basePath}/families`, { params }),
  family: (id: number | string) =>
    requestClient.get<WmxtFamily>(`${basePath}/families/${id}`),
  family_members: (id: number | string) =>
    requestClient.get<WmxtAdminUser[]>(`${basePath}/families/${id}/members`),
  create_family: (data: WmxtFamilyWrite) =>
    requestClient.post<WmxtFamily>(`${basePath}/families`, data),
  update_family: (id: number | string, data: WmxtFamilyWrite) =>
    requestClient.put<WmxtFamily>(`${basePath}/families/${id}`, data),
  remove_family: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/families/${id}`),

  organizations: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtOrganizationView>>(`${basePath}/organizations`, {
      params,
    }),
  organization: (id: number | string) =>
    requestClient.get<WmxtOrganizationView>(`${basePath}/organizations/${id}`),
  create_organization: (data: WmxtOrganizationWrite) =>
    requestClient.post<WmxtOrganizationView>(`${basePath}/organizations`, data),
  update_organization: (id: number | string, data: WmxtOrganizationWrite) =>
    requestClient.put<WmxtOrganizationView>(
      `${basePath}/organizations/${id}`,
      data,
    ),
  remove_organization: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/organizations/${id}`),
  add_organization_points: (
    id: number | string,
    data: { idempotency_key: string; points: number; remark: string },
  ) =>
    requestClient.post<WmxtOrganizationView>(
      `${basePath}/organizations/${id}/points`,
      data,
    ),
  organization_point_logs: (id: number | string, params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtPointHistoryItem>>(
      `${basePath}/organizations/${id}/point-logs`,
      { params },
    ),

  tasks: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtTask>>(`${basePath}/tasks`, { params }),
  task: (id: number | string) =>
    requestClient.get<WmxtTask>(`${basePath}/tasks/${id}`),
  create_task: (data: WmxtTaskWrite) =>
    requestClient.post<WmxtTask>(`${basePath}/tasks`, data),
  create_simple_task: (data: WmxtTaskWrite) =>
    requestClient.post<WmxtTask>(`${basePath}/tasks/simple`, data),
  update_task: (id: number | string, data: WmxtTaskWrite) =>
    requestClient.put<WmxtTask>(`${basePath}/tasks/${id}`, data),
  remove_task: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/tasks/${id}`),
  purge_task: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/tasks/${id}/purge`),

  submissions: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtSubmission>>(`${basePath}/submissions`, {
      params,
    }),
  submission: (id: number | string) =>
    requestClient.get<WmxtSubmission>(`${basePath}/submissions/${id}`),
  review_submission: (
    id: number | string,
    data: { comment: string; score?: number; status: SubmissionStatus },
  ) =>
    requestClient.put<WmxtSubmission>(
      `${basePath}/submissions/${id}/review`,
      data,
    ),
  submission_deduct_info: (id: number | string) =>
    requestClient.get<JsonValue>(`${basePath}/submissions/${id}/deduct-info`),
  package_submission: (id: number | string) =>
    requestClient.post<TaskRun>(`${basePath}/submissions/${id}/package-tasks`),
  create_public_material: (data: WmxtMaterialWrite) =>
    requestClient.post<WmxtSubmission>(
      `${basePath}/submissions/public-material`,
      data,
    ),
  update_public_material: (id: number | string, data: WmxtMaterialWrite) =>
    requestClient.put<WmxtSubmission>(`${basePath}/submissions/${id}`, data),
  remove_submission: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/submissions/${id}`),

  snapshots: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtSnapshot>>(`${basePath}/snapshots`, { params }),
  snapshot: (id: number | string) =>
    requestClient.get<WmxtSnapshot>(`${basePath}/snapshots/${id}`),
  review_snapshot: (
    id: number | string,
    data: { points?: number; review_comment: string; status: SnapshotStatus },
  ) =>
    requestClient.put<WmxtSnapshot>(`${basePath}/snapshots/${id}/review`, data),
  rectify_snapshot: (
    id: number | string,
    data: { rectify_media_urls: JsonValue; review_comment: string },
  ) =>
    requestClient.put<WmxtSnapshot>(
      `${basePath}/snapshots/${id}/rectify`,
      data,
    ),

  surveys: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtSurvey>>(`${basePath}/surveys`, { params }),
  survey: (id: number | string) =>
    requestClient.get<WmxtSurveyDetail>(`${basePath}/surveys/${id}`),
  create_survey: (data: WmxtSurveyWrite) =>
    requestClient.post<WmxtSurvey>(`${basePath}/surveys`, data),
  update_survey: (id: number | string, data: WmxtSurveyWrite) =>
    requestClient.put<WmxtSurvey>(`${basePath}/surveys/${id}`, data),
  remove_survey: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/surveys/${id}`),

  point_rules: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtPointRule>>(`${basePath}/point-rules`, {
      params,
    }),
  point_rule: (id: number | string) =>
    requestClient.get<WmxtPointRule>(`${basePath}/point-rules/${id}`),
  create_point_rule: (data: WmxtPointRuleWrite) =>
    requestClient.post<WmxtPointRule>(`${basePath}/point-rules`, data),
  update_point_rule: (id: number | string, data: WmxtPointRuleWrite) =>
    requestClient.put<WmxtPointRule>(`${basePath}/point-rules/${id}`, data),
  remove_point_rule: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/point-rules/${id}`),
  point_overview: (params?: { year?: number }) =>
    requestClient.get<WmxtPointYearOverview>(`${basePath}/points/overview`, {
      params,
    }),
  point_years: () =>
    requestClient.get<WmxtPointYearOverview[]>(`${basePath}/points/years`),
  point_history: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtPointHistoryItem>>(
      `${basePath}/points/history`,
      { params },
    ),
  save_point_config: (data: WmxtPointConfigWrite) =>
    requestClient.put<WmxtPointYearOverview>(`${basePath}/points/config`, data),
  save_checkin_config: (data: WmxtCheckinConfigWrite) =>
    requestClient.put<WmxtPointYearOverview>(
      `${basePath}/points/checkin-config`,
      data,
    ),

  users: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtAdminUser>>(`${basePath}/users`, { params }),
  users_by_role: (role: WmxtRole, params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtAdminUser>>(
      `${basePath}/users/by-role/${role}`,
      { params },
    ),
  user: (uid: number | string) =>
    requestClient.get<WmxtAdminUser>(`${basePath}/users/${uid}`),
  update_user_roles: (uid: number | string, roles: WmxtRole[]) =>
    requestClient.put<WmxtAdminUser>(`${basePath}/users/${uid}/roles`, {
      roles,
    }),
  update_user_status: (uid: number | string, status: string) =>
    requestClient.put<WmxtAdminUser>(`${basePath}/users/${uid}/status`, {
      status,
    }),

  notifications: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtNotification>>(`${basePath}/notifications`, {
      params,
    }),
  notification: (id: number | string) =>
    requestClient.get<WmxtNotification>(`${basePath}/notifications/${id}`),
  create_notification: (data: WmxtNotificationWrite) =>
    requestClient.post<WmxtNotification>(`${basePath}/notifications`, data),
  update_notification: (id: number | string, data: WmxtNotificationWrite) =>
    requestClient.put<WmxtNotification>(
      `${basePath}/notifications/${id}`,
      data,
    ),
  remove_notification: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/notifications/${id}`),
  modules: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtModule>>(`${basePath}/modules`, { params }),
  module: (id: number | string) =>
    requestClient.get<WmxtModule>(`${basePath}/modules/${id}`),
  create_module: (data: WmxtModuleWrite) =>
    requestClient.post<WmxtModule>(`${basePath}/modules`, data),
  update_module: (id: number | string, data: WmxtModuleWrite) =>
    requestClient.put<WmxtModule>(`${basePath}/modules/${id}`, data),
  remove_module: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/modules/${id}`),
  order_modules: (data: WmxtModuleOrderWrite) =>
    requestClient.put<WmxtModule[]>(`${basePath}/modules/order`, data),
  content_pages: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtContentPage>>(`${basePath}/content-pages`, {
      params,
    }),
  create_content_page: (data: WmxtContentPageWrite) =>
    requestClient.post<WmxtContentPage>(`${basePath}/content-pages`, data),
  update_content_page: (id: number | string, data: WmxtContentPageWrite) =>
    requestClient.put<WmxtContentPage>(`${basePath}/content-pages/${id}`, data),
  remove_content_page: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/content-pages/${id}`),
  module_items: (params?: WmxtListQuery) =>
    requestClient.get<Page<WmxtModuleItem>>(`${basePath}/module-items`, {
      params,
    }),
  module_item: (id: number | string) =>
    requestClient.get<WmxtModuleItem>(`${basePath}/module-items/${id}`),
  create_module_item: (data: WmxtModuleItemWrite) =>
    requestClient.post<WmxtModuleItem>(`${basePath}/module-items`, data),
  update_module_item: (id: number | string, data: WmxtModuleItemWrite) =>
    requestClient.put<WmxtModuleItem>(`${basePath}/module-items/${id}`, data),
  remove_module_item: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/module-items/${id}`),
  update_module_item_status: (id: number | string, status: ContentStatus) =>
    requestClient.put<WmxtModuleItem>(`${basePath}/module-items/${id}/status`, {
      status,
    }),
  order_module_items: (data: WmxtModuleItemOrderWrite) =>
    requestClient.put<WmxtModuleItem[]>(`${basePath}/module-items/order`, data),
};
