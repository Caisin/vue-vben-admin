<script setup lang="ts">
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { ArticleDoc, ArticleThemeView } from '#/api/article';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ArticleApi } from '#/api/article';
import { vxeSortParams } from '#/vxe-sort';

import { themeOptions, useColumns, useGridFormSchema } from './data';
import EditorModal from './modules/editor-modal.vue';
import PreviewModal from './modules/preview-modal.vue';
import ReleaseHistory from './modules/release-history.vue';

const themes = ref<ArticleThemeView[]>([]);
const previewRef = ref<InstanceType<typeof PreviewModal>>();
const historyRef = ref<InstanceType<typeof ReleaseHistory>>();
const creating = ref(false);

const [Editor, editorApi] = useVbenModal({
  connectedComponent: EditorModal,
  destroyOnClose: false,
});

const themeSelectOptions = computed(() => themeOptions(themes.value));

const [Grid, gridApi] = useVbenVxeGrid<ArticleDoc>({
  formOptions: {
    schema: useGridFormSchema(() => themeSelectOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const result = await ArticleApi.list({
            ...formValues,
            ...vxeSortParams(params, [
              'id',
              'title',
              'slug',
              'created_at',
              'updated_at',
              'published_at',
            ]),
            page: params.page.currentPage,
            size: params.page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ArticleDoc>,
});

function refresh() {
  gridApi.query();
}

function onActionClick({ code, row }: OnActionClickParams<ArticleDoc>) {
  if (code === 'preview') void quickPreview(row);
  if (code === 'publish') void publish(row);
  if (code === 'history') historyRef.value?.open(row);
  if (code === 'unpublish') void unpublish(row);
  if (code === 'delete') void remove(row);
}

function edit(row: ArticleDoc) {
  editorApi.setData({ id: row.id }).open();
}

async function quickPreview(row: ArticleDoc) {
  const detail = await ArticleApi.detail(row.id);
  previewRef.value?.open({
    content: detail.content,
    title: `快速预览：${row.title}`,
    type: 'quick',
  });
}

async function publish(row: ArticleDoc) {
  const detail = await ArticleApi.detail(row.id);
  const result = await ArticleApi.publish(row.id, detail.draft_revision);
  message.success(
    result.unchanged ? '当前内容与线上版本一致' : '发布任务已提交',
  );
  refresh();
}

async function unpublish(row: ArticleDoc) {
  await ArticleApi.unpublish(row.id);
  message.success('已取消发布');
  refresh();
}

function remove(row: ArticleDoc) {
  Modal.confirm({
    title: '删除草稿',
    content:
      row.state === 'published'
        ? '已发布文章必须先取消发布后才能删除。'
        : `确认删除「${row.title}」？`,
    async onOk() {
      await ArticleApi.remove(row.id);
      message.success('已删除');
      refresh();
    },
  });
}

async function createArticle() {
  if (creating.value) return;
  creating.value = true;
  try {
    const detail = await ArticleApi.create({ title: '未命名文章' });
    refresh();
    editorApi.setData({ id: detail.id }).open();
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  themes.value = await ArticleApi.themes();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Editor @success="refresh" />
    <PreviewModal ref="previewRef" />
    <ReleaseHistory
      ref="historyRef"
      @restored="
        (row) => {
          refresh();
          editorApi.setData({ id: row.id }).open();
        }
      "
    />
    <header class="page-heading"><h1>文章管理</h1></header>
    <Grid>
      <template #toolbar-tools>
        <Button type="primary" :loading="creating" @click="createArticle">
          <Plus class="size-5" />
          新建文章
        </Button>
      </template>
      <template #titleCell="{ row }">
        <Button type="link" class="px-0" @click="edit(row)">
          {{ row.title }}
        </Button>
        <div class="text-xs text-muted-foreground">
          {{ row.summary || '无摘要' }}
        </div>
      </template>
      <template #slugCell="{ row }">
        <Space direction="vertical" :size="0">
          <span>{{ row.slug ? `/p/${row.slug}` : '首次发布时生成' }}</span>
          <Button
            v-if="row.state === 'published' && row.slug"
            size="small"
            type="link"
            class="px-0"
            :href="`/p/${row.slug}`"
            target="_blank"
          >
            打开公开地址
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
