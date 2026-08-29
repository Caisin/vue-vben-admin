<script lang="ts" setup>
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type {
  LinkPayAnalysisRow,
  LinkPrefixConfig,
  PayTemplate,
  PayTemplateDetail,
  ResLink,
  ResLinkSave,
  SelectOptionSource,
} from '#/api/res/seas/global/link';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Tag,
  TextArea,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getAnalysisList,
  getChapterOptions,
  getFbAcctOptions,
  getFbPixelOptions,
  getLinkPrefixConfig,
  getList,
  getPayTemplateDetail,
  getPayTemplateList,
  getResourceOptions,
  postDel,
  postSave,
} from '#/api/res/seas/global/link';

const userStore = useUserStore();

const loading = ref(false);
const saving = ref(false);
const optionLoading = ref(false);
const prefixLoading = ref(false);
const rows = ref<ResLink[]>([]);
const total = ref(0);
const pagination = reactive({ current: 1, pageSize: 20 });

const query = reactive({
  id: undefined as number | string | undefined,
  is_del: 0,
  name: '',
  res_id: undefined as number | string | undefined,
  uid: undefined as number | string | undefined,
});

const editorOpen = ref(false);
const detailOpen = ref(false);
const previewOpen = ref(false);
const analysisOpen = ref(false);
const payOpen = ref(false);
const selectedRecord = ref<null | ResLink>(null);
const previewUrl = ref('');

const resources = ref<SelectOptionSource[]>([]);
const chapters = ref<SelectOptionSource[]>([]);
const pixels = ref<SelectOptionSource[]>([]);
const fbAccounts = ref<SelectOptionSource[]>([]);
const payTemplates = ref<PayTemplate[]>([]);
const payTemplateDetails = reactive<Record<string, PayTemplateDetail>>({});
const analysisRows = ref<LinkPayAnalysisRow[]>([]);
const analysisLoading = ref(false);
const analysisDay = ref('');

const prefixes = reactive<LinkPrefixConfig>({
  app_jump_link: '',
  deep_link_prefix: '',
  deep_link_prefix_2: '',
  h5_promotion_link: '',
  w2a_link: '',
});

const form = reactive<ResLinkSave>({
  bx_type: 'iap',
  cover: '',
  ext_info: {},
  fb_acct: '',
  fb_pixel_id: '',
  item_id: '',
  link: '',
  media_type: 0,
  name: '',
  post_tmp_id: 0,
  remark: '',
  uid: currentUid(),
});

const payForm = reactive({
  pay_key: 'pay_tmp_id',
  pay_tmp_id: undefined as number | string | undefined,
});

function useColumns(): VxeTableGridColumns<ResLink> {
  return [
    {
      fixed: 'left',
      slots: { content: 'expanded' },
      type: 'expand',
      width: 44,
    },
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    { field: 'name', minWidth: 180, title: '名称' },
    {
      field: 'bx_type',
      slots: { default: 'bxType' },
      title: '变现类型',
      width: 110,
    },
    { field: 'uid', title: '创建人', width: 110 },
    { field: 'detail', slots: { default: 'detail' }, title: '明细', width: 80 },
    { field: 'res_name', minWidth: 180, title: '剧名' },
    { field: 'seq_no', slots: { default: 'seqNo' }, title: '章节', width: 90 },
    { field: 'remark', minWidth: 160, showOverflow: 'tooltip', title: '备注' },
    {
      field: 'create_time',
      slots: { default: 'createTime' },
      title: '时间',
      width: 180,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}

const vxeAnalysisColumns: VxeTableGridColumns<LinkPayAnalysisRow> = [
  { field: 'pay_amount', title: '充值项金额' },
  { field: 'pay_user_num', title: '充值人数' },
  { field: 'pay_num', title: '充值次数' },
  { field: 'total_amount', title: '充值金额' },
  { field: 'num_rate', slots: { default: 'numRate' }, title: '人数占比' },
  { field: 'amount_rate', slots: { default: 'amountRate' }, title: '金额占比' },
];

const [Grid, gridApi] = useVbenVxeGrid<ResLink>({
  gridEvents: {
    pageChange: ({
      currentPage,
      pageSize,
    }: {
      currentPage: number;
      pageSize: number;
    }) => {
      onTableChange({ current: currentPage, pageSize });
    },
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<ResLink>,
});

const [AnalysisGrid, analysisGridApi] = useVbenVxeGrid<LinkPayAnalysisRow>({
  gridOptions: {
    columns: vxeAnalysisColumns,
    height: 'auto',
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'pay_amount' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<LinkPayAnalysisRow>,
});

const payKeyOptions = [
  { label: '一充模板', value: 'pay_tmp_id' },
  { label: '二充模板', value: 'pay_tmp_id_2' },
  { label: '三充模板', value: 'pay_tmp_id_3' },
  { label: '四充模板', value: 'pay_tmp_id_4' },
  { label: '五充模板', value: 'pay_tmp_id_5' },
];

const bxTypeOptions = [
  { label: 'IAA', value: 'iaa' },
  { label: 'IAP', value: 'iap' },
];

const mediaTypeOptions = [
  { label: '封面', value: 0 },
  { label: '视频', value: 1 },
];

const totalPayUserNum = computed(() =>
  analysisRows.value.reduce(
    (sum, row) => sum + Number(row.pay_user_num ?? 0),
    0,
  ),
);
const totalPayAmount = computed(() =>
  analysisRows.value.reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0,
  ),
);

function currentUid() {
  const uid = Number(userStore.userInfo?.userId ?? 0);
  return Number.isFinite(uid) ? uid : 0;
}

function pageItems(payload: any): ResLink[] {
  return Array.isArray(payload) ? payload : (payload?.items ?? []);
}

function pageTotal(payload: any, items: unknown[]) {
  return Number(payload?.total ?? items.length);
}

function cleanQuery() {
  return Object.fromEntries(
    Object.entries({
      id: query.id,
      is_del: query.is_del,
      name: query.name?.trim(),
      page: pagination.current,
      size: pagination.pageSize,
      res_id: query.res_id,
      uid: query.uid,
    }).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}

async function load() {
  loading.value = true;
  try {
    const payload = await getList(cleanQuery());
    const items = pageItems(payload);
    rows.value = items;
    total.value = pageTotal(payload, items);
    await nextTick();
    gridApi.setGridOptions({
      pagerConfig: {
        currentPage: pagination.current,
        enabled: true,
        pageSize: pagination.pageSize,
        pageSizes: [10, 20, 50, 100],
        total: total.value,
      },
    });
    await gridApi.grid.reloadData(items);
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  optionLoading.value = true;
  try {
    const [res, pixel, acct, tmpl] = await Promise.allSettled([
      getResourceOptions({}),
      getFbPixelOptions(),
      getFbAcctOptions({}),
      getPayTemplateList({}),
    ]);
    if (res.status === 'fulfilled')
      resources.value = Array.isArray(res.value) ? res.value : [];
    if (pixel.status === 'fulfilled')
      pixels.value = Array.isArray(pixel.value) ? pixel.value : [];
    if (acct.status === 'fulfilled')
      fbAccounts.value = Array.isArray(acct.value) ? acct.value : [];
    if (tmpl.status === 'fulfilled')
      payTemplates.value = Array.isArray(tmpl.value) ? tmpl.value : [];
  } finally {
    optionLoading.value = false;
  }
}

async function loadPrefixes() {
  prefixLoading.value = true;
  try {
    Object.assign(prefixes, await getLinkPrefixConfig());
  } catch (error) {
    message.warning(
      '推广链接前缀参数读取失败，请检查 param 配置：h5_promotion_link / w2a_link / deep_link_prefix / deep_link_prefix_2 / app_jump_link',
    );
    throw error;
  } finally {
    prefixLoading.value = false;
  }
}

async function loadChapters(resId?: number | string) {
  chapters.value = [];
  if (!resId) return;
  chapters.value = await getChapterOptions(resId);
}

function resourceLabel(item: SelectOptionSource) {
  return String(item.res_name ?? item.name ?? item.title ?? item.id ?? '');
}

function chapterLabel(item: SelectOptionSource) {
  const seq = item.seq_no ?? item.name ?? item.id;
  const price = Number(item.price ?? 0) > 0 ? '付费' : '免费';
  return `第${seq}章 · ${price}`;
}

function optionValue(value: unknown): number | string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
}

function payTemplateLabel(item: PayTemplate) {
  return `${item.name ?? item.id}${item.remark ? ` · ${item.remark}` : ''}`;
}

function resetQuery() {
  Object.assign(query, {
    id: undefined,
    is_del: 0,
    name: '',
    res_id: undefined,
    uid: undefined,
  });
  pagination.current = 1;
  load();
}

function resetForm() {
  Object.assign(form, {
    bx_type: 'iap',
    cover: '',
    ext_info: {},
    fb_acct: '',
    fb_pixel_id: '',
    id: undefined,
    item_id: '',
    link: '',
    media_type: 0,
    name: '',
    post_tmp_id: 0,
    remark: '',
    uid: currentUid(),
  });
  form.res_id = undefined;
  chapters.value = [];
}

async function openEditor(record?: ResLink) {
  resetForm();
  if (record) {
    Object.assign(form, JSON.parse(JSON.stringify(record)), {
      ext_info: normalizeExtInfo(record.ext_info),
      uid: record.uid ?? currentUid(),
    });
    await loadChapters(record.res_id);
  }
  editorOpen.value = true;
}

function normalizeExtInfo(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value))
    : {};
}

function savePayload(
  source: ResLink | ResLinkSave,
  extInfo?: Record<string, unknown>,
) {
  return {
    bx_type: source.bx_type ?? '',
    cover: source.cover ?? '',
    ext_info: extInfo ?? normalizeExtInfo(source.ext_info),
    fb_acct: Number(source.fb_acct || 0),
    fb_pixel_id: source.fb_pixel_id ?? '',
    id: source.id,
    item_id: Number(source.item_id || 0),
    link: source.link ?? '',
    media_type: Number(source.media_type || 0),
    name: source.name ?? '',
    post_tmp_id: Number(source.post_tmp_id || 0),
    remark: source.remark ?? '',
    uid: Number(source.uid || currentUid()),
  };
}

async function submit() {
  if (!form.name?.trim()) {
    message.warning('请填写名称');
    return;
  }
  if (!form.uid) {
    message.warning('当前用户 ID 缺失，无法保存推广链接');
    return;
  }
  if (!form.res_id || !form.item_id) {
    message.warning('请选择资源和章节');
    return;
  }
  saving.value = true;
  try {
    await postSave(savePayload(form));
    editorOpen.value = false;
    message.success('保存成功');
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(record: ResLink) {
  await postDel([record.id]);
  message.success('删除成功');
  await load();
}

function openDetail(record: ResLink) {
  selectedRecord.value = record;
  detailOpen.value = true;
}

function openPreview(url: string) {
  if (!url) {
    message.warning('链接为空，无法预览');
    return;
  }
  previewUrl.value = url;
  previewOpen.value = true;
}

async function openAnalysis(record: ResLink) {
  selectedRecord.value = record;
  analysisRows.value = [];
  analysisDay.value = '';
  analysisOpen.value = true;
  await loadAnalysis();
}

async function loadAnalysis() {
  if (!selectedRecord.value) return;
  analysisLoading.value = true;
  try {
    analysisRows.value = await getAnalysisList(
      Object.fromEntries(
        Object.entries({
          link_id: selectedRecord.value.id,
          in_link_day: analysisDay.value.trim(),
        }).filter(([, value]) => value !== undefined && value !== ''),
      ),
    );
    await nextTick();
    await analysisGridApi.grid.reloadData(analysisRows.value);
  } finally {
    analysisLoading.value = false;
  }
}

async function openPay(record: ResLink) {
  selectedRecord.value = record;
  payForm.pay_key = 'pay_tmp_id';
  payForm.pay_tmp_id = undefined;
  Object.keys(payTemplateDetails).forEach((key) =>
    Reflect.deleteProperty(payTemplateDetails, key),
  );
  payOpen.value = true;
  await Promise.all(
    Object.values(normalizeExtInfo(record.ext_info))
      .filter(Boolean)
      .map((id) => loadPayDetail(id)),
  );
}

async function loadPayDetail(id: unknown) {
  const key = String(id);
  if (!key || payTemplateDetails[key]) return;
  try {
    payTemplateDetails[key] = await getPayTemplateDetail(key);
  } catch {
    payTemplateDetails[key] = {
      info: { id: key, name: `模板 ${key} 读取失败` },
      items: [],
    };
  }
}

async function savePayTemplate() {
  if (!selectedRecord.value || !payForm.pay_tmp_id) {
    message.warning('请选择充值模板');
    return;
  }
  const extInfo = normalizeExtInfo(selectedRecord.value.ext_info);
  extInfo[payForm.pay_key] = payForm.pay_tmp_id;
  await postSave(savePayload(selectedRecord.value, extInfo));
  message.success('收费模板已保存');
  selectedRecord.value.ext_info = extInfo;
  await loadPayDetail(payForm.pay_tmp_id);
  await load();
}

function removePayTemplate(key: string) {
  const record = selectedRecord.value;
  if (!record) return;
  const extInfo = normalizeExtInfo(record.ext_info);
  Reflect.deleteProperty(extInfo, key);
  postSave(savePayload(record, extInfo)).then(async () => {
    message.success('收费模板已删除');
    record.ext_info = extInfo;
    await load();
  });
}

function appendQuery(prefix: string, params: Record<string, unknown>) {
  if (!prefix) return '';
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = String(value);
    }
  }
  const queryString = new URLSearchParams(normalized).toString();
  if (!queryString) return prefix;
  let separator = '?';
  if (prefix.includes('?')) {
    separator = prefix.endsWith('?') || prefix.endsWith('&') ? '' : '&';
  }
  return `${prefix}${separator}${queryString}`;
}

function commonParams(row: ResLink) {
  return {
    cid: row.item_id,
    id: row.res_id,
    linkId: row.id,
    pixel_id: row.fb_pixel_id,
    type: 'fb',
  };
}

function promotionLink(row: ResLink) {
  return appendQuery(prefixes.h5_promotion_link, commonParams(row));
}

function w2aLink(row: ResLink) {
  return appendQuery(prefixes.w2a_link, commonParams(row));
}

function deepLink(row: ResLink) {
  return appendQuery(prefixes.deep_link_prefix, commonParams(row));
}

function deepLink2(row: ResLink) {
  return appendQuery(prefixes.deep_link_prefix_2, commonParams(row));
}

function fbLink(row: ResLink) {
  return appendQuery(prefixes.app_jump_link, {
    cid: row.item_id,
    fb_acct: row.fb_acct,
    id: row.res_id,
    linkId: row.id,
    type: 'fb_follow',
  });
}

async function copyText(text: string) {
  if (!text) {
    message.warning('链接为空，请先配置对应参数前缀');
    return;
  }
  await navigator.clipboard.writeText(text);
  message.success('已复制');
}

function formatTime(value: number | string | undefined) {
  if (!value) return '-';
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return new Date(numeric * 1000).toLocaleString();
  return String(value);
}

function rate(part: number | string | undefined, totalValue: number) {
  if (!totalValue) return '-';
  return `${Math.round((Number(part ?? 0) / totalValue) * 100)}%`;
}

function onTableChange(page: any) {
  pagination.current = page.current;
  pagination.pageSize = page.pageSize;
  load();
}

onMounted(async () => {
  await Promise.allSettled([loadOptions(), loadPrefixes()]);
  await load();
});
</script>

<template>
  <Page
    auto-content-height
    class="res-link-page"
    content-class="res-link-content"
    title="链接管理"
  >
    <Space direction="vertical" class="w-full" :size="16">
      <Card size="small">
        <div class="query-grid">
          <Input v-model:value="query.id" allow-clear placeholder="ID" />
          <Input
            v-model:value="query.name"
            allow-clear
            placeholder="名称"
            @press-enter="load"
          />
          <Input
            v-model:value="query.uid"
            allow-clear
            placeholder="创建人 UID"
          />
          <Select
            v-model:value="query.res_id"
            allow-clear
            show-search
            :filter-option="
              (input: string, option: any) =>
                String(option.label).toLowerCase().includes(input.toLowerCase())
            "
            :loading="optionLoading"
            :options="
              resources.map((item) => ({
                label: resourceLabel(item),
                value: optionValue(item.id),
              }))
            "
            placeholder="剧"
          />
          <Select
            v-model:value="query.is_del"
            :options="[
              { label: '未删除', value: 0 },
              { label: '已删除', value: 1 },
            ]"
            placeholder="状态"
          />
          <Space>
            <Button
              type="primary"
              @click="
                () => {
                  pagination.current = 1;
                  load();
                }
              "
            >
              <template #icon><IconifyIcon icon="lucide:search" /></template>
              查询
            </Button>
            <Button @click="resetQuery">重置</Button>
            <Button type="primary" @click="openEditor()">
              <template #icon><IconifyIcon icon="lucide:plus" /></template>
              新增
            </Button>
          </Space>
        </div>
      </Card>

      <Grid
        class="management-grid"
        :loading="loading || prefixLoading"
        table-title="链接管理"
      >
        <template #toolbar-tools>
          <Button type="primary" @click="openEditor()">
            <IconifyIcon icon="lucide:plus" />
            新增
          </Button>
        </template>
        <template #bxType="{ row }">
          <Tag :color="row.bx_type === 'iaa' ? 'green' : 'blue'">
            {{ row.bx_type || '-' }}
          </Tag>
        </template>
        <template #detail="{ row }">
          <Button size="small" type="link" @click="openAnalysis(row)">
            明细
          </Button>
        </template>
        <template #seqNo="{ row }">
          {{ row.seq_no ? `第${row.seq_no}章` : '-' }}
        </template>
        <template #createTime="{ row }">
          {{ formatTime(row.create_time) }}
        </template>
        <template #operation="{ row }">
          <VbenTableAction
            :actions="[
              {
                icon: 'lucide:edit',
                onClick: () => openEditor(row),
                text: '编辑',
              },
              {
                icon: 'lucide:badge-dollar-sign',
                onClick: () => openPay(row),
                text: '收费设置',
              },
            ]"
            :dropdown-actions="[
              {
                icon: 'lucide:file-text',
                onClick: () => openDetail(row),
                text: '详情',
              },
              {
                icon: 'lucide:trash-2',
                popConfirm: {
                  confirm: () => remove(row),
                  title: '是否确认删除？',
                },
                text: '删除',
              },
            ]"
            align="center"
          />
        </template>
        <template #expanded="{ row }">
          <div class="link-expand">
            <template v-if="!row.fb_acct">
              <div
                v-for="item in [
                  { label: 'h5路径', url: promotionLink(row), preview: true },
                  { label: '落地页链接', url: w2aLink(row), preview: true },
                  { label: '深度链接', url: deepLink(row), preview: false },
                  { label: '深度链接2', url: deepLink2(row), preview: false },
                ]"
                :key="item.label"
                class="link-line"
              >
                <div class="link-actions">
                  <strong>{{ item.label }}</strong>
                  <Button
                    size="small"
                    type="primary"
                    @click="copyText(item.url)"
                  >
                    复制
                  </Button>
                  <Button
                    v-if="item.preview"
                    size="small"
                    @click="openPreview(item.url)"
                  >
                    预览
                  </Button>
                </div>
                <span class="break-all">{{
                  item.url || '缺少对应 param 前缀配置'
                }}</span>
              </div>
            </template>
            <template v-else>
              <div class="link-line">
                <div class="link-actions">
                  <strong>Facebook私域链接</strong>
                  <Button
                    size="small"
                    type="primary"
                    @click="copyText(fbLink(row))"
                  >
                    复制
                  </Button>
                </div>
                <span class="break-all">{{
                  fbLink(row) || '缺少 app_jump_link 参数配置'
                }}</span>
              </div>
            </template>
          </div>
        </template>
      </Grid>
    </Space>

    <Modal
      v-model:open="editorOpen"
      :confirm-loading="saving"
      :title="form.id ? '编辑推广链接' : '新增推广链接'"
      width="760px"
      @ok="submit"
    >
      <Form :label-col="{ span: 5 }" :model="form">
        <FormItem label="名称" required>
          <Input v-model:value="form.name" allow-clear />
        </FormItem>
        <FormItem label="资源" required>
          <Select
            v-model:value="form.res_id"
            show-search
            :filter-option="
              (input: string, option: any) =>
                String(option.label).toLowerCase().includes(input.toLowerCase())
            "
            :loading="optionLoading"
            :options="
              resources.map((item) => ({
                label: resourceLabel(item),
                value: optionValue(item.id),
              }))
            "
            placeholder="请选择资源"
            @change="
              (value: any) => {
                form.item_id = '';
                loadChapters(value);
              }
            "
          />
        </FormItem>
        <FormItem label="章节" required>
          <Select
            v-model:value="form.item_id"
            show-search
            :disabled="!form.res_id"
            :filter-option="
              (input: string, option: any) =>
                String(option.label).toLowerCase().includes(input.toLowerCase())
            "
            :options="
              chapters.map((item) => ({
                label: chapterLabel(item),
                value: optionValue(item.id),
              }))
            "
            placeholder="请选择推广章节"
          />
        </FormItem>
        <FormItem label="变现类型" required>
          <Select v-model:value="form.bx_type" :options="bxTypeOptions" />
        </FormItem>
        <FormItem label="像素ID">
          <Select
            v-model:value="form.fb_pixel_id"
            allow-clear
            show-search
            :disabled="Boolean(form.id)"
            :filter-option="
              (input: string, option: any) =>
                String(option.label).toLowerCase().includes(input.toLowerCase())
            "
            :options="
              pixels.map((item) => ({
                label: `${item.name ?? ''}${item.pixel_id ? ` · ${item.pixel_id}` : ''}`,
                value: optionValue(item.pixel_id),
              }))
            "
            placeholder="请选择像素"
          />
        </FormItem>
        <FormItem label="FB关注账号">
          <Select
            v-model:value="form.fb_acct"
            allow-clear
            show-search
            :filter-option="
              (input: string, option: any) =>
                String(option.label).toLowerCase().includes(input.toLowerCase())
            "
            :options="
              fbAccounts.map((item) => ({
                label: String(
                  item.acct_name ?? item.name ?? item.fb_acct ?? item.id,
                ),
                value: optionValue(item.fb_acct ?? item.id),
              }))
            "
            placeholder="请选择关注账号"
          />
        </FormItem>
        <FormItem label="落地页广告媒体类型" required>
          <Select v-model:value="form.media_type" :options="mediaTypeOptions" />
        </FormItem>
        <FormItem label="封面 URL">
          <Input
            v-model:value="form.cover"
            allow-clear
            placeholder="当前项目使用 storage 模块时可粘贴上传后的图片 URL"
          />
        </FormItem>
        <FormItem label="视频链接">
          <Input v-model:value="form.link" allow-clear />
        </FormItem>
        <FormItem label="备注">
          <TextArea v-model:value="form.remark" :rows="3" />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="payOpen"
      :footer="null"
      title="收费模板设置"
      width="920px"
    >
      <Space direction="vertical" class="w-full" :size="16">
        <Card size="small">
          <Space wrap>
            <Select
              v-model:value="payForm.pay_key"
              :options="payKeyOptions"
              class="pay-select"
            />
            <Select
              v-model:value="payForm.pay_tmp_id"
              show-search
              :filter-option="
                (input: string, option: any) =>
                  String(option.label)
                    .toLowerCase()
                    .includes(input.toLowerCase())
              "
              :options="
                payTemplates.map((item) => ({
                  label: payTemplateLabel(item),
                  value: item.id,
                }))
              "
              class="template-select"
              placeholder="请选择充值模板"
              @change="(value: any) => loadPayDetail(value)"
            />
            <Button type="primary" @click="savePayTemplate">保存模板</Button>
          </Space>
        </Card>
        <div v-if="selectedRecord" class="template-grid">
          <Card
            v-for="key in payKeyOptions
              .map((item) => item.value)
              .filter((key) => normalizeExtInfo(selectedRecord?.ext_info)[key])"
            :key="key"
            size="small"
          >
            <template #title>
              {{ payKeyOptions.find((item) => item.value === key)?.label }}
            </template>
            <template #extra>
              <Button
                danger
                size="small"
                type="link"
                @click="removePayTemplate(key)"
              >
                移除
              </Button>
            </template>
            <Descriptions bordered size="small">
              <DescriptionsItem label="模板ID">
                {{ normalizeExtInfo(selectedRecord.ext_info)[key] }}
              </DescriptionsItem>
              <DescriptionsItem label="模板名称">
                {{
                  payTemplateDetails[
                    String(normalizeExtInfo(selectedRecord.ext_info)[key])
                  ]?.info?.name ?? '-'
                }}
              </DescriptionsItem>
              <DescriptionsItem label="项数">
                {{
                  payTemplateDetails[
                    String(normalizeExtInfo(selectedRecord.ext_info)[key])
                  ]?.items?.length ?? 0
                }}
              </DescriptionsItem>
            </Descriptions>
          </Card>
          <Empty
            v-if="
              Object.keys(normalizeExtInfo(selectedRecord.ext_info)).length ===
              0
            "
            description="暂未设置收费模板"
          />
        </div>
      </Space>
    </Modal>

    <Modal
      v-model:open="analysisOpen"
      :footer="null"
      title="推广链接付费分析"
      width="860px"
    >
      <Space direction="vertical" class="w-full" :size="12">
        <Space>
          <Input
            v-model:value="analysisDay"
            allow-clear
            placeholder="in_link_day，例如 2026-08-23"
          />
          <Button type="primary" @click="loadAnalysis">查询</Button>
        </Space>
        <AnalysisGrid :loading="analysisLoading" table-title="付费分析">
          <template #numRate="{ row }">
            {{ rate(row.pay_user_num, totalPayUserNum) }}
          </template>
          <template #amountRate="{ row }">
            {{ rate(row.total_amount, totalPayAmount) }}
          </template>
        </AnalysisGrid>
      </Space>
    </Modal>

    <Modal
      v-model:open="detailOpen"
      :footer="null"
      title="推广链接详情"
      width="760px"
    >
      <pre class="detail-json">{{
        JSON.stringify(selectedRecord, null, 2)
      }}</pre>
    </Modal>

    <Modal
      v-model:open="previewOpen"
      :footer="null"
      title="链接预览"
      width="430px"
    >
      <iframe class="preview-frame" :src="previewUrl"></iframe>
    </Modal>
  </Page>
</template>

<style scoped>
.query-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 12px;
  align-items: center;
}

.link-expand {
  padding: 16px;
  background: #f7f7f7;
}

.link-line + .link-line {
  margin-top: 16px;
}

.link-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.break-all {
  word-break: break-all;
}

.pay-select {
  width: 140px;
}

.template-select {
  width: 360px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.detail-json {
  max-height: 55vh;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
}

.preview-frame {
  width: 390px;
  height: 720px;
  border: 0;
}

@media (max-width: 960px) {
  .query-grid {
    grid-template-columns: 1fr;
  }
}
</style>
