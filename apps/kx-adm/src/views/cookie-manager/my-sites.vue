<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Input, Space, Table, Tag } from 'antdv-next';

import { CookieApi, cookieStatus } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';
const router = useRouter();
const sites = ref<Site[]>([]);
const keyword = ref('');
const loading = ref(false);
const errorText = ref('');
const visible = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return sites.value.filter((s) =>
    [s.name, s.account_label, s.origin].some((v) =>
      v.toLowerCase().includes(q),
    ),
  );
});
async function load() {
  loading.value = true;
  try {
    sites.value = await CookieApi.mySites();
    errorText.value = '';
  } catch (error) {
    sites.value = [];
    errorText.value = requestErrorMessage(error, '读取我的授权失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">我的网站授权</h1>
    <Alert
      type="info"
      show-icon
      class="mb-4"
      message="这里只展示管理员分配给你的账号。请使用Cookie同步插件选择对应账号登录网站；过期或未配置Cookie时联系管理员刷新。"
    /><Space class="mb-4">
      <Input
        v-model:value="keyword"
        placeholder="搜索网站、账号或域名"
      /><Button :loading="loading" @click="load">刷新授权</Button><Button type="primary" @click="router.push('/cookie-manager/authorize')">
        插件登录与会话
      </Button>
</Space><Alert
      v-if="errorText"
      type="error"
      :message="errorText"
      class="mb-3"
    /><Table
      :data-source="visible"
      row-key="id"
      :loading="loading"
      :locale="{ emptyText: '暂无授权网站，请联系管理员分配' }"
      :columns="[
        { title: '网站', dataIndex: 'name' },
        { title: '账号', dataIndex: 'account_label' },
        { title: '网站地址', dataIndex: 'origin' },
        { title: 'Cookie状态', dataIndex: 'status' },
        { title: '最早到期', dataIndex: 'expires_at' },
      ]"
      :pagination="{ pageSize: 20, showSizeChanger: true }"
    >
      <template #bodyCell="{ column, record }">
        <Tag
          v-if="column.dataIndex === 'status'"
          :color="cookieStatus[record.status]?.color"
        >
          {{ cookieStatus[record.status]?.label || record.status }}
</Tag><template v-else-if="column.dataIndex === 'expires_at'">
          {{
            record.expires_at
              ? Times.formatOptionalUnix(record.expires_at)
              : '未指定'
          }}
        </template>
      </template>
    </Table>
  </Page>
</template>
