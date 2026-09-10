<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Input, Space, Table, Tag } from 'antdv-next';

import { CookieApi, cookieStatus } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';
const router = useRouter();
const route = useRoute();
const opening = ref<string>();
const challenge = computed(() =>
  typeof route.query.proxy_challenge === 'string'
    ? route.query.proxy_challenge
    : '',
);
const proxySite = computed(() =>
  typeof route.query.proxy_site_id === 'string'
    ? route.query.proxy_site_id
    : '',
);
async function openProxy(site: Site) {
  if (opening.value || !site.proxy_url) return;
  opening.value = String(site.id);
  errorText.value = '';
  try {
    if (
      /^[a-f0-9]{64}$/.test(challenge.value) &&
      proxySite.value === String(site.id)
    ) {
      const result = await CookieApi.proxyGrant(site.id, challenge.value);
      await router.replace({ path: route.path });
      window.location.assign(result.url);
    } else window.location.assign(site.proxy_url);
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '进入代理失败，请刷新授权后重试',
    );
  } finally {
    opening.value = undefined;
  }
}
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
      message="这里只展示管理员分配给你的账号。启用代理后可直接进入，网站登录由服务端完成，无需插件；Cookie过期时联系管理员刷新。"
    /><Space class="mb-4">
      <Input
        v-model:value="keyword"
        placeholder="搜索网站、账号或域名"
      /><Button :loading="loading" @click="load">刷新授权</Button><Button type="primary" @click="router.push('/cookie-manager/authorize')">
        插件登录与会话
      </Button>
</Space><Alert
      v-if="challenge"
      type="info"
      message="已回到系统认证，请核对网站与账号，点击“确认并进入代理”。不同网站账号使用独立域名。"
      class="mb-3"
    /><Alert
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
        { title: '代理访问', dataIndex: 'proxy' },
      ]"
      :pagination="{ pageSize: 20, showSizeChanger: true }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'proxy'">
          <Button
            v-if="record.proxy_url"
            type="primary"
            :loading="opening === String(record.id)"
            :disabled="
              !!opening || ['expired', 'missing'].includes(record.status)
            "
            @click="openProxy(record as Site)"
          >
            {{
              challenge && proxySite === String(record.id)
                ? '确认并进入代理'
                : '进入代理网站'
            }}
</Button><span v-else>{{
            record.proxy_enabled ? '等待代理服务配置' : '未启用代理'
          }}</span>
        </template>
        <Tag
          v-else-if="column.dataIndex === 'status'"
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
