<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { useMediaQuery } from '@vueuse/core';
import {
  Alert,
  Button,
  Empty,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import { CookieApi, cookieStatus } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';

import LoginModal from './modules/login-modal.vue';
import QuickDataeyeModal from './modules/quick-dataeye-modal.vue';
import SiteCard from './modules/site-card.vue';
import SiteModal from './modules/site-modal.vue';
const isMobile = useMediaQuery('(max-width: 767px)');
const { hasAccessByCodes } = useAccess();
const router = useRouter();
const rows = ref<Site[]>([]);
const loading = ref(false);
const current = ref(1);
const size = ref(20);
const total = ref(0);
const keyword = ref('');
const status = ref<string>();
const errorText = ref('');
const active = ref<Site>();
const editing = ref(false);
const quickOpen = ref(false);
const logging = ref(false);
const renaming = ref(false);
const newName = ref('');
const renameBusy = ref(false);
const renameError = ref('');
function rename(site: Site) {
  active.value = site;
  newName.value = site.name;
  renameError.value = '';
  renaming.value = true;
}
async function saveName() {
  if (!active.value || !newName.value.trim() || renameBusy.value) return;
  renameBusy.value = true;
  renameError.value = '';
  try {
    await CookieApi.rename(
      active.value.id,
      newName.value.trim(),
      active.value.version,
    );
    renaming.value = false;
    message.success('网站显示名称已更新');
    await load();
  } catch (error) {
    renameError.value = requestErrorMessage(
      error,
      '修改名称失败，请刷新后重试',
    );
  } finally {
    renameBusy.value = false;
  }
}
const columns = [
  { title: '网站', dataIndex: 'name', width: 160 },
  { title: '账号标识', dataIndex: 'account_label', width: 150 },
  { title: '域名', dataIndex: 'origin', width: 250 },
  { title: '有效期状态', dataIndex: 'status', width: 150 },
  { title: '最早到期', dataIndex: 'expires_at', width: 185 },
  { title: '分配用户', dataIndex: 'allowed_uids', width: 100 },
  { title: '代理入口', dataIndex: 'proxy', width: 240 },
  { title: '最近刷新', dataIndex: 'refreshed_at', width: 185 },
  { title: '操作', dataIndex: 'action', width: 190, fixed: 'right' as const },
];
async function load() {
  loading.value = true;
  try {
    const result = await CookieApi.sites({
      page: current.value,
      size: size.value,
      keyword: keyword.value,
      status: status.value,
    });
    rows.value = result.items;
    total.value = Number(result.total);
    errorText.value = '';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取Cookie配置失败');
  } finally {
    loading.value = false;
  }
}
function edit(site?: Site) {
  active.value = site;
  editing.value = true;
}
function quickSaved(site: Site) {
  active.value = site;
  logging.value = true;
  void load();
}
async function removeSite(site: Site) {
  await CookieApi.disable(site.id, site.version);
  message.success('网站账号已删除');
  await load();
}
async function copyCookies(site: Site) {
  const text = await CookieApi.export(site.id);
  await navigator.clipboard.writeText(text);
  message.success('Cookie 已复制，可在开发环境维护窗口粘贴导入');
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">网站账号与 Cookie</h1>
    <Alert
      type="info"
      show-icon
      class="mb-4"
      message="同一域名可保存多个账号，分别分配使用用户。只显示Cookie属性，不回显敏感值。DataEye可通过绑定凭证和图片验证码登录刷新。"
    />
    <div class="cookie-toolbar mb-4">
      <Input
        v-model:value="keyword"
        placeholder="搜索网站名称"
        @press-enter="
          current = 1;
          load();
        "
      />
      <div class="cookie-status-filter">
        <Select
          v-model:value="status"
          allow-clear
          placeholder="有效期状态"
          class="w-full md:!w-44"
          :options="
            Object.entries(cookieStatus).map(([value, item]) => ({
              value,
              label: item.label,
            }))
          "
        />
      </div>
      <Button
        @click="
          current = 1;
          load();
        "
      >
        查询
      </Button>
      <Button @click="load">刷新</Button>
      <Button
        v-if="hasAccessByCodes(['cookie-manager:manage'])"
        type="primary"
        @click="edit()"
      >
        新增网站账号
      </Button>
      <Button
        v-if="hasAccessByCodes(['cookie-manager:manage'])"
        type="primary"
        @click="quickOpen = true"
      >
        快速新增 DataEye
      </Button>
    </div>
    <Alert v-if="errorText" type="error" :message="errorText" />
    <Spin v-if="isMobile" :spinning="loading">
      <div class="space-y-3">
        <SiteCard v-for="site in rows" :key="site.id" :site="site">
          <template #details>
            <div class="flex flex-wrap justify-between gap-2">
              <dt class="text-muted-foreground">最近刷新</dt>
              <dd>{{ Times.formatOptionalUnix(site.refreshed_at) }}</dd>
            </div>
            <div class="flex flex-wrap justify-between gap-2">
              <dt class="text-muted-foreground">分配用户</dt>
              <dd>{{ site.allowed_uids.length }}人</dd>
            </div>
            <div class="space-y-1">
              <dt class="text-muted-foreground">代理入口</dt>
              <dd>
                <a
                  v-if="site.proxy_url"
                  :href="site.proxy_url"
                  class="text-primary"
                >
                  {{ site.proxy_url }}
                </a>
                <span v-else>{{
                  site.proxy_enabled ? '等待服务端配置' : '未启用'
                }}</span>
              </dd>
            </div>
          </template>
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            type="primary"
            @click="edit(site)"
          >
            维护
          </Button>
          <Button
            v-if="
              [
                'https://adxray-app.dataeye.com',
                'https://oversea-v2.dataeye.com',
              ].includes(site.origin)
            "
            :disabled="!site.credential_code"
            @click="
              active = site;
              logging = true;
            "
          >
            后台登录
          </Button>
          <Button
            v-if="
              hasAccessByCodes([
                'cookie-manager:assign',
                'cookie-manager:manage',
              ])
            "
            @click="
              router.push({
                path: '/cookie-manager/assignments',
                query: { site_id: String(site.id) },
              })
            "
          >
            分配用户
          </Button>
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            @click="rename(site)"
          >
            改名
          </Button>
          <Button
            v-if="
              hasAccessByCodes(['cookie-manager:manage']) && site.cookies.length
            "
            @click="copyCookies(site)"
          >
            复制 Cookie
          </Button>
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            danger
            @click="removeSite(site)"
          >
            删除
          </Button>
        </SiteCard>
        <Empty v-if="!loading && !rows.length" description="暂无网站账号" />
      </div>
      <Pagination
        v-if="total"
        v-model:current="current"
        :page-size="size"
        :total="total"
        simple
        :show-size-changer="false"
        class="mt-4 flex justify-center"
        @change="load"
      />
    </Spin>
    <Table
      v-else
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
      :scroll="{ x: 1450 }"
      :pagination="{ current, pageSize: size, total, showSizeChanger: true }"
      @change="
        (p) => {
          current = p.current || 1;
          size = p.pageSize || 20;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'name'">
          <span>{{ record.name }}</span>
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            type="link"
            size="small"
            @click="rename(record as Site)"
          >
            改名
          </Button>
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
        <template v-else-if="column.dataIndex === 'refreshed_at'">
          {{ Times.formatOptionalUnix(record.refreshed_at) }}
        </template>
        <template v-else-if="column.dataIndex === 'allowed_uids'">
          <Button
            v-if="
              hasAccessByCodes([
                'cookie-manager:assign',
                'cookie-manager:manage',
              ])
            "
            type="link"
            @click="
              router.push({
                path: '/cookie-manager/assignments',
                query: { site_id: String(record.id) },
              })
            "
          >
            {{ record.allowed_uids.length }}人 · 分配
          </Button>
          <span v-else>{{ record.allowed_uids.length }}人</span>
        </template>
        <template v-else-if="column.dataIndex === 'proxy'">
          <a
            v-if="record.proxy_url"
            :href="record.proxy_url"
            target="_blank"
            rel="noopener noreferrer"
            class="break-all text-primary"
          >
            {{ record.proxy_url }}
          </a>
          <span v-else>{{
            record.proxy_enabled ? '等待服务端配置' : '未启用'
          }}</span>
        </template>
        <Space v-else-if="column.dataIndex === 'action'" wrap>
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            type="link"
            @click="edit(record as Site)"
          >
            维护
          </Button>
          <Button
            v-if="
              [
                'https://adxray-app.dataeye.com',
                'https://oversea-v2.dataeye.com',
              ].includes(record.origin)
            "
            type="link"
            :disabled="!record.credential_code"
            @click="
              active = record as Site;
              logging = true;
            "
          >
            后台登录
          </Button>
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            danger
            type="link"
            @click="removeSite(record as Site)"
          >
            删除
          </Button>
          <Button
            v-if="
              hasAccessByCodes(['cookie-manager:manage']) &&
              record.cookies.length
            "
            type="link"
            @click="copyCookies(record as Site)"
          >
            复制 Cookie
          </Button>
        </Space>
      </template>
    </Table>
    <QuickDataeyeModal v-model:open="quickOpen" @saved="quickSaved" />
    <SiteModal v-model:open="editing" :site="active" @saved="load" />
    <LoginModal v-model:open="logging" :site="active" @saved="load" />
    <Modal
      :open="renaming"
      title="修改网站显示名称"
      width="min(480px, calc(100vw - 24px))"
      :style="{ top: '24px' }"
      :confirm-loading="renameBusy"
      :closable="!renameBusy"
      :mask-closable="!renameBusy"
      :ok-button-props="{ disabled: !newName.trim() }"
      @ok="saveName"
      @cancel="renaming = false"
    >
      <p class="mb-3 break-all text-muted-foreground">
        {{ active?.account_label }} · {{ active?.origin }}
      </p>
      <Input
        v-model:value="newName"
        placeholder="输入网站显示名称"
        :maxlength="100"
        @press-enter="saveName"
      />
      <Alert
        v-if="renameError"
        type="error"
        :message="renameError"
        class="mt-3"
      />
    </Modal>
  </Page>
</template>

<style scoped>
.cookie-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cookie-toolbar > :first-child {
  width: 240px;
}

@media (max-width: 767px) {
  .cookie-toolbar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cookie-toolbar > :first-child {
    grid-column: 1 / -1;
    width: 100%;
  }

  .cookie-toolbar > .cookie-status-filter {
    grid-column: 1 / -1;
  }

  .cookie-toolbar :deep(.ant-btn) {
    min-height: 40px;
    padding-inline: 8px;
  }
}
</style>
