<script setup lang="ts">
import type { TableProps } from 'antdv-next';

import type { ArticleDoc, ArticleRelease } from '#/api/article';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Popconfirm, Space, Table, Tag } from 'antdv-next';

import { ArticleApi } from '#/api/article';
import { Times } from '#/times';

const emit = defineEmits<{ restored: [article: ArticleDoc] }>();
const article = ref<ArticleDoc>();
const records = ref<ArticleRelease[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const columns: TableProps<ArticleRelease>['columns'] = [
  { dataIndex: 'release_no', title: '版本', width: 80 },
  { dataIndex: 'title', title: '标题' },
  { dataIndex: 'theme_code', title: '主题', width: 120 },
  { dataIndex: 'visibility', title: '访问', width: 90 },
  { dataIndex: 'published_at', title: '发布时间', width: 180 },
  { key: 'actions', title: '操作', width: 150 },
];

const [Modal, modalApi] = useVbenModal({
  class: 'w-[min(980px,calc(100vw-20px))]',
  destroyOnClose: false,
  showConfirmButton: false,
});

async function load() {
  if (!article.value) return;
  loading.value = true;
  try {
    const result = await ArticleApi.releases(article.value.id, {
      page: page.value,
      size: pageSize.value,
      state: 'published',
    });
    records.value = result.items;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function restore(row: ArticleRelease) {
  if (!article.value) return;
  const detail = await ArticleApi.restore(article.value.id, row.id);
  message.success('已恢复为草稿，请确认后重新发布');
  emit('restored', detail);
  modalApi.close();
}

function open(row: ArticleDoc) {
  article.value = row;
  page.value = 1;
  modalApi.setState({ title: `发布记录：${row.title}` });
  modalApi.open();
  void load();
}

defineExpose({ open });
</script>

<template>
  <Modal>
    <Table
      :columns="columns"
      :data-source="records"
      :loading="loading"
      :pagination="{ current: page, pageSize, total, showSizeChanger: true }"
      row-key="id"
      size="small"
      @change="
        (pager) => {
          page = Number(pager.current ?? 1);
          pageSize = Number(pager.pageSize ?? 10);
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'visibility'">
          <Tag :color="record.visibility === 'public' ? 'success' : 'warning'">
            {{ record.visibility === 'public' ? '公开' : '密码' }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'published_at'">
          {{ Times.formatOptionalUnix(record.published_at) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <Space>
            <Button
              v-if="record.html_url"
              size="small"
              type="link"
              :href="record.html_url"
              target="_blank"
            >
              打开
            </Button>
            <Popconfirm
              title="将该版本恢复为当前草稿？"
              @confirm="restore(record)"
            >
              <Button size="small" type="link">恢复</Button>
            </Popconfirm>
          </Space>
        </template>
      </template>
    </Table>
  </Modal>
</template>
