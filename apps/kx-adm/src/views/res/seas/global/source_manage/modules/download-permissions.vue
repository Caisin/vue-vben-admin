<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type {
  DownloadGrant,
  DownloadGrantWrite,
  DownloadUserTreeNode,
} from '#/api/res/downloads';

import { computed, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormItem,
  message,
  Modal,
  Switch,
  Table,
} from 'antdv-next';
import dayjs from 'dayjs';

import { ResDownloadApi } from '#/api/res/downloads';
import { requestErrorMessage } from '#/request-errors';

import UserTreeSelect from '../../../download-authorizations/modules/user-tree-select.vue';

const props = defineProps<{ resId?: number | string }>();
const open = defineModel<boolean>('open', { required: true });
const rows = ref<DownloadGrant[]>([]);
const loading = ref(false);
const saving = ref(false);
const feedback = ref('');
const userTree = ref<DownloadUserTreeNode[]>([]);
const treeLoading = ref(false);
const treeError = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = 20;
const form = reactive({
  uids: [] as number[],
  valid_from: 0,
  valid_until: 0,
  can_download: true,
});
function resetForm() {
  Object.assign(form, {
    uids: [],
    valid_from: 0,
    valid_until: 0,
    can_download: true,
  });
}
function timeField(field: 'valid_from' | 'valid_until') {
  return computed({
    get: () =>
      Number(form[field]) > 0 ? dayjs.unix(Number(form[field])) : null,
    set: (value: Dayjs | null | undefined) => {
      form[field] = value?.isValid() ? value.unix() : 0;
    },
  });
}
const validFrom = timeField('valid_from');
const validUntil = timeField('valid_until');
function formatTime(value: number | string, emptyLabel: string) {
  return Number(value) > 0
    ? dayjs.unix(Number(value)).format('YYYY-MM-DD HH:mm:ss')
    : emptyLabel;
}

const columns = [
  { title: '用户', dataIndex: 'user_name', key: 'user_name' },
  { title: '用户 ID', dataIndex: 'uid', key: 'uid' },
  { title: '生效时间', dataIndex: 'valid_from', key: 'valid_from' },
  { title: '失效时间', dataIndex: 'valid_until', key: 'valid_until' },
  { title: '状态', dataIndex: 'can_download', key: 'can_download' },
  { title: '操作', key: 'action' },
];
watch(
  () => [open.value, props.resId] as const,
  () => {
    if (open.value && props.resId) {
      resetForm();
      page.value = 1;
      rows.value = [];
      feedback.value = '';
      void refresh();
      void loadUserTree();
    }
  },
);
async function loadUserTree() {
  if (treeLoading.value) return;
  treeLoading.value = true;
  treeError.value = '';
  try {
    userTree.value = await ResDownloadApi.userTree();
  } catch (error) {
    treeError.value = requestErrorMessage(error, '加载用户组织树失败');
  } finally {
    treeLoading.value = false;
  }
}
async function refresh() {
  if (!props.resId) return;
  const resId = props.resId;
  loading.value = true;
  try {
    const grants = await ResDownloadApi.grants(resId, {
      page: page.value,
      size: pageSize,
    });
    if (props.resId !== resId || !open.value) return;
    rows.value = grants.items;
    total.value = grants.total;
  } catch (error) {
    feedback.value = requestErrorMessage(error, '加载授权记录失败，请重试');
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (
    !props.resId ||
    form.uids.length === 0 ||
    saving.value ||
    treeLoading.value ||
    treeError.value
  )
    return;
  const grants: DownloadGrantWrite[] = [...new Set(form.uids)].map((uid) => ({
    uid: Number(uid),
    can_download: form.can_download,
    valid_from: form.valid_from,
    valid_until: form.valid_until,
  }));
  if (form.valid_until > 0 && form.valid_until <= form.valid_from) {
    message.error('失效时间必须晚于生效时间');
    return;
  }
  saving.value = true;
  feedback.value = '';
  try {
    await ResDownloadApi.saveGrants(props.resId, grants);
    resetForm();
    message.success(`已保存 ${grants.length} 位用户的下载权限`);
    page.value = 1;
    await refresh();
  } catch (error) {
    feedback.value = requestErrorMessage(error, '保存下载权限失败，请重试');
  } finally {
    saving.value = false;
  }
}
function edit(row: DownloadGrant) {
  feedback.value = '';
  Object.assign(form, {
    uids: [Number(row.uid)],
    valid_from: Number(row.valid_from),
    valid_until: Number(row.valid_until),
    can_download: row.can_download,
  });
}
async function remove(uid: number | string) {
  if (!props.resId || saving.value) return;
  saving.value = true;
  feedback.value = '';
  try {
    await ResDownloadApi.removeGrant(props.resId, uid);
    message.success('下载权限已撤销');
    if (rows.value.length === 1 && page.value > 1) page.value -= 1;
    await refresh();
  } catch (error) {
    feedback.value = requestErrorMessage(error, '撤销下载权限失败，请重试');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    title="资源下载权限"
    :footer="null"
    width="760px"
    :closable="!saving"
    :mask-closable="!saving"
    :keyboard="!saving"
  >
    <Alert
      v-if="feedback"
      :message="feedback"
      type="error"
      class="mb-3"
      show-icon
    />
    <Form
      layout="vertical"
      class="mb-4"
      :disabled="saving"
      @submit.prevent="save"
    >
      <FormItem label="指定用户" html-for="resource-download-users" required>
        <UserTreeSelect
          id="resource-download-users"
          v-model:value="form.uids"
          :tree-data="userTree"
          :loading="treeLoading"
          :error="treeError"
          :disabled="saving"
          @retry="loadUserTree"
        />
      </FormItem>
      <p class="text-muted-foreground mb-3">
        所选用户使用相同的有效期和下载状态；已有授权按本次设置更新。
      </p>
      <FormItem label="生效时间">
        <DatePicker
          v-model:value="validFrom"
          show-time
          allow-clear
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="留空立即生效"
        />
      </FormItem>
      <FormItem label="失效时间">
        <DatePicker
          v-model:value="validUntil"
          show-time
          allow-clear
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="留空永久有效"
        />
      </FormItem>
      <FormItem label="允许下载">
        <Switch v-model:checked="form.can_download" />
      </FormItem>
      <Button
        type="primary"
        :loading="saving"
        :disabled="!form.uids.length || treeLoading || !!treeError"
        @click="save"
      >
        保存授权{{ form.uids.length ? `（${form.uids.length} 人）` : '' }}
      </Button>
    </Form>
    <Button
      class="mb-2"
      :disabled="saving || loading"
      @click="
        feedback = '';
        refresh();
      "
    >
      刷新授权记录
    </Button>
    <Table
      :loading="loading"
      :columns="columns"
      :data-source="rows"
      :pagination="{ current: page, pageSize, total, showSizeChanger: false }"
      row-key="id"
      @change="
        (pagination) => {
          page = pagination.current ?? 1;
          refresh();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'valid_from'">{{
          formatTime(record.valid_from, '立即生效')
        }}</span>
        <span v-if="column.key === 'valid_until'">{{
          formatTime(record.valid_until, '永久有效')
        }}</span>
        <template v-if="column.key === 'action'">
          <Button type="link" :disabled="saving" @click="edit(record)">
            编辑
          </Button>
          <Button
            danger
            type="link"
            :disabled="saving"
            @click="remove(record.uid)"
          >
            撤销
          </Button>
        </template>
      </template>
    </Table>
  </Modal>
</template>
