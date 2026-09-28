<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { DownloadGrant, DownloadGrantWrite } from '#/api/res/downloads';

import { computed, reactive, ref, watch } from 'vue';

import {
  Button,
  DatePicker,
  Form,
  FormItem,
  message,
  Modal,
  Select,
  Switch,
  Table,
} from 'antdv-next';
import dayjs from 'dayjs';

import { ResDownloadApi } from '#/api/res/downloads';

const props = defineProps<{ resId?: number | string }>();
const open = defineModel<boolean>('open', { required: true });
const rows = ref<DownloadGrant[]>([]);
const loading = ref(false);
const userOptions = ref<Array<{ label: string; value: number }>>([]);
const form = reactive({
  uid: undefined as number | undefined,
  valid_from: 0,
  valid_until: 0,
  can_download: true,
});
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
    if (open.value && props.resId) void refresh();
  },
);
async function refresh() {
  if (!props.resId) return;
  loading.value = true;
  try {
    const [grants, users] = await Promise.all([
      ResDownloadApi.grants(props.resId, { page: 1, size: 100 }),
      ResDownloadApi.users({ page: 1, size: 200 }),
    ]);
    rows.value = grants.items;
    userOptions.value = users.items.map((user) => ({
      label: `${user.name}（${user.id}）`,
      value: Number(user.id),
    }));
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!props.resId || !form.uid) return;
  const grant: DownloadGrantWrite = {
    uid: form.uid,
    can_download: form.can_download,
    valid_from: form.valid_from,
    valid_until: form.valid_until,
  };
  if (form.valid_until > 0 && form.valid_until <= form.valid_from) {
    message.error('失效时间必须晚于生效时间');
    return;
  }
  await ResDownloadApi.saveGrants(props.resId, [grant]);
  Object.assign(form, {
    uid: undefined,
    valid_from: 0,
    valid_until: 0,
    can_download: true,
  });
  message.success('下载权限已保存');
  await refresh();
}
function edit(row: DownloadGrant) {
  Object.assign(form, {
    uid: Number(row.uid),
    valid_from: Number(row.valid_from),
    valid_until: Number(row.valid_until),
    can_download: row.can_download,
  });
}
async function remove(uid: number | string) {
  if (!props.resId) return;
  await ResDownloadApi.removeGrant(props.resId, uid);
  await refresh();
}
</script>

<template>
  <Modal v-model:open="open" title="资源下载权限" :footer="null" width="760px">
    <Form layout="inline" class="mb-4" @submit.prevent="save">
      <FormItem label="指定用户">
        <Select
          v-model:value="form.uid"
          show-search
          :options="userOptions"
          placeholder="选择用户"
        />
      </FormItem>
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
      <Button type="primary" :disabled="!form.uid" @click="save">
        保存授权
      </Button>
    </Form>
    <Table
      :loading="loading"
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'valid_from'">{{
          formatTime(record.valid_from, '立即生效')
        }}</span>
        <span v-if="column.key === 'valid_until'">{{
          formatTime(record.valid_until, '永久有效')
        }}</span>
        <template v-if="column.key === 'action'">
          <Button type="link" @click="edit(record)">编辑</Button>
          <Button danger type="link" @click="remove(record.uid)">撤销</Button>
        </template>
      </template>
    </Table>
  </Modal>
</template>
