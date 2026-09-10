<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Alert, Button, Input, Select, Space, Table, Tag } from 'antdv-next';

import { CookieApi, cookieStatus } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';

import LoginModal from './modules/login-modal.vue';
import QuickDataeyeModal from './modules/quick-dataeye-modal.vue';
import SiteModal from './modules/site-modal.vue';
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
const columns = [
  { title: '网站', dataIndex: 'name', width: 160 },
  { title: '账号标识', dataIndex: 'account_label', width: 150 },
  { title: '域名', dataIndex: 'origin', width: 250 },
  { title: '有效期状态', dataIndex: 'status', width: 150 },
  { title: '最早到期', dataIndex: 'expires_at', width: 185 },
  { title: '分配用户', dataIndex: 'allowed_uids', width: 100 },
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
  if (hasAccessByCodes(['cookie-manager:login'])) logging.value = true;
  void load();
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
    /><Space class="mb-4" wrap>
      <Input
        v-model:value="keyword"
        placeholder="搜索网站名称"
        @press-enter="
          current = 1;
          load();
        "
      /><Select
        v-model:value="status"
        allow-clear
        placeholder="有效期状态"
        class="!w-44"
        :options="
          Object.entries(cookieStatus).map(([value, item]) => ({
            value,
            label: item.label,
          }))
        "
      /><Button
        @click="
          current = 1;
          load();
        "
      >
        查询
</Button><Button @click="load">刷新</Button><Button
        v-if="hasAccessByCodes(['cookie-manager:manage'])"
        type="primary"
        @click="edit()"
      >
        新增网站账号
</Button><Button
        v-if="
          hasAccessByCodes(['cookie-manager:manage', 'cookie-manager:login'])
        "
        type="primary"
        @click="quickOpen = true"
      >
        快速新增 DataEye
      </Button>
</Space><Alert v-if="errorText" type="error" :message="errorText" /><Table
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
</template><template v-else-if="column.dataIndex === 'refreshed_at'">
          {{ Times.formatOptionalUnix(record.refreshed_at) }}
</template><template v-else-if="column.dataIndex === 'allowed_uids'">
          <Button
            v-if="hasAccessByCodes(['cookie-manager:assign'])"
            type="link"
            @click="
              router.push({
                path: '/cookie-manager/assignments',
                query: { site_id: String(record.id) },
              })
            "
          >
            {{ record.allowed_uids.length }}人 · 分配
</Button><span v-else>{{ record.allowed_uids.length }}人</span>
</template><Space v-else-if="column.dataIndex === 'action'">
          <Button
            v-if="hasAccessByCodes(['cookie-manager:manage'])"
            type="link"
            @click="edit(record as Site)"
          >
            维护
</Button><Button
            v-if="
              record.origin === 'https://adxray-app.dataeye.com' &&
              hasAccessByCodes(['cookie-manager:login'])
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
        </Space>
      </template>
</Table><QuickDataeyeModal
      v-model:open="quickOpen"
      @saved="quickSaved"
    /><SiteModal
      v-model:open="editing"
      :site="active"
      @saved="load"
    /><LoginModal v-model:open="logging" :site="active" @saved="load" />
  </Page>
</template>
