<script setup lang="ts">
import type { CompanyManager, OrgSyncSource } from '#/api/auth/org-sync';

import { onMounted, ref } from 'vue';

import { Button, Input, message, Select, Space, Table } from 'antdv-next';

import { AdminUserApi } from '#/api/auth/admin';
import { OrgSyncApi } from '#/api/auth/org-sync';

import PopupModal from './popup-modal.vue';

const props = defineProps<{ source: OrgSyncSource }>();
const emit = defineEmits<{ close: [] }>();
const sourceId = props.source.code.slice(props.source.code.indexOf(':') + 1);
const managers = ref<CompanyManager[]>([]);
const options = ref<Array<{ label: string; value: number | string }>>([]);
const keyword = ref('');
const selected = ref<number | string>();
const busy = ref(false);
const loading = ref(false);
const columns = [
  { title: '系统账号', dataIndex: 'name', key: 'name' },
  { title: '操作', key: 'action', width: 100 },
];
async function search() {
  loading.value = true;
  try {
    const page = await AdminUserApi.list({
      keyword: keyword.value.trim() || undefined,
      enabled: true,
      size: 50,
      page: 1,
    });
    options.value = page.items.map((u) => ({
      label: `${u.name} (#${u.id})`,
      value: u.id,
    }));
  } finally {
    loading.value = false;
  }
}
async function reload() {
  managers.value = await OrgSyncApi.companyManagers(sourceId);
}
async function grant() {
  if (!selected.value) return;
  busy.value = true;
  try {
    await OrgSyncApi.grantCompany(sourceId, selected.value);
    await reload();
    selected.value = undefined;
    message.success('已授予该公司全部人员的数据范围');
  } finally {
    busy.value = false;
  }
}
async function revoke(uid: number | string) {
  busy.value = true;
  try {
    await OrgSyncApi.revokeCompany(sourceId, uid);
    await reload();
    message.success('已撤销公司数据范围');
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  await Promise.all([reload(), search()]);
});
</script>
<template>
  <PopupModal
    :open="true"
    :title="`${source.name} · 公司数据权限`"
    :footer="null"
    :width="720"
    @cancel="emit('close')"
  >
    <p class="mb-4">
      授权账号可访问此公司下所有人员的数据，包括后续新增人员。具体页面和操作仍受角色权限控制。
    </p>
    <Space class="mb-3" wrap>
      <Input
        v-model:value="keyword"
        placeholder="搜索系统账号"
        @press-enter="search"
      />
      <Button :loading="loading" @click="search">搜索</Button>
    </Space>
    <Space class="mb-4" wrap>
      <Select
        v-model:value="selected"
        :options="options"
        :loading="loading"
        class="w-80"
        placeholder="选择授权的系统账号"
        show-search
        option-filter-prop="label"
      />
      <Button
        type="primary"
        :loading="busy"
        :disabled="!selected"
        @click="grant"
      >
        授予全公司数据权限
      </Button>
    </Space>
    <Table
      :columns="columns"
      :data-source="managers"
      row-key="uid"
      :loading="busy"
      :pagination="false"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'action'"
          type="link"
          danger
          :disabled="busy"
          @click="revoke(record.uid)"
        >
          撤销
        </Button>
      </template>
    </Table>
  </PopupModal>
</template>
