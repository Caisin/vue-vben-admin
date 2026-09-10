<script setup lang="ts">
import type { Audit } from '#/api/cookie-manager';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Table } from 'antdv-next';

import { CookieApi } from '#/api/cookie-manager';
import { Times } from '#/times';
const rows = ref<Audit[]>([]);
const current = ref(1);
const total = ref(0);
const loading = ref(false);
const actions: Record<string, string> = {
  create: '创建配置',
  assign: '分配使用用户',
  update: '修改配置/分配',
  refresh: '手动刷新Cookie',
  refresh_login: '后台登录刷新',
  fetch: '插件获取',
  revoke: '撤销会话',
};
async function load() {
  loading.value = true;
  try {
    const r = await CookieApi.audits({ page: current.value, size: 20 });
    rows.value = r.items;
    total.value = Number(r.total);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">Cookie 使用与配置审计</h1>
    <Button class="mb-4" @click="load">刷新</Button><Table
      :data-source="rows"
      :loading="loading"
      row-key="id"
      :columns="[
        { title: '用户', dataIndex: 'uid' },
        { title: '网站账号', dataIndex: 'site_id' },
        { title: '动作', dataIndex: 'action' },
        { title: '配置版本', dataIndex: 'version' },
        { title: 'Cookie数', dataIndex: 'cookie_count' },
        { title: '发生时间', dataIndex: 'created_at' },
      ]"
      :pagination="{ current, pageSize: 20, total }"
      @change="
        (p) => {
          current = p.current || 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">
          {{ actions[record.action] || record.action }}
</template><template v-else-if="column.dataIndex === 'created_at'">
          {{ Times.formatOptionalUnix(record.created_at) }}
        </template>
      </template>
    </Table>
  </Page>
</template>
