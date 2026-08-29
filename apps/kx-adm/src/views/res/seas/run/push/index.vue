<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ResChapter } from '#/api/res/seas/global/source_manage';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, InputNumber, message, Modal, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { defHttp } from '#/api/res/legacy-http';
import { getChapterListNoLangNoPage } from '#/api/res/seas/global/source_manage';
import { getPageList, refreshPage } from '#/api/res/seas/run/push';

import { useColumns, useGridFormSchema } from './data';
import PushModal from './Modal.vue';

defineOptions({ name: 'PushManage' });

const router = useRouter();
const modalOpen = ref(false);
const modalMode = ref<'edit' | 'test'>('edit');
const activeRecord = ref<null | Record<string, any>>(null);
const previewOpen = ref(false);
const videoUrl = ref('');
const sendChannelId = ref<number>();

const [Grid, gridApi] = useVbenVxeGrid({
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
        query: async ({ page }, formValues) =>
          getPageList({
            ...formValues,
            page: page.currentPage,
            size: page.pageSize,
            title: formValues.title?.trim() || undefined,
          }),
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
  } as VxeTableGridOptions,
});

function formatTime(value?: number | string) {
  if (!value) return '-';
  const numeric = Number(value);
  if (Number.isFinite(numeric))
    return new Date(numeric * 1000).toLocaleString();
  return String(value);
}

function openCreate() {
  activeRecord.value = null;
  modalMode.value = 'edit';
  modalOpen.value = true;
}

function openEdit(record: Record<string, any>) {
  activeRecord.value = record;
  modalMode.value = 'edit';
  modalOpen.value = true;
}

function openTest(record: Record<string, any>) {
  activeRecord.value = record;
  modalMode.value = 'test';
  modalOpen.value = true;
}

async function preview(record: Record<string, any>) {
  try {
    const list = await getChapterListNoLangNoPage({ res_id: record.res_id });
    const chapters = Array.isArray(list) ? list : [];
    const target =
      chapters.find(
        (item: ResChapter) => String(item.id) === String(record.item_id),
      ) ?? chapters[0];
    videoUrl.value =
      target?.play_url ||
      target?.url ||
      target?.video_url ||
      target?.file_url ||
      record.play_url ||
      '';
    previewOpen.value = true;
    if (!videoUrl.value) message.warning('该剧没有可预览播放地址');
  } catch (error) {
    message.error(String((error as Error)?.message ?? error));
  }
}

async function send(record: Record<string, any>) {
  if (!sendChannelId.value) {
    message.warning('请先填写 Notify Push 通道 ID');
    return;
  }
  await defHttp.post({
    data: { channel_id: Number(sendChannelId.value) },
    url: `/adm/app_push/send/${record.id}`,
  });
  message.success('推送任务已提交');
  await gridApi.query();
}

async function test(payload: Record<string, any>) {
  await defHttp.post({
    data: {
      channel_id: Number(payload.channel_id),
      endpoint_id: payload.endpoint_id
        ? Number(payload.endpoint_id)
        : undefined,
    },
    url: `/adm/app_push/send_test/${payload.id}/${payload.uid}`,
  });
  message.success('测试推送已提交');
}

async function refreshCache() {
  await refreshPage('app_push');
  message.success('推送缓存已刷新');
}

function toRecord(record: Record<string, any>) {
  router.push({
    path: '/res/seas/run/push/record',
    query: { id: record.id },
  });
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="推送管理"
  >
    <Grid class="management-grid" table-title="推送管理">
      <template #toolbar-tools>
        <Space>
          <InputNumber
            v-model:value="sendChannelId"
            class="w-48"
            placeholder="Notify Push 通道 ID"
          />
          <Button @click="refreshCache">刷新缓存</Button>
          <Button type="primary" @click="openCreate">
            <Plus class="size-5" />
            新增推送
          </Button>
        </Space>
      </template>
      <template #state="{ row }">
        <Tag :color="row.state === 1 ? 'success' : 'warning'">
          {{ row.state === 1 ? '已推送' : '未推送' }}
        </Tag>
      </template>
      <template #time="{ row, column }">
        {{ formatTime(row[column.field]) }}
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:play',
              onClick: () => preview(row),
              text: '剧预览',
            },
            {
              disabled: row.state === 1,
              icon: 'lucide:edit',
              onClick: () => openEdit(row),
              text: '编辑',
            },
          ]"
          :dropdown-actions="[
            {
              icon: 'lucide:send',
              onClick: () => openTest(row),
              text: '测试推送',
            },
            {
              disabled: row.state === 1,
              icon: 'lucide:send-horizontal',
              popConfirm: {
                confirm: () => send(row),
                title: '确认发送该推送？',
              },
              text: '发送',
            },
            {
              icon: 'lucide:history',
              onClick: () => toRecord(row),
              text: '记录',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <PushModal
      v-model:open="modalOpen"
      :mode="modalMode"
      :record="activeRecord"
      @saved="gridApi.query"
      @test="test"
    />

    <Modal
      v-model:open="previewOpen"
      :footer="null"
      title="剧预览"
      width="760px"
    >
      <video
        v-if="videoUrl"
        class="max-h-[520px] w-full bg-black"
        controls
        :src="videoUrl"
      ></video>
      <div v-else class="text-center text-muted-foreground">暂无可播放地址</div>
    </Modal>
  </Page>
</template>
