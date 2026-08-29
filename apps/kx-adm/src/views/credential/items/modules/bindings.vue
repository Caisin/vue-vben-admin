<script lang="ts" setup>
import type { CredentialBindingView, CredentialView } from '#/api/credential';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Table } from 'antdv-next';

import { CredentialApi } from '#/api/credential';
import { Times } from '#/times';

const credential = ref<CredentialView>();
const bindings = ref<CredentialBindingView[]>([]);
const loading = ref(false);
const title = computed(() => `使用位置 - ${credential.value?.name ?? ''}`);
const columns = [
  { dataIndex: 'consumer', title: '消费者', width: 120 },
  { dataIndex: 'owner_type', title: '对象类型', width: 140 },
  { dataIndex: 'owner_key', title: '对象键' },
  { dataIndex: 'slot', title: '用途', width: 120 },
  { dataIndex: 'expected_kind', title: '期望类型', width: 140 },
  { dataIndex: 'expected_profile', title: 'Profile', width: 120 },
  { dataIndex: 'last_used_at', title: '最后使用', width: 180 },
  { dataIndex: 'last_error', title: '最近错误' },
];

const [Drawer, drawerApi] = useVbenDrawer<CredentialView>({
  onOpenChange(open) {
    if (!open) {
      credential.value = undefined;
      bindings.value = [];
      return;
    }
    credential.value = drawerApi.getData();
    void loadBindings();
  },
});

async function loadBindings() {
  if (!credential.value) return;
  loading.value = true;
  try {
    bindings.value = await CredentialApi.bindings(credential.value.code);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Drawer class="w-full max-w-220" :title="title">
    <Table
      :columns="columns"
      :data-source="bindings"
      :loading="loading"
      row-key="id"
      size="small"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.dataIndex === 'last_used_at'">{{
          Times.formatOptionalUnix(record.last_used_at)
        }}</span>
      </template>
    </Table>
  </Drawer>
</template>
