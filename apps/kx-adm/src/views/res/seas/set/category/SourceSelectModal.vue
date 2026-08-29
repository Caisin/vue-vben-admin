<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ResChapter,
  ResRecord,
} from '#/api/res/seas/global/source_manage';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Modal,
  Space,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getChapterListNoLangNoPage,
  getList,
} from '#/api/res/seas/global/source_manage';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    selectedIds?: Array<number | string>;
  }>(),
  {
    open: false,
    selectedIds: () => [],
  },
);

const emit = defineEmits<{
  save: [Array<number | string>];
  'update:open': [boolean];
}>();

const loading = ref(false);
const rows = ref<ResRecord[]>([]);
const selected = ref<ResRecord[]>([]);
const total = ref(0);
const pagination = reactive({ current: 1, pageSize: 20 });
const query = reactive({ res_name: '' });
const previewOpen = ref(false);
const videoUrl = ref('');

const selectedKeys = computed(() => selected.value.map((item) => item.id));

const columns = [
  { fixed: 'left', type: 'checkbox', width: 46 },
  { field: 'id', title: 'ID', width: 80 },
  { field: 'cover', slots: { default: 'cover' }, title: '封面', width: 90 },
  { field: 'res_name', title: '资源名称', width: 220 },
  { field: 'res_type', title: '类型', width: 90 },
  { field: 'lang', title: '语言', width: 90 },
  { field: 'action', slots: { default: 'action' }, title: '操作', width: 90 },
];

const selectedColumns = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'res_name', title: '资源名称' },
  {
    field: 'action',
    slots: { default: 'selectedAction' },
    title: '操作',
    width: 150,
  },
];

const [Grid, gridApi] = useVbenVxeGrid<ResRecord>({
  gridEvents: {
    checkboxAll: updateSelected,
    checkboxChange: updateSelected,
    pageChange: ({
      currentPage,
      pageSize,
    }: {
      currentPage: number;
      pageSize: number;
    }) => {
      pagination.current = currentPage;
      pagination.pageSize = pageSize;
      void load();
    },
  },
  gridOptions: {
    checkboxConfig: { reserve: true },
    columns,
    height: 520,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<ResRecord>,
});

const [SelectedGrid, selectedGridApi] = useVbenVxeGrid<ResRecord>({
  gridOptions: {
    columns: selectedColumns,
    height: 570,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<ResRecord>,
});

watch(selected, (value) => void selectedGridApi.grid.reloadData(value), {
  deep: true,
});

function clean(values: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

function normalize(payload: any): ResRecord[] {
  return Array.isArray(payload) ? payload : (payload?.items ?? []);
}

function mergeSelectedByIds(
  ids: Array<number | string>,
  candidates: ResRecord[],
) {
  const map = new Map(candidates.map((item) => [String(item.id), item]));
  selected.value = ids.map((id) => {
    const row = map.get(String(id));
    return row ?? ({ id, res_name: `资源 ${id}` } as ResRecord);
  });
}

async function load() {
  loading.value = true;
  gridApi.setLoading(true);
  try {
    const payload = await getList(
      clean({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: query.res_name.trim(),
      }),
    );
    const items = normalize(payload);
    rows.value = items;
    total.value = Number(payload?.total ?? items.length);
    const missingSelected = selected.value.filter(
      (item) => !items.some((row) => String(row.id) === String(item.id)),
    );
    selected.value = [
      ...missingSelected,
      ...items.filter((row) =>
        selectedKeys.value.map(String).includes(String(row.id)),
      ),
    ];
    gridApi.setGridOptions({
      pagerConfig: {
        currentPage: pagination.current,
        pageSize: pagination.pageSize,
        total: total.value,
      },
    });
    await gridApi.grid.reloadData(rows.value);
    await nextTick();
    const selectedOnPage = rows.value.filter((row) =>
      selectedKeys.value.map(String).includes(String(row.id)),
    );
    await gridApi.grid.setCheckboxRow(selectedOnPage, true);
  } finally {
    loading.value = false;
    gridApi.setLoading(false);
  }
}

function updateSelected() {
  const currentIds = new Set(rows.value.map((row) => String(row.id)));
  const checkedRows = gridApi.grid.getCheckboxRecords();
  selected.value = [
    ...selected.value.filter((row) => !currentIds.has(String(row.id))),
    ...checkedRows,
  ];
}

function remove(row: ResRecord) {
  selected.value = selected.value.filter(
    (item) => String(item.id) !== String(row.id),
  );
}

function move(row: ResRecord, offset: number) {
  const index = selected.value.findIndex(
    (item) => String(item.id) === String(row.id),
  );
  const next = index + offset;
  if (index === -1 || next < 0 || next >= selected.value.length) return;
  const list = [...selected.value];
  const [item] = list.splice(index, 1);
  if (!item) return;
  list.splice(next, 0, item);
  selected.value = list;
}

async function preview(row: ResRecord) {
  try {
    const list = await getChapterListNoLangNoPage({ res_id: row.id });
    const first = (Array.isArray(list) ? list : []).find(
      (item: ResChapter) =>
        item.play_url || item.url || item.video_url || item.file_url,
    );
    videoUrl.value =
      first?.play_url ||
      first?.url ||
      first?.video_url ||
      first?.file_url ||
      '';
    previewOpen.value = true;
    if (!videoUrl.value) message.warning('没有可播放地址');
  } catch (error) {
    message.error(String((error as Error)?.message ?? error));
  }
}

function close() {
  emit('update:open', false);
}

function submit() {
  emit(
    'save',
    selected.value.map((item) => item.id),
  );
  close();
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    mergeSelectedByIds(props.selectedIds, []);
    pagination.current = 1;
    await load();
    mergeSelectedByIds(props.selectedIds, [...selected.value, ...rows.value]);
  },
);
</script>

<template>
  <Modal
    destroy-on-close
    :open="open"
    title="选择资源"
    width="1100px"
    @cancel="close"
    @ok="submit"
  >
    <div class="source-picker">
      <div>
        <Form class="mb-3" layout="inline">
          <FormItem label="名称">
            <Input
              v-model:value="query.res_name"
              allow-clear
              placeholder="资源名称"
              @press-enter="load"
            />
          </FormItem>
          <FormItem>
            <Button type="primary" @click="load">查询</Button>
          </FormItem>
        </Form>
        <Grid>
          <template #cover="{ row }">
            <Image v-if="row.cover" :height="48" :src="row.cover" />
          </template>
          <template #action="{ row }">
            <Button size="small" type="link" @click="preview(row)">
              播放
            </Button>
          </template>
        </Grid>
      </div>

      <div>
        <div class="mb-3 font-medium">已选：{{ selected.length }} 项</div>
        <SelectedGrid>
          <template #selectedAction="{ row, rowIndex }">
            <Space>
              <Button
                :disabled="rowIndex === 0"
                size="small"
                type="link"
                @click="move(row, -1)"
              >
                上移
              </Button>
              <Button
                :disabled="rowIndex === selected.length - 1"
                size="small"
                type="link"
                @click="move(row, 1)"
              >
                下移
              </Button>
              <Button danger size="small" type="link" @click="remove(row)">
                删除
              </Button>
            </Space>
          </template>
        </SelectedGrid>
      </div>
    </div>

    <Modal
      v-model:open="previewOpen"
      :footer="null"
      title="资源预览"
      width="760px"
    >
      <video
        v-if="videoUrl"
        class="preview-video"
        controls
        :src="videoUrl"
      ></video>
      <div v-else class="text-center text-muted-foreground">暂无可播放地址</div>
    </Modal>
  </Modal>
</template>

<style scoped>
.source-picker {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
}

.preview-video {
  width: 100%;
  max-height: 520px;
  background: #000;
}
</style>
