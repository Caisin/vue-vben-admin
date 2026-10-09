<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type {
  DownloadGrant,
  DownloadGrantWrite,
  DownloadUserTreeNode,
} from '#/api/res/downloads';
import type { ResRecord } from '#/api/res/seas/global/source_manage';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormItem,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
} from 'antdv-next';
import dayjs from 'dayjs';

import { ResDownloadApi } from '#/api/res/downloads';
import { global } from '#/api/res/seas';
import { requestErrorMessage } from '#/request-errors';

import BatchGrant from './modules/batch-grant.vue';
import UserTreeSelect from './modules/user-tree-select.vue';

const { hasAccessByCodes } = useAccess();
const canManage = computed(() =>
  hasAccessByCodes(['res:download:authorize', 'res:content:manage']),
);
const rows = ref<DownloadGrant[]>([]);
const userTree = ref<DownloadUserTreeNode[]>([]);
const userTreeLoading = ref(false);
const userTreeError = ref('');
const resources = ref<ResRecord[]>([]);
const loading = ref(false);
const editorOpen = ref(false);
const batchOpen = ref(false);
const batchRevoke = ref(false);
function openBatch(revoke: boolean) {
  batchRevoke.value = revoke;
  batchOpen.value = true;
}
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
const filters = reactive<{ resId?: number; uids: number[] }>({ uids: [] });
const grantUids = ref<number[]>([]);
const form = reactive<DownloadGrantWrite>({
  uid: 0,
  can_download: true,
  seq_from: 0,
  seq_until: 0,
  valid_from: 0,
  valid_until: 0,
});

async function loadUserTree() {
  if (userTreeLoading.value) return;
  userTreeLoading.value = true;
  userTreeError.value = '';
  try {
    userTree.value = await ResDownloadApi.userTree();
  } catch (error) {
    userTreeError.value = requestErrorMessage(error, '加载用户组织树失败');
  } finally {
    userTreeLoading.value = false;
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
function personName(name: string | undefined, id: number | string | undefined) {
  if (!id || Number(id) <= 0) return '未记录';
  return name && name !== String(id) ? name : '姓名不可用';
}

const columns = [
  { title: '剧名', dataIndex: 'res_name', key: 'res_name' },
  { title: '资源 ID', dataIndex: 'res_id', key: 'res_id' },
  { title: '授权人（最近操作）', key: 'grantor', width: 175 },
  { title: '被授权人', key: 'grantee', width: 175 },
  { title: '授权更新时间', key: 'updated_at', width: 175 },
  { title: '生效时间', dataIndex: 'valid_from', key: 'valid_from' },
  { title: '失效时间', dataIndex: 'valid_until', key: 'valid_until' },
  { title: '状态', dataIndex: 'can_download', key: 'can_download' },
  { title: '操作', key: 'action' },
];

async function loadOptions() {
  const [, resourceList] = await Promise.all([
    loadUserTree(),
    global.source_manage.getListAll({}),
  ]);
  resources.value = resourceList;
}
async function query() {
  loading.value = true;
  try {
    if (filters.resId) {
      const result = await ResDownloadApi.grants(filters.resId, {
        page: 1,
        size: 500,
        uids: filters.uids,
      });
      rows.value = result.items;
    } else {
      const result = await ResDownloadApi.allGrants({
        page: 1,
        size: 500,
        uids: filters.uids,
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
  grantUids.value = [];
  Object.assign(form, {
    uid: 0,
    can_download: true,
    seq_from: 0,
    seq_until: 0,
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
  Object.assign(form, {
    uid: Number(row.uid),
    can_download: row.can_download,
    seq_from: row.seq_from,
    seq_until: row.seq_until,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
  });
  grantUids.value = [Number(row.uid)];
  formResId.value = Number(row.res_id);
  editing.value = true;
  saveError.value = '';
  editorOpen.value = true;
}
async function save() {
  if (saving.value) return;
  saveError.value = '';
  if (!formResId.value || grantUids.value.length === 0) {
    saveError.value = '请选择剧目和授权用户';
    return;
  }
  if (form.valid_until > 0 && form.valid_until <= form.valid_from) {
    saveError.value = '失效时间必须晚于生效时间';
    return;
  }
  if (
    form.seq_from < 0 ||
    form.seq_until < 0 ||
    (form.seq_from > 0 && form.seq_until > 0 && form.seq_until < form.seq_from)
  ) {
    saveError.value = '集数范围无效';
    return;
  }
  saving.value = true;
  try {
    await ResDownloadApi.saveGrants(
      formResId.value,
      grantUids.value.map((uid) => ({ ...form, uid })),
    );
    editorOpen.value = false;
    message.success(`已保存 ${grantUids.value.length} 位用户的授权`);
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
async function refreshAfterBatch() {
  try {
    await query();
  } catch (error) {
    message.error(
      requestErrorMessage(error, '授权已保存，刷新列表失败，请重新查询'),
    );
  }
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
        <FormItem label="用户" html-for="filter-grant-user">
          <UserTreeSelect
            id="filter-grant-user"
            allow-disabled
            v-model:value="filters.uids"
            :tree-data="userTree"
            :loading="userTreeLoading"
            :error="userTreeError"
            @retry="loadUserTree"
          />
        </FormItem>
        <Button type="primary" :loading="loading" @click="query">查询</Button>
        <Button v-if="canManage" @click="create">新增授权</Button>
        <Button v-if="canManage" @click="openBatch(false)">批量授权</Button>
        <Button v-if="canManage" danger @click="openBatch(true)">
          批量取消授权
        </Button>
      </Form>
    </div>
    <Table
      :loading="loading"
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 1300 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'grantor'">
          <div>{{ personName(record.granted_by_name, record.granted_by) }}</div>
          <div
            v-if="Number(record.granted_by) > 0"
            class="text-muted-foreground text-xs"
          >
            ID：{{ record.granted_by }}
          </div>
        </template>
        <template v-if="column.key === 'grantee'">
          <div>{{ personName(record.user_name, record.uid) }}</div>
          <div class="text-muted-foreground text-xs">ID：{{ record.uid }}</div>
        </template>
        <span v-if="column.key === 'updated_at'">{{
          formatTime(record.updated_at, '未记录')
        }}</span>
        <span v-if="column.key === 'valid_from'">{{
          formatTime(record.valid_from, '立即生效')
        }}</span>
        <span v-if="column.key === 'valid_until'">{{
          formatTime(record.valid_until, '永久有效')
        }}</span>
        <Button
          v-if="canManage && column.key === 'action'"
          type="link"
          @click="edit(record)"
        >
          编辑
        </Button>
        <Button
          v-if="canManage && column.key === 'action'"
          danger
          type="link"
          @click="revoke(record)"
        >
          撤销
        </Button>
      </template>
    </Table>
    <BatchGrant
      v-model:open="batchOpen"
      :revoke="batchRevoke"
      :initial-uids="filters.uids"
      :user-tree="userTree"
      :user-tree-loading="userTreeLoading"
      :user-tree-error="userTreeError"
      @retry="loadUserTree"
      @saved="refreshAfterBatch"
    />
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
        <FormItem label="授权用户" html-for="single-grant-user" required>
          <UserTreeSelect
            id="single-grant-user"
            v-model:value="grantUids"
            :tree-data="userTree"
            :loading="userTreeLoading"
            :error="userTreeError"
            :disabled="saving"
            @retry="loadUserTree"
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
        <Space>
          <FormItem label="起始集数">
            <InputNumber
              v-model:value="form.seq_from"
              :min="0"
              :precision="0"
              placeholder="0=不限"
            />
          </FormItem>
          <FormItem label="结束集数">
            <InputNumber
              v-model:value="form.seq_until"
              :min="0"
              :precision="0"
              placeholder="0=不限"
            />
          </FormItem>
        </Space>
        <FormItem label="允许下载">
          <Switch v-model:checked="form.can_download" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
