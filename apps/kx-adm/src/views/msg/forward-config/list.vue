<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ForwardConfigApplyRequest,
  ForwardConfigDeviceView,
  ForwardConfigOptions,
  ForwardConfigPreviewItem,
  HttpPostWrite,
  RecordUrlMode,
} from '#/api/msg';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Copy, Eye, MessageSquareCode, RotateCw, Settings } from '@vben/icons';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  InputPassword,
  message,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TextArea,
  Tooltip,
  TypographyParagraph,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ForwardConfigApi } from '#/api/msg';
import { JsonEditor } from '#/components/codemirror';
import { StatusTag } from '#/components/management';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortArray } from '#/vxe-sort';

import {
  previewColumns,
  recordModeOptions,
  useDeviceColumns,
  useFormSchema,
} from './data';
import PopupDrawer from './modules/popup-drawer.vue';
import PopupModal from './modules/popup-modal.vue';

interface CheckboxGrid {
  getCheckboxRecords: () => ForwardConfigDeviceView[];
}

interface RobotChannelForm {
  clear_url: boolean;
  enabled: boolean;
  keywords: string;
  mode: string;
  touched: boolean;
  url: string;
}

interface ForwardForm {
  body_touched: boolean;
  http_post: HttpPostWrite[];
  http_post_touched: boolean;
  record_url_mode: RecordUrlMode;
  record_url_value: string;
  robot_body: string;
  tts_touched: boolean;
  tts_txt: string;
}

const route = useRoute();
const actionLoading = ref('');
const detailLoading = ref(false);
const previewLoading = ref(false);
const applyLoading = ref(false);
const detailOpen = ref(false);
const previewOpen = ref(false);
const selectedDevice = ref<ForwardConfigDeviceView | null>(null);
const sourceEventId = ref<null | number>(null);
const sourceReceivedAt = ref<null | number>(null);
const rawConfig = ref<Record<string, unknown>>({});
const previewItems = ref<ForwardConfigPreviewItem[]>([]);
const options = ref<ForwardConfigOptions>({
  content_types: ['application/json', 'application/x-www-form-urlencoded'],
  modes: ['无限制', '黑名单', '白名单'],
  placeholders: [],
});

const forwardConfigSortFields = [
  'device_code',
  'last_apply_at',
  'last_seen_at',
  'online_state',
  'snapshot_received_at',
  'software_version',
];

const channelSlots = ['1', '2', '3', '4'] as const;
type RobotChannelSlot = (typeof channelSlots)[number];

const robotChannels = reactive<Record<RobotChannelSlot, RobotChannelForm>>({
  '1': defaultChannel(),
  '2': defaultChannel(),
  '3': defaultChannel(),
  '4': defaultChannel(),
});

const form = reactive<ForwardForm>({
  body_touched: false,
  http_post: [],
  http_post_touched: false,
  record_url_mode: 'keep',
  record_url_value: '',
  robot_body: '',
  tts_txt: '',
  tts_touched: false,
});

const selectedCount = computed(() => checkedRows().length);
const previewReady = computed(
  () => previewItems.value.filter((item) => item.status === 'ready').length,
);
const previewBlocked = computed(
  () => previewItems.value.filter((item) => item.status !== 'ready').length,
);

const modeOptions = computed(() =>
  options.value.modes.map((value) => ({ label: value || '空值', value })),
);
const channelForms = computed(() =>
  channelSlots.map((slot) => ({ channel: robotChannels[slot], slot })),
);

const [Grid, gridApi] = useVbenVxeGrid<ForwardConfigDeviceView>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    checkboxConfig: { reserve: true },
    columns: useDeviceColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100, 200] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await ForwardConfigApi.query({
            device_code_prefix:
              String(formValues.device_code_prefix ?? '').trim() || undefined,
            has_snapshot: formValues.has_snapshot as boolean | undefined,
            last_apply_status:
              String(formValues.last_apply_status ?? '') || undefined,
            online_state: String(formValues.online_state ?? '') || undefined,
            page: page.currentPage,
            size: page.pageSize,
            software_version:
              String(formValues.software_version ?? '').trim() || undefined,
            sort: vxeSortArray(params, forwardConfigSortFields),
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'device_code' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ForwardConfigDeviceView>,
});

function defaultChannel(): RobotChannelForm {
  return {
    clear_url: false,
    enabled: false,
    keywords: '',
    mode: '无限制',
    touched: false,
    url: '',
  };
}

function checkedRows() {
  const grid = gridApi.grid as unknown as Partial<CheckboxGrid> | undefined;
  return typeof grid?.getCheckboxRecords === 'function'
    ? grid.getCheckboxRecords()
    : [];
}

function targetDeviceCodes() {
  return checkedRows().map((row) => row.device_code);
}

function statusColor(status: string) {
  if (status === 'published' || status === 'ready') return 'success';
  if (status === 'failed' || status === 'blocked') return 'error';
  if (status === 'skipped') return 'warning';
  return 'processing';
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function resetForm() {
  channelSlots.forEach((slot) => {
    Object.assign(robotChannels[slot], defaultChannel());
  });
  Object.assign(form, {
    body_touched: false,
    http_post: [],
    http_post_touched: false,
    record_url_mode: 'keep',
    record_url_value: '',
    robot_body: '',
    tts_txt: '',
    tts_touched: false,
  });
  rawConfig.value = {};
  sourceEventId.value = null;
  sourceReceivedAt.value = null;
}

function fillForm(config: Record<string, unknown>) {
  resetForm();
  rawConfig.value = config;
  const robot = readObject(config.robot);
  const urls = readObject(robot.url);
  channelSlots.forEach((slot) => {
    const channel = readObject(urls[slot]);
    const url = readString(channel.url);
    Object.assign(robotChannels[slot], {
      clear_url: false,
      enabled: Boolean(url),
      keywords: readString(channel.keywords),
      mode: readString(channel.mode) || '无限制',
      touched: false,
      url,
    });
  });
  form.robot_body = readString(robot.body);
  form.tts_txt = readString(config.tts_txt);
  form.record_url_value = readString(config.record_url);
  const posts = Array.isArray(config.http_post) ? config.http_post : [];
  form.http_post = posts.map((item) => normalizeHttpPost(readObject(item)));
}

function normalizeHttpPost(item: Record<string, unknown>): HttpPostWrite {
  const headers = Array.isArray(item.headers)
    ? item.headers.map((header) => {
        const object = readObject(header);
        return {
          key: readString(object.key),
          value: readString(object.value),
        };
      })
    : [];
  const body = readObject(item.body);
  return {
    body,
    headers: headers.slice(0, 3),
    keywords: readString(item.keywords),
    mode: readString(item.mode) || '无限制',
    url: readString(item.url),
  };
}

function markChannel(slot: RobotChannelSlot) {
  robotChannels[slot].touched = true;
}

function markHttpPostTouched() {
  form.http_post_touched = true;
}

function addHttpPost() {
  form.http_post.push({
    body: { 内容: '{{内容}}', 设备编号: '{{设备编号}}' },
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    keywords: '',
    mode: '无限制',
    url: '',
  });
  markHttpPostTouched();
}

function removeHttpPost(index: number) {
  form.http_post.splice(index, 1);
  markHttpPostTouched();
}

function addHeader(post: HttpPostWrite) {
  if (post.headers.length >= 3) {
    message.warning('每个 HTTP POST 最多 3 组请求头');
    return;
  }
  post.headers.push({ key: '', value: '' });
  markHttpPostTouched();
}

function removeHeader(post: HttpPostWrite, index: number) {
  post.headers.splice(index, 1);
  markHttpPostTouched();
}

function insertPlaceholder(value: string) {
  form.robot_body += value;
  form.body_touched = true;
}

async function copyText(label: string, value: unknown) {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  await navigator.clipboard.writeText(text ?? '');
  message.success(`${label}已复制`);
}

async function openDetail(row: ForwardConfigDeviceView) {
  selectedDevice.value = row;
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const detail = await ForwardConfigApi.detail(row.device_code);
    sourceEventId.value = detail.source_event_id;
    sourceReceivedAt.value = detail.source_received_at;
    fillForm(detail.config);
  } finally {
    detailLoading.value = false;
  }
}

function openBatchEditor() {
  selectedDevice.value = null;
  resetForm();
  detailOpen.value = true;
}

async function refreshForwardConfig(onlySelected = true) {
  const codes = onlySelected ? targetDeviceCodes() : [];
  if (onlySelected && codes.length === 0) {
    message.warning('请先勾选设备，或使用刷新全部');
    return;
  }
  actionLoading.value = onlySelected ? 'refresh-selected' : 'refresh-all';
  try {
    await ForwardConfigApi.refresh({ device_codes: codes, online_only: true });
    message.success('转发配置刷新后台任务已提交');
    await gridApi.query();
  } finally {
    actionLoading.value = '';
  }
}

function buildApplyRequest(): ForwardConfigApplyRequest | undefined {
  const patch: ForwardConfigApplyRequest['patch'] = {};
  const robotUrl: NonNullable<NonNullable<typeof patch.robot>['url']> = {};
  channelSlots.forEach((slot) => {
    const channel = robotChannels[slot];
    if (!channel.touched) return;
    robotUrl[slot] = {
      clear_url: channel.clear_url || !channel.enabled,
      keywords: channel.keywords.trim(),
      mode: channel.mode,
    };
    const url = channel.url.trim();
    if (channel.enabled && url && !url.includes('******')) {
      robotUrl[slot].url = url;
    }
  });
  if (form.body_touched || Object.keys(robotUrl).length > 0) {
    patch.robot = {};
    if (form.body_touched) patch.robot.body = form.robot_body;
    if (Object.keys(robotUrl).length > 0) patch.robot.url = robotUrl;
  }
  if (form.tts_touched) patch.tts_txt = form.tts_txt;
  if (form.record_url_mode !== 'keep') {
    patch.record_url = {
      mode: form.record_url_mode,
      value: form.record_url_value.trim(),
    };
  }
  if (form.http_post_touched) patch.http_post = form.http_post;
  if (Object.keys(patch).length === 0) {
    message.warning('请至少修改一个字段后再预览或下发');
    return undefined;
  }
  const codes = selectedDevice.value
    ? [selectedDevice.value.device_code]
    : targetDeviceCodes();
  if (codes.length === 0) {
    message.warning(
      '批量模式请先勾选设备；需要全部设备时请先筛选并勾选本页目标设备',
    );
    return undefined;
  }
  return {
    conflict_policy: 'reject_if_changed',
    device_codes: codes,
    online_only: true,
    patch,
    source_event_id: selectedDevice.value ? sourceEventId.value : undefined,
  };
}

async function previewChanges() {
  const req = buildApplyRequest();
  if (!req) return;
  previewLoading.value = true;
  try {
    const result = await ForwardConfigApi.preview(req);
    previewItems.value = result.items;
    previewOpen.value = true;
  } finally {
    previewLoading.value = false;
  }
}

async function applyChanges() {
  const req = buildApplyRequest();
  if (!req) return;
  applyLoading.value = true;
  try {
    await ForwardConfigApi.apply(req);
    message.success('转发配置下发后台任务已提交');
    detailOpen.value = false;
    previewOpen.value = false;
    await gridApi.query();
  } finally {
    applyLoading.value = false;
  }
}

function formatPreviewPayload(item: ForwardConfigPreviewItem) {
  return item.redacted_payload
    ? JSON.stringify(item.redacted_payload, null, 2)
    : displayValue(item.message);
}

async function loadInitialData() {
  const deviceCode = Array.isArray(route.query.device_code)
    ? route.query.device_code[0]
    : route.query.device_code;
  await gridApi.formApi.setValues({ device_code_prefix: deviceCode });
  try {
    const opt = await ForwardConfigApi.options();
    options.value = opt;
    await gridApi.query();
  } catch (error) {
    // 首屏数据异常不能阻断路由导航，页面仍应允许用户刷新或查看筛选区。
    console.error('加载转发配置失败', error);
    message.error('转发配置加载失败，请稍后重试');
  }
}

onMounted(loadInitialData);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>转发配置</h1>
        <p>按最新设备快照批量刷新、预览并下发 S2 消息转发配置</p>
      </div>
      <Space wrap>
        <Button @click="openBatchEditor">
          <template #icon><Settings /></template>批量编辑
        </Button>
        <Button
          v-access:code="'msg_forward_config:refresh'"
          :loading="actionLoading === 'refresh-selected'"
          @click="refreshForwardConfig(true)"
        >
          刷新选中
        </Button>
        <Button
          v-access:code="'msg_forward_config:refresh'"
          :loading="actionLoading === 'refresh-all'"
          @click="refreshForwardConfig(false)"
        >
          <template #icon><RotateCw /></template>刷新全部
        </Button>
      </Space>
    </header>

    <Grid class="management-grid" table-title="转发设备">
      <template #deviceCode="{ row }">
        <Button class="cell-edit-button" type="link" @click="openDetail(row)">
          {{ row.device_code }}
        </Button>
      </template>
      <template #onlineState="{ row }">
        <StatusTag :status="row.online_state" />
      </template>
      <template #deviceValue="{ row }">
        {{ displayValue(row.software_version) }}
      </template>
      <template #lastSeenAt="{ row }">
        {{ Times.formatUnix(row.last_seen_at) }}
      </template>
      <template #snapshotReady="{ row }">
        <Tag :color="row.snapshot_ready ? 'success' : 'warning'">
          {{ row.snapshot_ready ? '已获取' : '待刷新' }}
        </Tag>
      </template>
      <template #snapshotAt="{ row }">
        {{ Times.formatUnix(row.snapshot_received_at ?? 0) }}
      </template>
      <template #applyStatus="{ row }">
        <Tag
          v-if="row.last_apply_status"
          :color="statusColor(row.last_apply_status)"
        >
          {{ row.last_apply_status }}
        </Tag>
        <span v-else class="muted">未下发</span>
      </template>
      <template #applyAt="{ row }">
        {{ Times.formatUnix(row.last_apply_at ?? 0) }}
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Tooltip title="编辑">
            <Button size="small" type="link" @click="openDetail(row)">
              <template #icon><Eye /></template>
            </Button>
          </Tooltip>
          <Tooltip title="刷新转发配置">
            <Button
              v-access:code="'msg_forward_config:refresh'"
              size="small"
              type="link"
              @click="
                ForwardConfigApi.refresh({
                  device_codes: [row.device_code],
                  online_only: true,
                }).then(() => message.success('刷新指令已提交'))
              "
            >
              <template #icon><RotateCw /></template>
            </Button>
          </Tooltip>
        </Space>
      </template>
    </Grid>

    <PopupDrawer
      v-model:open="detailOpen"
      :loading="detailLoading"
      size="min(1120px, 100vw)"
      :title="
        selectedDevice
          ? `转发配置：${selectedDevice.device_code}`
          : `批量转发配置（已选 ${selectedCount} 台）`
      "
    >
      <template v-if="!detailLoading">
        <Descriptions
          v-if="selectedDevice"
          :column="{ xs: 1, sm: 3 }"
          bordered
          size="small"
        >
          <DescriptionsItem label="设备编号">
            {{ selectedDevice.device_code }}
          </DescriptionsItem>
          <DescriptionsItem label="快照事件">
            {{ sourceEventId ?? '无' }}
          </DescriptionsItem>
          <DescriptionsItem label="快照时间">
            {{ Times.formatUnix(sourceReceivedAt ?? 0) }}
          </DescriptionsItem>
        </Descriptions>

        <section class="drawer-section">
          <div class="section-heading">
            <h2>机器人转发</h2>
            <Space wrap>
              <Select
                class="placeholder-select"
                :options="options.placeholders"
                placeholder="插入占位符"
                @select="(value) => insertPlaceholder(String(value))"
              />
              <Button @click="copyText('当前脱敏配置', rawConfig)">
                <template #icon><Copy /></template>复制 JSON
              </Button>
            </Space>
          </div>
          <div class="robot-grid">
            <div
              v-for="item in channelForms"
              :key="item.slot"
              class="robot-card"
            >
              <div class="robot-card-title">
                <strong>通道 {{ item.slot }}</strong>
                <Switch
                  v-model:checked="item.channel.enabled"
                  checked-children="启用"
                  un-checked-children="停用"
                  @change="markChannel(item.slot)"
                />
              </div>
              <Form layout="vertical">
                <FormItem label="机器人 URL">
                  <InputPassword
                    v-model:value="item.channel.url"
                    autocomplete="new-password"
                    placeholder="留空保留；停用会清空"
                    @change="markChannel(item.slot)"
                  />
                </FormItem>
                <FormItem label="转发模式">
                  <Select
                    v-model:value="item.channel.mode"
                    :options="modeOptions"
                    @change="markChannel(item.slot)"
                  />
                </FormItem>
                <FormItem label="关键词（多个用 - 分隔）">
                  <Input
                    v-model:value="item.channel.keywords"
                    @change="markChannel(item.slot)"
                  />
                </FormItem>
              </Form>
            </div>
          </div>
          <Form layout="vertical">
            <FormItem label="机器人消息模板">
              <TextArea
                v-model:value="form.robot_body"
                :rows="6"
                @change="form.body_touched = true"
              />
            </FormItem>
          </Form>
        </section>

        <section class="drawer-section">
          <h2>接听与录音上传</h2>
          <Form layout="vertical">
            <FormItem label="TTS 文本">
              <TextArea
                v-model:value="form.tts_txt"
                :rows="3"
                placeholder="接通播放文本，可为空"
                @change="form.tts_touched = true"
              />
            </FormItem>
            <div class="form-grid">
              <FormItem label="录音推送 URL 处理方式">
                <Select
                  v-model:value="form.record_url_mode"
                  :options="recordModeOptions"
                />
              </FormItem>
              <FormItem label="录音推送 URL">
                <InputPassword
                  v-model:value="form.record_url_value"
                  :disabled="form.record_url_mode !== 'manual'"
                  autocomplete="new-password"
                  placeholder="手工填写时使用完整 http/https URL"
                />
              </FormItem>
            </div>
          </Form>
        </section>

        <section class="drawer-section">
          <div class="section-heading">
            <h2>HTTP POST 转发</h2>
            <Space>
              <Switch
                v-model:checked="form.http_post_touched"
                checked-children="修改"
                un-checked-children="保留"
              />
              <Button :disabled="!form.http_post_touched" @click="addHttpPost">
                新增 HTTP POST
              </Button>
            </Space>
          </div>
          <p class="muted">
            未打开“修改”时保留每台设备原 HTTP POST 配置；打开后会整体替换
            http_post，包含 token 的 URL/header 需要重新输入完整值。
          </p>
          <div v-if="form.http_post_touched" class="http-post-list">
            <div
              v-for="(post, index) in form.http_post"
              :key="index"
              class="http-post-card"
            >
              <div class="section-heading">
                <strong>HTTP POST {{ index + 1 }}</strong>
                <Button danger size="small" @click="removeHttpPost(index)">
                  删除
                </Button>
              </div>
              <Form layout="vertical">
                <div class="form-grid">
                  <FormItem label="URL">
                    <Input
                      v-model:value="post.url"
                      placeholder="https://example.com/webhook"
                      @change="markHttpPostTouched"
                    />
                  </FormItem>
                  <FormItem label="转发模式">
                    <Select
                      v-model:value="post.mode"
                      :options="modeOptions"
                      @change="markHttpPostTouched"
                    />
                  </FormItem>
                </div>
                <FormItem label="关键词（多个用 - 分隔）">
                  <Input
                    v-model:value="post.keywords"
                    @change="markHttpPostTouched"
                  />
                </FormItem>
                <FormItem label="请求头（最多 3 组）">
                  <div class="header-list">
                    <Space
                      v-for="(header, headerIndex) in post.headers"
                      :key="headerIndex"
                      class="header-row"
                    >
                      <Input
                        v-model:value="header.key"
                        placeholder="Header Key"
                        @change="markHttpPostTouched"
                      />
                      <InputPassword
                        v-model:value="header.value"
                        autocomplete="new-password"
                        placeholder="Header Value"
                        @change="markHttpPostTouched"
                      />
                      <Button
                        size="small"
                        @click="removeHeader(post, headerIndex)"
                      >
                        删除
                      </Button>
                    </Space>
                    <Button size="small" @click="addHeader(post)">
                      新增请求头
                    </Button>
                  </div>
                </FormItem>
                <FormItem label="Body JSON">
                  <JsonEditor
                    v-model="post.body"
                    max-height="360px"
                    min-height="220px"
                    @valid-change="markHttpPostTouched"
                  />
                </FormItem>
              </Form>
            </div>
          </div>
        </section>

        <div class="drawer-footer-actions">
          <Space>
            <Button
              v-access:code="'msg_forward_config:preview'"
              :loading="previewLoading"
              @click="previewChanges"
            >
              <template #icon><Eye /></template>预览变更
            </Button>
            <Button
              v-access:code="'msg_forward_config:apply'"
              :loading="applyLoading"
              type="primary"
              @click="applyChanges"
            >
              <template #icon><MessageSquareCode /></template>下发配置
            </Button>
          </Space>
        </div>
      </template>
    </PopupDrawer>

    <PopupModal
      v-model:open="previewOpen"
      :confirm-loading="applyLoading"
      title="转发配置变更预览"
      width="min(1080px, 96vw)"
      @ok="applyChanges"
    >
      <div class="preview-summary">
        共 {{ previewItems.length }} 台，可下发 {{ previewReady }} 台，阻塞
        {{ previewBlocked }} 台。
      </div>
      <Table
        :columns="previewColumns"
        :data-source="previewItems"
        :pagination="{ pageSize: 8 }"
        row-key="device_code"
        :scroll="{ x: 830 }"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <Tag
            v-if="column.key === 'status'"
            :color="statusColor(record.status)"
          >
            {{ record.status }}
          </Tag>
          <span v-else-if="column.key === 'diff_summary'">
            {{ record.diff_summary.join(', ') || '无' }}
          </span>
        </template>
        <template #expandedRowRender="{ record }">
          <TypographyParagraph class="operation-payload">
            {{ formatPreviewPayload(record) }}
          </TypographyParagraph>
        </template>
      </Table>
    </PopupModal>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.management-grid {
  flex: 1;
  min-height: 0;
}

.page-heading,
.filter-bar {
  flex: 0 0 auto;
}

.page-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}

.page-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.filter-bar {
  display: grid;
  grid-template-columns: 1.1fr 0.8fr 1fr 0.8fr 0.8fr auto;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.input-icon {
  width: 16px;
  color: hsl(var(--muted-foreground));
}

.cell-edit-button {
  height: auto;
  padding: 0;
}

.drawer-section {
  margin-top: 20px;
}

.drawer-section h2,
.section-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
}

.section-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.placeholder-select {
  width: 220px;
}

.robot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.robot-card,
.http-post-card {
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.robot-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.header-list,
.http-post-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;
  width: 100%;
}

.drawer-footer-actions {
  position: sticky;
  bottom: 0;
  padding: 12px 0 0;
  margin-top: 20px;
  text-align: right;
  background: hsl(var(--background));
}

.preview-summary {
  margin-bottom: 12px;
}

.operation-payload {
  min-height: 44px;
  padding: 12px;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 4px;
}

.muted {
  color: hsl(var(--muted-foreground));
}

@media (max-width: 980px) {
  .filter-bar,
  .form-grid,
  .robot-grid {
    grid-template-columns: 1fr;
  }

  .page-heading,
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
