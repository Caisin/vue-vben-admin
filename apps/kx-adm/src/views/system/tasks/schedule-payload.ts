import type {
  TaskExecutor,
  TaskPayloadPropertySchema,
  TaskPayloadSchema,
} from '#/api/task';

export type TaskPayloadPrimitive = boolean | null | number | string;
export type TaskPayloadSelectValue = null | number | string;

export interface PayloadSelectOption {
  disabled?: boolean;
  help_msg?: null | string;
  label: string;
  value: TaskPayloadSelectValue;
}

export type PayloadFieldComponent =
  | 'boolean'
  | 'number'
  | 'select'
  | 'text'
  | 'textarea';

export interface PayloadFormField {
  component: PayloadFieldComponent;
  help?: string;
  label: string;
  maximum?: number;
  minimum?: number;
  name: string;
  options?: PayloadSelectOption[];
  required: boolean;
  schema: TaskPayloadPropertySchema;
}

export type PayloadFormValues = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  access_token: 'Access Token',
  app_secret: 'AppSecret',
  article_id: '文章 ID',
  batch_size: '批量大小',
  campaign_id: '活动 ID',
  channel_id: '通道 ID',
  coin_asset_code: '金币资产编码',
  content: '内容对象',
  content_id: '内容 ID',
  contents: '内容列表',
  current_week_end: '本周结束日',
  current_week_start: '本周开始日',
  cursor: '游标',
  dept_id: '部门 ID',
  knowledge_target_id: '钉钉知识库目标 ID',
  end: '结束值',
  event_id: '事件 ID',
  external_id: '外部 ID',
  file_id: '文件 ID',
  last_id: '最近 ID',
  locale: '语言',
  log_id: '日志 ID',
  next_week_end: '下周结束日',
  next_week_start: '下周开始日',
  notify_channel_code: '通知通道编码',
  order_id: '订单 ID',
  provider: '来源类型',
  reason: '原因',
  recharge_asset_code: '充值资产编码',
  release_id: '发布版本 ID',
  reporter: '填报人',
  report_date: '报告日期',
  resume_after_id: '断点 ID',
  scope: '同步范围',
  source_code: '来源编码',
  source_id: '组织数据源',
  start: '起始值',
  stat_day: '统计日期',
  stat_kind: '统计类型',
  stat_point: '统计点',
  storage_code: '存储配置编码',
  submission_id: '提交 ID',
  table: '旧库表名',
  target_type: '目标类型',
  week_no: '周次',
};

const VALUE_LABELS: Record<string, string> = {
  all: '全部',
  channel_auth_all: '全量渠道授权',
  content: '单内容',
  contents: '内容列表',
  cx_category: '旧库分类',
  cx_channel_res: '旧库渠道资源',
  cx_consumption_log: '旧库消费日志',
  cx_res: '旧库资源',
  cx_res_category: '旧库资源分类',
  cx_user_app_push_log: '旧库用户推送日志',
  dingtalk: '钉钉',
  facebook: 'Facebook',
  facebook_event: 'Facebook 事件',
  feishu: '飞书',
  iap: 'IAP',
  link: '链接',
  'max-ad': 'Max 广告',
  'max-user': 'Max 用户',
  online: '在线',
  postback_log: '回传日志',
  qintv: 'QinTV',
  qtv: 'QTV',
  reader: '阅读',
  res: '资源',
};

function schemaObject(schema: unknown): TaskPayloadSchema {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return {};
  }
  return schema as TaskPayloadSchema;
}

function propertyType(schema: TaskPayloadPropertySchema): string | undefined {
  const type = schema.type;
  if (Array.isArray(type)) {
    return type.find((item) => item !== 'null') ?? type[0];
  }
  return type;
}

function fieldComponent(
  schema: TaskPayloadPropertySchema,
): PayloadFieldComponent {
  if (
    schema.enum?.length ||
    schema.const !== undefined ||
    schema.x_options?.length ||
    schema.x_options_source
  ) {
    return 'select';
  }
  const type = propertyType(schema);
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'array' || type === 'object') return 'textarea';
  return 'text';
}

function optionLabel(value: TaskPayloadPrimitive): string {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (value === null) return '空';
  const key = String(value);
  return VALUE_LABELS[key] ?? key;
}

function primitiveOptionValue(value: unknown): TaskPayloadPrimitive {
  if (
    value === null ||
    ['boolean', 'number', 'string'].includes(typeof value)
  ) {
    return value as TaskPayloadPrimitive;
  }
  return JSON.stringify(value);
}

function fieldLabel(name: string, schema: TaskPayloadPropertySchema): string {
  return schema.title || FIELD_LABELS[name] || name;
}

function selectValue(value: TaskPayloadPrimitive): TaskPayloadSelectValue {
  return typeof value === 'boolean' ? String(value) : value;
}

function fieldOptions(
  schema: TaskPayloadPropertySchema,
): PayloadSelectOption[] | undefined {
  if (schema.x_options?.length) {
    return schema.x_options.map((option) => ({
      disabled: option.disabled,
      help_msg: option.help_msg,
      label: option.label,
      value: selectValue(primitiveOptionValue(option.value)),
    }));
  }
  const values = schema.const === undefined ? schema.enum : [schema.const];
  return values?.map((value) => ({
    label: optionLabel(primitiveOptionValue(value)),
    value: selectValue(primitiveOptionValue(value)),
  }));
}

export function payloadFieldsFromExecutor(
  executor?: Pick<TaskExecutor, 'payload_schema'>,
): PayloadFormField[] {
  const schema = schemaObject(executor?.payload_schema);
  const properties = schema.properties ?? {};
  const required = new Set(schema.required);
  return Object.entries(properties).map(([name, property]) => ({
    component: fieldComponent(property),
    help: property.help_msg || property.description,
    label: fieldLabel(name, property),
    maximum: property.maximum,
    minimum: property.minimum,
    name,
    options: fieldOptions(property),
    required: required.has(name),
    schema: property,
  }));
}

function hasOwnRecordValue(record: PayloadFormValues, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, name);
}

function optionValueMatches(
  option: PayloadSelectOption,
  value: unknown,
): boolean {
  return option.value === value;
}

function canReusePayloadValue(
  field: PayloadFormField,
  source: PayloadFormValues,
): boolean {
  if (!hasOwnRecordValue(source, field.name)) return false;
  if (!field.options?.length) return true;
  return field.options.some((option) =>
    optionValueMatches(option, source[field.name]),
  );
}

function displayPayloadValue(field: PayloadFormField, value: unknown): unknown {
  if (
    field.component === 'textarea' &&
    value !== null &&
    typeof value === 'object'
  ) {
    return JSON.stringify(value, null, 2);
  }
  return value;
}

function defaultValue(field: PayloadFormField): unknown {
  if (field.schema.const !== undefined) {
    return selectValue(primitiveOptionValue(field.schema.const));
  }
  if (field.options?.length) return field.options[0]?.value;
  if (field.component === 'boolean') return false;
  return field.required ? '' : undefined;
}

export function initialPayloadFormValues(
  fields: PayloadFormField[],
  payload: unknown,
): PayloadFormValues {
  const source =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as PayloadFormValues)
      : {};
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      canReusePayloadValue(field, source)
        ? displayPayloadValue(field, source[field.name])
        : defaultValue(field),
    ]),
  );
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function parseComplexField(field: PayloadFormField, value: unknown) {
  if (field.component !== 'textarea' || isBlank(value)) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${field.label} 不是有效 JSON`);
  }
}

function normalizeFieldValue(field: PayloadFormField, value: unknown): unknown {
  const parsed = parseComplexField(field, value);
  if (isBlank(parsed)) return undefined;
  const type = propertyType(field.schema);
  if (field.component === 'select' && type === 'boolean') {
    return parsed === true || parsed === 'true';
  }
  if (
    field.component === 'number' ||
    (field.component === 'select' && (type === 'integer' || type === 'number'))
  ) {
    const numberValue = Number(parsed);
    if (!Number.isFinite(numberValue)) {
      throw new TypeError(`${field.label} 必须是数字`);
    }
    return type === 'integer' ? Math.trunc(numberValue) : numberValue;
  }
  if (field.component === 'boolean') return Boolean(parsed);
  return typeof parsed === 'string' ? parsed.trim() : parsed;
}

export function buildPayloadFromFormValues(
  fields: PayloadFormField[],
  values: PayloadFormValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = normalizeFieldValue(field, values[field.name]);
    if (value === undefined && !field.required) continue;
    payload[field.name] = value;
  }
  return payload;
}

export function validatePayloadFormValues(
  fields: PayloadFormField[],
  values: PayloadFormValues,
): string | undefined {
  for (const field of fields) {
    const value = values[field.name];
    if (field.required && isBlank(value)) {
      return `请填写 ${field.label}`;
    }
    if (!isBlank(value) && field.component === 'number') {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) return `${field.label} 必须是数字`;
      if (field.minimum !== undefined && numberValue < field.minimum) {
        return `${field.label} 不能小于 ${field.minimum}`;
      }
      if (field.maximum !== undefined && numberValue > field.maximum) {
        return `${field.label} 不能大于 ${field.maximum}`;
      }
    }
    if (
      !isBlank(value) &&
      typeof value === 'string' &&
      field.schema.minLength !== undefined &&
      value.trim().length < field.schema.minLength
    ) {
      return `${field.label} 至少 ${field.schema.minLength} 个字符`;
    }
    if (!isBlank(value) && field.component === 'textarea') {
      try {
        parseComplexField(field, value);
      } catch (error) {
        return error instanceof Error ? error.message : `${field.label} 无效`;
      }
    }
  }
  return undefined;
}

export function suggestedBizKey(
  executorCode: string,
  payload: Record<string, unknown>,
): string | undefined {
  const positiveId = (name: string) => {
    const value = Number(payload[name]);
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
  };
  const text = (name: string) => String(payload[name] ?? '').trim();
  if (
    executorCode === 'auth.org_sync.dingtalk' ||
    executorCode === 'auth.org_sync.feishu'
  ) {
    const sourceId = text('source_id');
    if (sourceId) return `${executorCode}:${sourceId}`;
  }
  if (executorCode === 'auth.weekly_report.publish_dingtalk') {
    const deptId = positiveId('dept_id');
    const knowledgeTargetId = positiveId('knowledge_target_id');
    const channelId = positiveId('channel_id');
    const reportDate = text('report_date');
    const weekNo = positiveId('week_no');
    if (deptId && knowledgeTargetId && channelId && reportDate && weekNo) {
      return `weekly_report:dingtalk:${deptId}:${reportDate}:${weekNo}:${knowledgeTargetId}:${channelId}`;
    }
  }
  if (executorCode === 'article.publish') {
    const releaseId = positiveId('release_id');
    if (releaseId) return `release:${releaseId}`;
  }
  if (
    executorCode === 'res.submission.package' ||
    executorCode === 'wmxt.submission.package'
  ) {
    const submissionId = positiveId('submission_id');
    if (submissionId) return `submission:${submissionId}`;
  }
  if (
    executorCode === 'asset_pay_order_refund' ||
    executorCode === 'asset_pay_order_recovery' ||
    executorCode === 'res_payment_refund'
  ) {
    const orderId = positiveId('order_id');
    if (orderId) return `order:${orderId}`;
  }
  if (
    executorCode === 'res_content_export' ||
    executorCode === 'res_translation'
  ) {
    const contentId = positiveId('content_id');
    if (contentId) return `content:${contentId}`;
  }
  if (executorCode === 'res_content_import') {
    const provider = text('provider');
    const externalId = text('external_id');
    const fileId = positiveId('file_id');
    if (provider && externalId) return `${provider}:${externalId}`;
    if (fileId) return `file:${fileId}`;
  }
  if (executorCode === 'res_upstream_sync') {
    const provider = text('provider');
    const scope = text('scope') || 'all';
    if (provider) return `${provider}:${scope}`;
  }
  if (executorCode === 'res_push_dispatch') {
    const campaignId = positiveId('campaign_id');
    const channelId = positiveId('channel_id');
    if (campaignId && channelId)
      return `campaign:${campaignId}:channel:${channelId}`;
  }
  if (executorCode === 'res_stat_rollup') {
    const kind = text('stat_kind');
    const day = text('stat_day');
    if (kind && day) return `${kind}:${day}`;
  }
  if (executorCode === 'res_postback_replay') {
    const logId = positiveId('log_id');
    const eventId = positiveId('event_id');
    if (logId) return `log:${logId}`;
    if (eventId) return `event:${eventId}`;
  }
  if (executorCode === 'res_search_reindex') {
    const scope = text('scope');
    if (scope) return `search:${scope}`;
  }
  if (executorCode === 'res_legacy_import') {
    const source = text('source_code');
    const table = text('table');
    if (source && table) return `${source}:${table}`;
  }
  return undefined;
}
