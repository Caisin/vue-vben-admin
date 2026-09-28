<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type {
  DownloadGrant,
  DownloadGrantWrite,
  DownloadUserOption,
} from '#/api/res/downloads';
import type { ResRecord } from '#/api/res/seas/global/source_manage';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
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
import { global } from '#/api/res/seas';
import { requestErrorMessage } from '#/request-errors';

const rows = ref<DownloadGrant[]>([]);
const users = ref<DownloadUserOption[]>([]);
const resources = ref<ResRecord[]>([]);
const grantUserOptions = ref<Array<{ label: string; value: number }>>([]);
const userSearching = ref(false);
let userSearchRevision = 0;
const loading = ref(false);
const editorOpen = ref(false);
const editing = ref(false);
const saving = ref(false);
const saveError = ref('');
const formResId = ref<number>();
const resourceOptions = computed(() =>
  resources.value.map((resource) => ({
    label: `${resource.res_name}（${resource.id}）`,
    value: Number(resource.id),
  })),
);
const filters = reactive<{ resId?: number; uid?: number }>({});
const form = reactive<DownloadGrantWrite>({
  uid: 0,
  can_download: true,
  valid_from: 0,
  valid_until: 0,
});
const grantUid = computed({
  get: () => form.uid || undefined,
  set: (value: number | string | undefined) => {
    form.uid = value ?? 0;
  },
});

async function searchGrantUsers(keyword = '') {
  const revision = ++userSearchRevision;
  userSearching.value = true;
  try {
    const result = await ResDownloadApi.users({
      page: 1,
      size: 50,
      keyword: keyword.trim() || undefined,
    });
    if (revision !== userSearchRevision) return;
    const selected = grantUserOptions.value.find(
      (option) => String(option.value) === String(form.uid),
    );
    const options = result.items.map((user) => ({
      label: `${user.name}（${user.id}）`,
      value: Number(user.id),
    }));
    if (
      selected &&
      !options.some((option) => String(option.value) === String(selected.value))
    )
      options.unshift(selected);
    grantUserOptions.value = options;
  } catch (error) {
    if (revision === userSearchRevision)
      message.error(requestErrorMessage(error, '搜索授权用户失败'));
  } finally {
    if (revision === userSearchRevision) userSearching.value = false;
  }
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
  { title: '剧名', dataIndex: 'res_name', key: 'res_name' },
  { title: '资源 ID', dataIndex: 'res_id', key: 'res_id' },
  { title: '用户', dataIndex: 'user_name', key: 'user_name' },
  { title: '用户 ID', dataIndex: 'uid', key: 'uid' },
  { title: '生效时间', dataIndex: 'valid_from', key: 'valid_from' },
  { title: '失效时间', dataIndex: 'valid_until', key: 'valid_until' },
  { title: '状态', dataIndex: 'can_download', key: 'can_download' },
  { title: '操作', key: 'action' },
];

async function loadOptions() {
  const [userPage, resourceList] = await Promise.all([
    ResDownloadApi.users({ page: 1, size: 500 }),
    global.source_manage.getListAll({}),
  ]);
  users.value = userPage.items;
  grantUserOptions.value = userPage.items.map((user) => ({
    label: `${user.name}（${user.id}）`,
    value: Number(user.id),
  }));
  resources.value = resourceList;
}
async function query() {
  loading.value = true;
  try {
    if (filters.resId) {
      const result = await ResDownloadApi.grants(filters.resId, {
        page: 1,
        size: 500,
        uid: filters.uid,
      });
      rows.value = result.items;
    } else {
      const result = await ResDownloadApi.allGrants({
        page: 1,
        size: 500,
        uid: filters.uid,
      });
      rows.value = result.items;
    }
  } finally {
    loading.value = false;
  }
}
function create() {
  if (saving.value) return;
  editing.value = false;
  formResId.value = filters.resId;
  Object.assign(form, {
    uid: filters.uid ?? 0,
    can_download: true,
    valid_from: 0,
    valid_until: 0,
  });
  saveError.value = '';
  editorOpen.value = true;
}
function edit(row: DownloadGrant) {
  if (saving.value) return;
  if (
    !resources.value.some(
      (resource) => String(resource.id) === String(row.res_id),
    )
  ) {
    resources.value.push({ id: row.res_id, res_name: row.res_name });
  }
  if (
    !grantUserOptions.value.some(
      (option) => String(option.value) === String(row.uid),
    )
  ) {
    grantUserOptions.value.unshift({
      label: `${row.user_name}（${row.uid}）`,
      value: Number(row.uid),
    });
  }
  Object.assign(form, {
    uid: Number(row.uid),
    can_download: row.can_download,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
  });
  formResId.value = Number(row.res_id);
  editing.value = true;
  saveError.value = '';
  editorOpen.value = true;
}
async function save() {
  if (saving.value) return;
  saveError.value = '';
  if (!formResId.value || !form.uid) {
    saveError.value = '请选择剧目和授权用户';
    return;
  }
  if (form.valid_until > 0 && form.valid_until <= form.valid_from) {
    saveError.value = '失效时间必须晚于生效时间';
    return;
  }
  saving.value = true;
  try {
    await ResDownloadApi.saveGrants(formResId.value, [{ ...form }]);
    editorOpen.value = false;
    message.success('授权已保存');
  } catch (error) {
    saveError.value = requestErrorMessage(error, '保存授权失败，请重试');
    return;
  } finally {
    saving.value = false;
  }
  try {
    await query();
  } catch (error) {
    message.error(
      requestErrorMessage(error, '授权已保存，刷新列表失败，请重新查询'),
    );
  }
}
async function revoke(row: DownloadGrant) {
  await ResDownloadApi.removeGrant(row.res_id, row.uid);
  await query();
}
onMounted(async () => {
  await loadOptions();
  await query();
});
</script>

<template>
  <Page auto-content-height title="授权维护">
    <div class="mb-4 rounded border p-4">
      <Form layout="inline">
        <FormItem label="剧目">
          <Select
            v-model:value="filters.resId"
            allow-clear
            show-search
            :options="
              resources.map((r) => ({
                label: `${r.res_name}（${r.id}）`,
                value: Number(r.id),
              }))
            "
            placeholder="按剧目查看授权用户"
          />
        </FormItem>
        <FormItem label="用户">
          <Select
            v-model:value="filters.uid"
            allow-clear
            show-search
            :options="
              users.map((u) => ({
                label: `${u.name}（${u.id}）`,
                value: Number(u.id),
              }))
            "
            placeholder="按用户查看已授权剧目"
          />
        </FormItem>
        <Button type="primary" :loading="loading" @click="query">查询</Button>
        <Button @click="create">新增授权</Button>
      </Form>
    </div>
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
        <Button
          v-if="column.key === 'action'"
          type="link"
          @click="edit(record)"
        >
          编辑
        </Button>
        <Button
          v-if="column.key === 'action'"
          danger
          type="link"
          @click="revoke(record)"
        >
          撤销
        </Button>
      </template>
    </Table>
    <Modal
      v-model:open="editorOpen"
      :title="editing ? '编辑授权' : '新增授权'"
      ok-text="保存授权"
      cancel-text="取消"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :cancel-button-props="{ disabled: saving }"
      :width="560"
      @ok="save"
    >
      <Alert
        v-if="saveError"
        :message="saveError"
        type="error"
        show-icon
        class="mb-4"
      />
      <Form layout="vertical" :disabled="saving">
        <FormItem label="剧目" required>
          <Select
            v-model:value="formResId"
            show-search
            option-filter-prop="label"
            :options="resourceOptions"
            :disabled="editing || saving"
            placeholder="选择授权剧目"
          />
        </FormItem>
        <FormItem label="授权用户" required>
          <Select
            v-model:value="grantUid"
            :disabled="editing || saving"
            allow-clear
            show-search
            :filter-option="false"
            :loading="userSearching"
            :options="grantUserOptions"
            placeholder="搜索姓名、手机号或邮箱选择用户"
            class="min-w-72"
            @search="searchGrantUsers"
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
      </Form>
    </Modal>
  </Page>
</template>
