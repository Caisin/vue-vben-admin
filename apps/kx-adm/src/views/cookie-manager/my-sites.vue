<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { useMediaQuery } from '@vueuse/core';
import {
  Alert,
  Button,
  Empty,
  Input,
  Pagination,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import { CookieApi, cookieStatus } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';

import SiteCard from './modules/site-card.vue';

const isMobile = useMediaQuery('(max-width: 767px)');
const current = ref(1);
const size = ref(20);
const opening = ref<string>();
async function openProxy(site: Site) {
  if (opening.value || !site.proxy_url) return;
  opening.value = String(site.id);
  errorText.value = '';
  try {
    const result = await CookieApi.proxyGrantDirect(site.id);
    if (isMobile.value) {
      window.location.assign(result.url);
      return;
    }
    const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
    if (!popup) throw new Error('浏览器阻止了新窗口，请允许本站弹窗后重试');
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
const mobileRows = computed(() =>
  visible.value.slice(
    (current.value - 1) * size.value,
    current.value * size.value,
  ),
);
watch(keyword, () => {
  current.value = 1;
});
watch(
  () => visible.value.length,
  (count) => {
    current.value = Math.min(
      current.value,
      Math.max(1, Math.ceil(count / size.value)),
    );
  },
);
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
      message="这里只展示管理员分配给你的账号。启用代理后可直接进入，网站登录由服务端完成；Cookie过期时联系管理员刷新。"
    />
    <div class="mb-4 grid grid-cols-1 gap-2 sm:flex">
      <Input v-model:value="keyword" placeholder="搜索网站、账号或域名" />
      <Button :loading="loading" @click="load">刷新授权</Button>
    </div>
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Spin v-if="isMobile" :spinning="loading">
      <div class="space-y-3">
        <SiteCard v-for="site in mobileRows" :key="site.id" :site="site">
          <Button
            v-if="site.proxy_url"
            class="col-span-2"
            type="primary"
            :loading="opening === String(site.id)"
            :disabled="
              !!opening ||
              ['expired', 'missing', 'disabled'].includes(site.status)
            "
            @click="openProxy(site)"
          >
            进入代理网站
          </Button>
          <p v-else class="col-span-2 text-sm text-muted-foreground">
            {{ site.proxy_enabled ? '等待代理服务配置' : '未启用代理' }}
          </p>
        </SiteCard>
        <Empty
          v-if="!loading && !visible.length"
          :description="
            keyword ? '没有匹配的网站' : '暂无授权网站，请联系管理员分配'
          "
        />
      </div>
      <Pagination
        v-if="visible.length"
        v-model:current="current"
        :page-size="size"
        :total="visible.length"
        simple
        :show-size-changer="false"
        class="mt-4 flex justify-center"
      />
    </Spin>
    <Table
      v-else
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
      :pagination="{ current, pageSize: size, showSizeChanger: true }"
      @change="
        (p) => {
          current = p.current || 1;
          size = p.pageSize || 20;
        }
      "
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
            {{ '进入代理网站' }}
          </Button>
          <span v-else>{{
            record.proxy_enabled ? '等待代理服务配置' : '未启用代理'
          }}</span>
        </template>
        <Tag
          v-else-if="column.dataIndex === 'status'"
          :color="cookieStatus[record.status]?.color"
        >
          {{ cookieStatus[record.status]?.label || record.status }}
        </Tag>
        <template v-else-if="column.dataIndex === 'expires_at'">
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
