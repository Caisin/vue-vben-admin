<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Drawer,
  Form,
  FormItem,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  TextArea,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteGroup,
  getLangList,
  getList,
  getSourceList,
  postSave,
  postSourceSave,
  translateText,
} from '#/api/res/seas/global/page_module_manage';
import { getListAll as getResourceList } from '#/api/res/seas/global/source_manage';

import { useGroupColumns, useItemColumns } from './data';

type PageGroup = {
  created_at: number;
  description: string;
  ext_info: Record<string, unknown>;
  group_code: string;
  lang_info: Record<string, { description?: string; title?: string }>;
  page_code: string;
  remark: string;
  show_type: string;
  sort_no: number;
  state: number;
  title: string;
};

type PageItem = {
  cover: string;
  created_at: number;
  ext_info: Record<string, unknown>;
  group_code: string;
  id: number;
  page_code: string;
  remark: string;
  res_id: number;
  sort_no: number;
  state: number;
  tab_code: string;
  title: string;
};

const route = useRoute();
const router = useRouter();
const pageCode = computed(() => String(route.query.page_code ?? ''));
const pageTitle = computed(() =>
  String(route.query.title ?? (pageCode.value || '页面模块')),
);
const loading = ref(false);
const saving = ref(false);
const rows = ref<PageGroup[]>([]);
const editorOpen = ref(false);
const languageOpen = ref(false);
const languageSaving = ref(false);
const resourceOpen = ref(false);
const resourceLoading = ref(false);
const resourceSaving = ref(false);
const resources = ref<any[]>([]);
const selectedResourceIds = ref<number[]>([]);
const pageItems = ref<PageItem[]>([]);
const activeGroup = ref<PageGroup>();
const languages = ref<Array<{ locale: string; name: string }>>([]);
const translationRows = ref<
  Array<{ description: string; locale: string; name: string; title: string }>
>([]);
const form = reactive<PageGroup>(emptyGroup());

function normalizeRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  return payload ? [payload] : [];
}

const [Grid, gridApi] = useVbenVxeGrid<PageGroup>({
  gridOptions: {
    columns: useGroupColumns(),
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          if (!pageCode.value) return { items: [], total: 0 };
          const payload = await getList({ page_code: pageCode.value });
          const items = normalizeRows(payload);
          rows.value = items;
          return { items, total: items.length };
        },
      },
    },
    rowConfig: { keyField: 'group_code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<PageGroup>,
});

const [ItemGrid, itemGridApi] = useVbenVxeGrid<PageItem>({
  gridOptions: {
    columns: useItemColumns(),
    height: 420,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'res_id' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions<PageItem>,
});

async function reloadItemGrid() {
  await nextTick();
  await itemGridApi.grid.reloadData(pageItems.value);
}

const resourceOptions = computed(() =>
  resources.value.map((item) => ({
    label: `${item.res_name ?? item.title ?? `资源 ${item.id}`} (#${item.id})`,
    value: Number(item.id),
  })),
);

function emptyGroup(): PageGroup {
  return {
    created_at: 0,
    description: '',
    ext_info: {},
    group_code: '',
    lang_info: {},
    page_code: pageCode.value,
    remark: '',
    show_type: 'list',
    sort_no: 0,
    state: 1,
    title: '',
  };
}

async function load() {
  loading.value = true;
  try {
    await gridApi.query();
  } finally {
    loading.value = false;
  }
}

function openEditor(record?: PageGroup) {
  Object.assign(form, emptyGroup(), record ?? {});
  form.ext_info ||= {};
  form.lang_info ||= {};
  editorOpen.value = true;
}

async function submitGroup() {
  if (!form.group_code.trim() || !form.title.trim()) {
    message.warning('请填写模块编码和标题');
    return;
  }
  saving.value = true;
  try {
    await postSave({ ...form, page_code: pageCode.value });
    editorOpen.value = false;
    message.success('模块已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function removeGroup(record: PageGroup) {
  await deleteGroup(record);
  message.success('模块已删除');
  await load();
}

async function openResources(record: PageGroup) {
  activeGroup.value = record;
  resourceOpen.value = true;
  resourceLoading.value = true;
  try {
    const [items, allResources] = await Promise.all([
      getSourceList(record),
      getResourceList({}),
    ]);
    pageItems.value = normalizeRows(items).toSorted(
      (a: PageItem, b: PageItem) => a.sort_no - b.sort_no,
    );
    resources.value = allResources as any[];
    selectedResourceIds.value = pageItems.value.map((item) =>
      Number(item.res_id),
    );
    await reloadItemGrid();
  } finally {
    resourceLoading.value = false;
  }
}

function applyResourceSelection(ids: number[]) {
  const existing = new Map(
    pageItems.value.map((item) => [Number(item.res_id), item]),
  );
  pageItems.value = ids.map((id, index) => {
    const old = existing.get(id);
    const source = resources.value.find((item) => Number(item.id) === id);
    return {
      cover: old?.cover ?? source?.cover ?? '',
      created_at: old?.created_at ?? 0,
      ext_info: old?.ext_info ?? {},
      group_code: activeGroup.value?.group_code ?? '',
      id: old?.id ?? 0,
      page_code: pageCode.value,
      remark: old?.remark ?? '',
      res_id: id,
      sort_no: index,
      state: old?.state ?? 1,
      tab_code: old?.tab_code ?? '',
      title: old?.title ?? source?.res_name ?? source?.title ?? `资源 ${id}`,
    };
  });
  void reloadItemGrid();
}

function moveItem(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= pageItems.value.length) return;
  const list = [...pageItems.value];
  const current = list[index];
  const replacement = list[target];
  if (!current || !replacement) return;
  list[index] = replacement;
  list[target] = current;
  pageItems.value = list;
  void reloadItemGrid();
}

function removeItem(index: number) {
  pageItems.value.splice(index, 1);
  selectedResourceIds.value = pageItems.value.map((item) => item.res_id);
  void reloadItemGrid();
}

async function saveResources() {
  const group = activeGroup.value;
  if (!group) return;
  resourceSaving.value = true;
  try {
    const payload = pageItems.value.map((item, index) => ({
      ...item,
      group_code: group.group_code,
      page_code: pageCode.value,
      sort_no: index,
    }));
    await postSourceSave(group, payload);
    resourceOpen.value = false;
    message.success('模块资源已保存');
  } finally {
    resourceSaving.value = false;
  }
}

async function openLanguage(record: PageGroup) {
  activeGroup.value = record;
  if (languages.value.length === 0) {
    const result = await getLangList();
    languages.value = Array.isArray(result) ? result : (result?.items ?? []);
  }
  translationRows.value = languages.value.map((lang) => ({
    description: record.lang_info?.[lang.locale]?.description ?? '',
    locale: lang.locale,
    name: lang.name,
    title: record.lang_info?.[lang.locale]?.title ?? '',
  }));
  languageOpen.value = true;
}

async function translateAll() {
  if (!activeGroup.value?.title.trim()) {
    message.warning('请先填写模块标题');
    return;
  }
  languageSaving.value = true;
  try {
    for (const row of translationRows.value) {
      const [title, description] = await Promise.all([
        translateText(activeGroup.value.title, row.locale),
        activeGroup.value.description
          ? translateText(activeGroup.value.description, row.locale)
          : Promise.resolve({ text: '' }),
      ]);
      row.title = title.text;
      row.description = description.text;
    }
  } finally {
    languageSaving.value = false;
  }
}

async function saveLanguages() {
  if (!activeGroup.value) return;
  languageSaving.value = true;
  try {
    const langInfo = Object.fromEntries(
      translationRows.value.map((row) => [
        row.locale,
        { description: row.description, title: row.title },
      ]),
    );
    await postSave({ ...activeGroup.value, lang_info: langInfo });
    languageOpen.value = false;
    message.success('多语言配置已保存');
    await load();
  } finally {
    languageSaving.value = false;
  }
}

watch(pageCode, () => gridApi.query());
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    :title="pageTitle"
  >
    <Grid class="management-grid" :table-title="pageTitle">
      <template #toolbar-tools>
        <Space>
          <Button @click="router.back()">返回</Button>
          <Tag color="blue">{{ pageCode || '未选择页面' }}</Tag>
          <Button :disabled="!pageCode" type="primary" @click="openEditor()">
            新增模块
          </Button>
        </Space>
      </template>
      <template #groupCode="{ row }">
        <Tag>{{ row.group_code }}</Tag>
      </template>
      <template #state="{ row }">
        <Tag :color="row.state === 1 ? 'green' : 'default'">
          {{ row.state === 1 ? '启用' : '停用' }}
        </Tag>
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
              icon: 'lucide:package-plus',
              onClick: () => openResources(row),
              text: '资源',
            },
          ]"
          :dropdown-actions="[
            {
              icon: 'lucide:languages',
              onClick: () => openLanguage(row),
              text: '多语言',
            },
            {
              danger: true,
              icon: 'lucide:trash-2',
              popConfirm: {
                confirm: () => removeGroup(row),
                title: '删除模块及其页面资源？',
              },
              text: '删除',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="editorOpen"
      :confirm-loading="saving"
      :title="form.created_at ? '编辑模块' : '新增模块'"
      width="680px"
      @ok="submitGroup"
    >
      <Form :label-col="{ span: 5 }" :model="form">
        <FormItem label="模块编码" required>
          <Input
            v-model:value="form.group_code"
            :disabled="form.created_at > 0"
          />
        </FormItem>
        <FormItem label="标题" required>
          <Input v-model:value="form.title" />
        </FormItem>
        <FormItem label="描述">
          <TextArea v-model:value="form.description" :rows="3" />
        </FormItem>
        <FormItem label="展示类型">
          <Select
            v-model:value="form.show_type"
            :options="[
              { label: '列表', value: 'list' },
              { label: '轮播', value: 'banner' },
              { label: '横向滑动', value: 'horizontal' },
              { label: '标签页', value: 'tab' },
            ]"
          />
        </FormItem>
        <FormItem label="排序">
          <InputNumber v-model:value="form.sort_no" :min="0" />
        </FormItem>
        <FormItem label="启用">
          <Switch
            v-model:checked="form.state"
            :checked-value="1"
            :un-checked-value="0"
          />
        </FormItem>
        <FormItem label="备注"><Input v-model:value="form.remark" /></FormItem>
      </Form>
    </Modal>

    <Drawer
      v-model:open="resourceOpen"
      :title="`${activeGroup?.title ?? ''} - 资源编排`"
      :size="760"
    >
      <div class="resource-picker">
        <Select
          v-model:value="selectedResourceIds"
          :loading="resourceLoading"
          :options="resourceOptions"
          mode="multiple"
          placeholder="选择资源"
          show-search
          @change="applyResourceSelection"
        />
        <span>共 {{ pageItems.length }} 项</span>
      </div>
      <ItemGrid>
        <template #sort="{ rowIndex }">
          <Space>
            <Button
              :disabled="rowIndex === 0"
              size="small"
              @click="moveItem(rowIndex, -1)"
            >
              <IconifyIcon icon="lucide:arrow-up" />
            </Button>
            <Button
              :disabled="rowIndex === pageItems.length - 1"
              size="small"
              @click="moveItem(rowIndex, 1)"
            >
              <IconifyIcon icon="lucide:arrow-down" />
            </Button>
          </Space>
        </template>
        <template #cover="{ row }">
          <Image
            v-if="row.cover"
            :preview="false"
            :src="row.cover"
            :width="46"
          />
        </template>
        <template #itemState="{ row }">
          <Switch
            v-model:checked="row.state"
            :checked-value="1"
            :un-checked-value="0"
          />
        </template>
        <template #itemOperation="{ rowIndex }">
          <Button danger size="small" type="link" @click="removeItem(rowIndex)">
            移除
          </Button>
        </template>
      </ItemGrid>
      <template #footer>
        <div class="drawer-footer">
          <Button @click="resourceOpen = false">取消</Button>
          <Button
            :loading="resourceSaving"
            type="primary"
            @click="saveResources"
          >
            保存编排
          </Button>
        </div>
      </template>
    </Drawer>

    <Modal
      v-model:open="languageOpen"
      :confirm-loading="languageSaving"
      title="多语言设置"
      width="780px"
      @ok="saveLanguages"
    >
      <div class="language-toolbar">
        <Button :loading="languageSaving" @click="translateAll">
          <template #icon><IconifyIcon icon="lucide:languages" /></template>
          一键翻译
        </Button>
      </div>
      <div
        v-for="row in translationRows"
        :key="row.locale"
        class="language-row"
      >
        <strong>{{ row.name || row.locale }}</strong>
        <Input v-model:value="row.title" placeholder="标题" />
        <Input v-model:value="row.description" placeholder="描述" />
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.module-toolbar,
.resource-picker,
.drawer-footer,
.language-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.resource-picker :deep(.ant-select) {
  flex: 1;
}

.drawer-footer {
  justify-content: flex-end;
  margin: 0;
}

.language-row {
  display: grid;
  grid-template-columns: 120px 1fr 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

@media (max-width: 720px) {
  .module-toolbar,
  .resource-picker {
    flex-direction: column;
    align-items: stretch;
  }

  .language-row {
    grid-template-columns: 1fr;
  }
}
</style>
