<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ResChapter,
  ResRecord,
} from '#/api/res/seas/global/source_manage';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { RotateCw } from '@vben/icons';

import {
  Button,
  Card,
  CardMeta,
  Col,
  Divider,
  Drawer,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  RadioButton,
  RadioGroup,
  Row,
  Select,
  Space,
  Tag,
  TextArea,
  Tooltip,
  Upload,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { global, set } from '#/api/res/seas';

import {
  resTypeOptions,
  resStateOptions as stateOptions,
  useChapterColumns,
  useColumns,
  useGridFormSchema,
} from './data';

const sourceApi = global.source_manage;
const categoryApi = set.category;

const buyTypeOptions = [
  { label: '单集购买', value: 0 },
  { label: '整部购买', value: 1 },
];
const langOptions = [
  'en',
  'zh',
  'zh_hk',
  'ja',
  'vi',
  'id',
  'th',
  'ko',
  'es',
  'pt',
].map((value) => ({
  label: value,
  value,
}));

type Mode = 'card' | 'table';
type DialogType =
  | ''
  | 'ad'
  | 'category'
  | 'chapters'
  | 'coin-history'
  | 'coin-orders'
  | 'edit'
  | 'heat'
  | 'novel'
  | 'price'
  | 'tags';

const mode = ref<Mode>('table');
const rows = ref<ResRecord[]>([]);
const activeRecord = ref<null | ResRecord>(null);
const dialogType = ref<DialogType>('');
const drawerOpen = ref(false);
const drawerTitle = ref('');
const chapters = ref<ResChapter[]>([]);
const detailRows = ref<any[]>([]);
const tags = ref<any[]>([]);
const categories = ref<any[]>([]);
const uploadText = ref('');
const videoUrl = ref('');
const parseProgress = ref('');
const saving = ref(false);
const reindexingSearch = ref(false);
const editForm = reactive<Record<string, any>>({});
const priceForm = reactive<Record<string, any>>({});
const priceRanges = ref<
  Array<{ end?: number; price?: number; start?: number }>
>([]);
const selectedTagIds = ref<any[]>([]);
const selectedCategoryIds = ref<any[]>([]);

const dialogOpen = computed({
  get: () => dialogType.value !== '',
  set: (open: boolean) => {
    if (!open) dialogType.value = '';
  },
});

function labelize(key: string) {
  const labels: Record<string, string> = {
    amount: '金额',
    create_time: '创建时间',
    created_at: '创建时间',
    id: 'ID',
    lang: '语言',
    order_no: '订单号',
    price: '价格',
    res_id: '资源ID',
    seq_no: '集数',
    state: '状态',
    uid: '用户ID',
    updated_at: '更新时间',
  };
  return labels[key] ?? key;
}

function normalizeList(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return payload ? [payload] : [];
}

function normalizeTotal(payload: any, list: any[]) {
  return Number(
    payload?.total ?? payload?.count ?? payload?.total_count ?? list.length,
  );
}

const [Grid, gridApi] = useVbenVxeGrid<ResRecord>({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const payload = await sourceApi.getList({
            'id.eq': formValues.id,
            keyword: formValues.keyword?.trim() || undefined,
            'res_type.eq': formValues.res_type,
            'state.eq': formValues.state,
            page: page.currentPage,
            size: page.pageSize,
          });
          const items = normalizeList(payload);
          rows.value = items;
          return { items, total: normalizeTotal(payload, items) };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ResRecord>,
});

const [ChapterGrid, chapterGridApi] = useVbenVxeGrid<ResChapter>({
  gridOptions: {
    columns: useChapterColumns(),
    height: 420,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions<ResChapter>,
});

const [DetailGrid, detailGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [],
    height: 460,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: '__rowKey' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions,
});

function recordTitle(record: ResRecord) {
  return record.res_name || record.title || `资源 ${record.id}`;
}

function langKeys(record: ResRecord) {
  return Object.keys(record.lang_info ?? {});
}

function cloneRecord(record?: null | Record<string, any>) {
  return JSON.parse(JSON.stringify(record ?? {}));
}

function normalizeArrayValue(value: any) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function openDialog(type: DialogType, record?: ResRecord) {
  activeRecord.value = record ?? null;
  dialogType.value = type;
  Object.keys(editForm).forEach((key) => Reflect.deleteProperty(editForm, key));
  Object.keys(priceForm).forEach((key) =>
    Reflect.deleteProperty(priceForm, key),
  );
  priceRanges.value = [];
  uploadText.value = '';
  parseProgress.value = '';

  if (type === 'edit' && record) {
    Object.assign(editForm, {
      ...cloneRecord(record),
      alert_sec: record.ad_cfg?.alert_sec,
      sleep_sec: record.ad_cfg?.sleep_sec,
    });
  } else if (type === 'ad' && record) {
    Object.assign(editForm, {
      alert_sec: record.ad_cfg?.alert_sec ?? 0,
      id: record.id,
      res_id: record.id,
      sleep_sec: record.ad_cfg?.sleep_sec ?? 0,
    });
  } else if (type === 'heat' && record) {
    Object.assign(editForm, { heat_num: record.heat_num ?? 0, id: record.id });
  } else if (type === 'novel') {
    Object.assign(editForm, {
      intro: '',
      lang: 'zh',
      res_name: '',
      res_type: 2,
      state: 0,
    });
  } else if (type === 'price' && record) {
    Object.assign(priceForm, {
      buy_type: 0,
      lang: [],
      res_id: record.id,
      whole_price: 0,
    });
    loadDefaultPrice(record);
  } else if (type === 'category' && record) {
    loadCategories(record);
  } else if (type === 'tags' && record) {
    loadTags(record);
  } else if (type === 'chapters' && record) {
    loadChapters(record);
  } else if (type === 'coin-history' && record) {
    loadCoinHistory(record);
  } else if (type === 'coin-orders' && record) {
    loadCoinOrders(record);
  }
}

async function saveDialog() {
  saving.value = true;
  try {
    if (dialogType.value === 'edit') {
      await sourceApi.postUpdateConfigNoLang({
        ...editForm,
        id: editForm.id ?? activeRecord.value?.id,
      });
      message.success('资源信息已保存');
    } else if (dialogType.value === 'ad') {
      await sourceApi.postAdConfig({
        ...editForm,
        id: editForm.id ?? activeRecord.value?.id,
      });
      message.success('广告配置已保存');
    } else if (dialogType.value === 'heat') {
      await sourceApi.postResHeat({
        heat_num: editForm.heat_num,
        id: editForm.id ?? activeRecord.value?.id,
      });
      message.success('热度已保存');
    } else if (dialogType.value === 'novel') {
      await sourceApi.postSaveNoval({
        ...editForm,
        parse_result: parseJson(uploadText.value, undefined),
      });
      message.success('小说创建已提交');
    } else if (dialogType.value === 'price') {
      const payload = {
        ...priceForm,
        lang: normalizeArrayValue(priceForm.lang),
        seq_range: priceRanges.value.filter(
          (item) =>
            item.start !== undefined ||
            item.end !== undefined ||
            item.price !== undefined,
        ),
        whole_price: priceForm.whole_price ?? 0,
      };
      await sourceApi.postLangPrice(payload as any);
      message.success('价格配置已保存');
    } else if (dialogType.value === 'category' && activeRecord.value) {
      await categoryApi.postSetSourceCate(
        activeRecord.value.id,
        selectedCategoryIds.value,
      );
      message.success('分类已保存');
    } else if (dialogType.value === 'tags') {
      message.success('标签选择已保留在页面，新增标签请使用“新增标签”按钮');
    }
    dialogType.value = '';
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

function parseJson(value: string, fallback: any) {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function loadDefaultPrice(record: ResRecord) {
  try {
    const data = await sourceApi.getDefaultPrice(record.id);
    Object.assign(priceForm, data ?? {}, { res_id: record.id });
    priceRanges.value = Array.isArray(data?.seq_range) ? data.seq_range : [];
  } catch (error) {
    message.warning(
      `默认价格读取失败，可直接重新保存：${String((error as Error)?.message ?? error)}`,
    );
  }
}

async function loadChapters(record: ResRecord, lang?: string) {
  const targetLang = lang || langKeys(record)[0];
  chapters.value = targetLang
    ? await sourceApi.getChapterList(record.id, targetLang)
    : await sourceApi.getChapterListNoLangNoPage({ res_id: record.id });
  await nextTick();
  await chapterGridApi.grid.reloadData(chapters.value);
}

async function loadCategories(record: ResRecord) {
  const payload = await categoryApi.getList({
    page: 1,
    size: 500,
  });
  categories.value = normalizeList(payload);
  selectedCategoryIds.value = (record.ext_info?.tags ?? [])
    .map((item: any) => item.id ?? item.tag_id)
    .filter(Boolean);
}

async function loadTags(record: ResRecord) {
  const payload = await sourceApi.getMarkTagList({
    page: 1,
    size: 500,
  });
  tags.value = normalizeList(payload);
  selectedTagIds.value = (record.ext_info?.tags ?? [])
    .map((item: any) => item.id ?? item.tag_id)
    .filter(Boolean);
}

async function loadCoinHistory(record: ResRecord) {
  detailRows.value = normalizeList(
    await sourceApi.getCoinHistory({
      id: record.id,
      page: 1,
      size: 50,
    }),
  );
  await reloadDetailGrid();
}

async function loadCoinOrders(record: ResRecord) {
  detailRows.value = normalizeList(
    await sourceApi.getCoinOrderList({
      id: record.id,
      page: 1,
      size: 50,
    }),
  );
  await reloadDetailGrid();
}

async function reloadDetailGrid() {
  const keys = Object.keys(detailRows.value[0] ?? {});
  detailGridApi.setGridOptions({
    columns: keys.map((key) => ({
      field: key,
      minWidth: 140,
      showOverflow: 'tooltip',
      title: labelize(key),
    })),
  });
  await nextTick();
  await detailGridApi.grid.reloadData(
    detailRows.value.map((row, index) => ({
      ...row,
      __rowKey: row.id ?? index,
    })),
  );
}

function showDrawer(title: string, records: any[]) {
  drawerTitle.value = title;
  detailRows.value = records;
  drawerOpen.value = true;
  void reloadDetailGrid();
}

async function toggleState(record: ResRecord) {
  await sourceApi.postChangeState(record.id, record.state === 1 ? 0 : 1);
  message.success(record.state === 1 ? '已下架' : '已上架');
  await gridApi.query();
}

async function refreshRecordCategory(record: ResRecord) {
  await categoryApi.refreshSourceCateList(record.id);
  message.success('资源分类已刷新');
  await gridApi.query();
}

async function refreshAllCategory() {
  await categoryApi.refreshAllCateList();
  message.success('所有资源分类已刷新');
  await gridApi.query();
}

async function removeCategory(record: ResRecord, tag: any) {
  const nextIds = (record.ext_info?.tags ?? [])
    .filter((item: any) => (item.id ?? item.tag_id) !== (tag.id ?? tag.tag_id))
    .map((item: any) => item.id ?? item.tag_id);
  await categoryApi.postSetSourceCate(record.id, nextIds);
  message.success('分类已移除');
  await gridApi.query();
}

async function addMarkTag() {
  const name = String(editForm.new_tag_name ?? '').trim();
  if (!name) return message.warning('请输入标签名称');
  await sourceApi.postAddMarkTag({ name, zh_name: name });
  editForm.new_tag_name = '';
  if (activeRecord.value) await loadTags(activeRecord.value);
  message.success('标签已新增');
}

async function beforeParseUpload(file: File) {
  parseProgress.value = '解析中...';
  try {
    const result = await sourceApi.parse_file({ file }, (event: any) => {
      const percent = event?.total
        ? Math.round((event.loaded / event.total) * 100)
        : 0;
      parseProgress.value = percent ? `上传 ${percent}%` : '上传中...';
    });
    uploadText.value =
      typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    parseProgress.value = '解析完成';
  } catch (error) {
    parseProgress.value = '解析失败：后端解析接口当前可能未完成迁移';
    message.error(String((error as Error)?.message ?? error));
  }
  return false;
}

function playChapter(row: ResChapter) {
  videoUrl.value =
    row.play_url || row.url || row.video_url || row.file_url || '';
  if (!videoUrl.value) message.warning('该章节没有可播放地址');
}

async function downloadNovel(record: ResRecord, lang?: string) {
  try {
    const result = lang
      ? await sourceApi.downloadLangNovel(record.id, lang)
      : await sourceApi.downloadNovel(record.id);
    const url =
      typeof result === 'string' ? result : result?.url || result?.download_url;
    if (url) globalThis.open(url, '_blank');
    else showDrawer('下载接口返回', [result]);
  } catch (error) {
    message.error(
      `下载接口不可用或迁移未完成：${String((error as Error)?.message ?? error)}`,
    );
  }
}

function onTextAreaJsonChange(event: Event, key: string) {
  const target = event.target as HTMLTextAreaElement;
  editForm[key] = parseJson(target.value, target.value);
}

async function reindexSearch() {
  reindexingSearch.value = true;
  try {
    const result = await sourceApi.postSearchReindex();
    message.success(`资源搜索索引已重建，共 ${result.indexed} 条`);
    await gridApi.query();
  } finally {
    reindexingSearch.value = false;
  }
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="资源管理"
  >
    <Grid
      v-show="mode === 'table'"
      class="management-grid"
      table-title="资源管理"
    >
      <template #toolbar-tools>
        <Space>
          <Button
            v-access:code="'res:search-reindex'"
            :loading="reindexingSearch"
            @click="reindexSearch"
          >
            <RotateCw class="size-4" />重建搜索索引
          </Button>
          <Button @click="refreshAllCategory">刷新所有分类</Button>
          <RadioGroup v-model:value="mode" button-style="solid">
            <RadioButton value="table">表格</RadioButton>
            <RadioButton value="card">卡片</RadioButton>
          </RadioGroup>
          <Button type="primary" @click="openDialog('novel')">
            新增小说
          </Button>
        </Space>
      </template>
      <template #cover="{ row }">
        <Image v-if="row.cover" :height="56" :src="row.cover" class="rounded" />
        <span v-else>-</span>
      </template>
      <template #resType="{ row }">
        {{
          resTypeOptions.find((item) => item.value === row.res_type)?.label ||
          row.res_type ||
          '-'
        }}
      </template>
      <template #languages="{ row }">
        <Space wrap>
          <Button
            v-for="lang in langKeys(row)"
            :key="lang"
            size="small"
            @click="
              openDialog('chapters', row);
              loadChapters(row, lang);
            "
          >
            {{ lang }}
          </Button>
          <Button
            v-if="!langKeys(row).length"
            size="small"
            @click="openDialog('chapters', row)"
          >
            章节
          </Button>
        </Space>
      </template>
      <template #state="{ row }">
        <Tag :color="row.state === 1 ? 'success' : 'default'">
          {{ row.state === 1 ? '上架' : '下架' }}
        </Tag>
      </template>
      <template #category="{ row }">
        <Space wrap>
          <Tag
            v-for="tag in row.ext_info?.tags ?? []"
            :key="tag.id ?? tag.name"
            :color="tag.color"
            closable
            @close.prevent="removeCategory(row, tag)"
          >
            {{ tag.zh_name || tag.name?.zh || tag.name || tag.id }}
          </Tag>
          <Button size="small" @click="openDialog('category', row)">
            增加分类
          </Button>
        </Space>
      </template>
      <template #adConfig="{ row }">
        弹出 {{ row.ad_cfg?.alert_sec ?? '-' }}s / 间隔
        {{ row.ad_cfg?.sleep_sec ?? '-' }}s
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:edit',
              onClick: () => openDialog('edit', row),
              text: '编辑',
            },
            {
              icon: 'lucide:badge-dollar-sign',
              onClick: () => openDialog('price', row),
              text: '价格',
            },
          ]"
          :dropdown-actions="[
            {
              onClick: () => openDialog('tags', row),
              text: '标签',
            },
            {
              onClick: () => refreshRecordCategory(row),
              text: '刷新分类',
            },
            {
              onClick: () => openDialog('ad', row),
              text: '广告配置',
            },
            {
              onClick: () => openDialog('heat', row),
              text: '热度',
            },
            {
              onClick: () => openDialog('coin-history', row),
              text: '金币历史',
            },
            {
              onClick: () => openDialog('coin-orders', row),
              text: '订单',
            },
            {
              onClick: () => downloadNovel(row),
              text: '下载',
            },
            {
              danger: row.state === 1,
              popConfirm: {
                confirm: () => toggleState(row),
                title: row.state === 1 ? '确认下架？' : '确认上架？',
              },
              text: row.state === 1 ? '下架' : '上架',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <div v-if="mode === 'card'" class="mb-3 flex justify-end">
      <RadioGroup v-model:value="mode" button-style="solid">
        <RadioButton value="table">表格</RadioButton>
        <RadioButton value="card">卡片</RadioButton>
      </RadioGroup>
    </div>
    <Row v-if="mode === 'card'" :gutter="16" class="overflow-auto">
      <Col
        v-for="item in rows"
        :key="item.id"
        :lg="6"
        :md="8"
        :sm="12"
        :xs="24"
        class="mb-4"
      >
        <Card hoverable>
          <template #cover>
            <div class="bg-gray-50 py-3 text-center">
              <Image
                v-if="item.cover"
                :src="item.cover"
                :height="260"
                class="rounded object-cover"
              />
              <Empty v-else description="暂无封面" />
            </div>
          </template>
          <CardMeta :title="recordTitle(item)">
            <template #description>
              <Space direction="vertical" class="w-full">
                <Tooltip :title="item.intro">
                  <div class="line-clamp-2 min-h-[44px] text-gray-500">
                    {{ item.intro || '-' }}
                  </div>
                </Tooltip>
                <Space wrap>
                  <Button
                    v-for="lang in langKeys(item)"
                    :key="lang"
                    size="small"
                    @click="
                      openDialog('chapters', item);
                      loadChapters(item, lang);
                    "
                  >
                    {{ lang }}
                  </Button>
                </Space>
                <Space wrap>
                  <Button
                    size="small"
                    type="link"
                    @click="openDialog('edit', item)"
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    @click="openDialog('price', item)"
                  >
                    价格
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    @click="openDialog('chapters', item)"
                  >
                    章节
                  </Button>
                </Space>
              </Space>
            </template>
          </CardMeta>
        </Card>
      </Col>
    </Row>

    <Modal
      v-model:open="dialogOpen"
      :confirm-loading="saving"
      :title="activeRecord ? recordTitle(activeRecord) : '资源操作'"
      width="920px"
      @ok="saveDialog"
    >
      <Form v-if="dialogType === 'edit'" layout="vertical">
        <Row :gutter="12">
          <Col :span="12">
            <FormItem label="资源名称">
              <Input v-model:value="editForm.res_name" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="封面">
              <Input v-model:value="editForm.cover" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="资源类型">
              <Select
                v-model:value="editForm.res_type"
                :options="resTypeOptions"
              />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="状态">
              <Select v-model:value="editForm.state" :options="stateOptions" />
            </FormItem>
          </Col>
          <Col :span="24">
            <FormItem label="资源介绍">
              <TextArea v-model:value="editForm.intro" :rows="4" />
            </FormItem>
          </Col>
          <Col :span="24">
            <FormItem label="备注">
              <TextArea v-model:value="editForm.remark" :rows="2" />
            </FormItem>
          </Col>
          <Col :span="24">
            <FormItem label="扩展信息 JSON">
              <TextArea
                :value="JSON.stringify(editForm.ext_info ?? {}, null, 2)"
                :rows="5"
                @change="
                  (event: Event) => onTextAreaJsonChange(event, 'ext_info')
                "
              />
            </FormItem>
          </Col>
        </Row>
      </Form>

      <Form v-else-if="dialogType === 'novel'" layout="vertical">
        <Row :gutter="12">
          <Col :span="12">
            <FormItem label="小说名称">
              <Input v-model:value="editForm.res_name" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="语言">
              <Select v-model:value="editForm.lang" :options="langOptions" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="封面">
              <Input v-model:value="editForm.cover" />
            </FormItem>
          </Col>
          <Col :span="12">
            <FormItem label="状态">
              <Select v-model:value="editForm.state" :options="stateOptions" />
            </FormItem>
          </Col>
          <Col :span="24">
            <FormItem label="简介">
              <TextArea v-model:value="editForm.intro" :rows="3" />
            </FormItem>
          </Col>
          <Col :span="24">
            <FormItem label="文件解析">
              <Space>
                <Upload
                  :before-upload="beforeParseUpload"
                  :show-upload-list="false"
                >
                  <Button>选择并解析文件</Button>
                </Upload>
                <span>{{ parseProgress }}</span>
              </Space>
              <TextArea
                v-model:value="uploadText"
                class="mt-2"
                :rows="8"
                placeholder="解析结果或手工章节 JSON；后端解析/创建接口若未完成会返回错误"
              />
            </FormItem>
          </Col>
        </Row>
      </Form>

      <Form v-else-if="dialogType === 'price'" layout="vertical">
        <Row :gutter="12">
          <Col :span="8">
            <FormItem label="购买类型">
              <Select
                v-model:value="priceForm.buy_type"
                :options="buyTypeOptions"
              />
            </FormItem>
          </Col>
          <Col :span="8">
            <FormItem label="整部价格">
              <InputNumber
                v-model:value="priceForm.whole_price"
                class="w-full"
                :min="0"
              />
            </FormItem>
          </Col>
          <Col :span="8">
            <FormItem label="语言">
              <Select
                v-model:value="priceForm.lang"
                mode="multiple"
                :options="langOptions"
              />
            </FormItem>
          </Col>
        </Row>
        <Divider>价格区间</Divider>
        <Space direction="vertical" class="w-full">
          <Row v-for="(range, index) in priceRanges" :key="index" :gutter="8">
            <Col :span="7">
              <InputNumber
                v-model:value="range.start"
                class="w-full"
                placeholder="开始集"
                :min="1"
              />
            </Col>
            <Col :span="7">
              <InputNumber
                v-model:value="range.end"
                class="w-full"
                placeholder="结束集"
                :min="1"
              />
            </Col>
            <Col :span="7">
              <InputNumber
                v-model:value="range.price"
                class="w-full"
                placeholder="价格"
                :min="0"
              />
            </Col>
            <Col :span="3">
              <Button danger @click="priceRanges.splice(index, 1)">
                删除
              </Button>
            </Col>
          </Row>
          <Button @click="priceRanges.push({})">新增区间</Button>
        </Space>
      </Form>

      <Form v-else-if="dialogType === 'ad'" layout="vertical">
        <FormItem label="广告弹出时长（秒）">
          <InputNumber
            v-model:value="editForm.alert_sec"
            class="w-full"
            :min="0"
          />
        </FormItem>
        <FormItem label="广告间隔时长（秒）">
          <InputNumber
            v-model:value="editForm.sleep_sec"
            class="w-full"
            :min="0"
          />
        </FormItem>
      </Form>

      <Form v-else-if="dialogType === 'heat'" layout="vertical">
        <FormItem label="热度值">
          <InputNumber
            v-model:value="editForm.heat_num"
            class="w-full"
            :min="0"
          />
        </FormItem>
      </Form>

      <Space
        v-else-if="dialogType === 'category'"
        direction="vertical"
        class="w-full"
      >
        <Select
          v-model:value="selectedCategoryIds"
          mode="multiple"
          :options="
            categories.map((item) => ({
              label: item.zh_name || item.name?.zh || item.name || item.id,
              value: item.id,
            }))
          "
          placeholder="选择分类"
        />
      </Space>

      <Space
        v-else-if="dialogType === 'tags'"
        direction="vertical"
        class="w-full"
      >
        <Select
          v-model:value="selectedTagIds"
          mode="multiple"
          :options="
            tags.map((item) => ({
              label: item.zh_name || item.name?.zh || item.name || item.id,
              value: item.id,
            }))
          "
          placeholder="查看/选择标签"
        />
        <Space class="w-full">
          <Input
            v-model:value="editForm.new_tag_name"
            placeholder="新增标签名称"
          />
          <Button @click="addMarkTag">新增标签</Button>
        </Space>
        <div class="text-gray-500">
          当前后端只暴露标签新增与列表接口；资源绑定仍走分类接口。
        </div>
      </Space>

      <Space
        v-else-if="dialogType === 'chapters'"
        direction="vertical"
        class="w-full"
      >
        <Space wrap>
          <Button
            v-for="lang in langKeys(activeRecord as ResRecord)"
            :key="lang"
            @click="activeRecord && loadChapters(activeRecord, lang)"
          >
            {{ lang }}
          </Button>
          <Button v-if="activeRecord" @click="downloadNovel(activeRecord)">
            下载默认小说
          </Button>
          <Button
            v-for="lang in langKeys(activeRecord as ResRecord)"
            :key="`download-${lang}`"
            @click="activeRecord && downloadNovel(activeRecord, lang)"
          >
            下载 {{ lang }}
          </Button>
        </Space>
        <video
          v-if="videoUrl"
          class="max-h-[360px] w-full bg-black"
          controls
          :src="videoUrl"
        ></video>
        <ChapterGrid table-title="章节列表">
          <template #operation="{ row }">
            <Button size="small" type="link" @click="playChapter(row)">
              播放
            </Button>
          </template>
        </ChapterGrid>
      </Space>

      <DetailGrid
        v-else-if="
          dialogType === 'coin-history' || dialogType === 'coin-orders'
        "
        :table-title="dialogType === 'coin-history' ? '金币历史' : '订单'"
      />
    </Modal>

    <Drawer v-model:open="drawerOpen" :title="drawerTitle" :size="720">
      <DetailGrid :table-title="drawerTitle" />
    </Drawer>
  </Page>
</template>
