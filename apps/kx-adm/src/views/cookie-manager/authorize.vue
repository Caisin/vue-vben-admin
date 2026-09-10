<script setup lang="ts">
import type { Session } from '#/api/cookie-manager';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  message,
  Popconfirm,
  Table,
  Tag,
} from 'antdv-next';

import { CookieApi } from '#/api/cookie-manager';
import { Times } from '#/times';
const route = useRoute();
const router = useRouter();
const busy = ref(false);
const done = ref(false);
const rows = ref<Session[]>([]);
const challenge = computed(() =>
  typeof route.query.challenge === 'string' ? route.query.challenge : '',
);
const valid = computed(() => /^[a-f0-9]{64}$/.test(challenge.value));
async function load() {
  rows.value = await CookieApi.sessions();
}
async function approve() {
  busy.value = true;
  try {
    await CookieApi.authorize(challenge.value);
    done.value = true;
    await router.replace({ path: route.path });
    message.success('插件授权成功，请返回插件刷新网站');
    await load();
  } finally {
    busy.value = false;
  }
}
async function revoke(session: Session) {
  await CookieApi.revoke(session.id);
  message.success('插件会话已撤销');
  await load();
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">Cookie 插件授权</h1>
    <Card class="mb-4">
      <Alert
        type="info"
        show-icon
        message="插件仅可获取管理员分配给你的网站Cookie，授权最长12小时。请确认本次登录是你从插件发起，不要批准他人发来的授权链接。"
      /><template v-if="valid && !done">
        <p class="my-4">
          请核对插件显示的授权码：<strong>{{ challenge.slice(0, 8) }}</strong>
        </p>
        <Button type="primary" :loading="busy" @click="approve">
          确认授权此插件
        </Button>
      </template>
      <p v-else class="mt-4">
        {{
          done
            ? '授权完成，请回到插件点击“已授权，刷新网站”。'
            : '从Chrome插件点击“账号密码 / 钉钉登录”发起授权，系统支持现有登录方式和MFA。'
        }}
      </p>
</Card><Table
      :data-source="rows"
      row-key="id"
      :columns="[
        { title: '会话编号', dataIndex: 'id' },
        { title: '授权时间', dataIndex: 'created_at' },
        { title: '到期时间', dataIndex: 'expires_at' },
        { title: '状态', dataIndex: 'revoked' },
        { title: '操作', dataIndex: 'action' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'created_at'">
          {{ Times.formatOptionalUnix(record.created_at) }}
</template><template v-else-if="column.dataIndex === 'expires_at'">
          {{ Times.formatOptionalUnix(record.expires_at) }}
</template><Tag v-else-if="column.dataIndex === 'revoked'">
          {{
            record.revoked
              ? '已撤销'
              : Number(record.expires_at) * 1000 <= Date.now()
                ? '已过期'
                : '有效'
          }}
</Tag><Popconfirm
          v-else-if="column.dataIndex === 'action' && !record.revoked"
          title="确认撤销此插件会话？"
          @confirm="revoke(record as Session)"
        >
          <Button danger type="link">撤销</Button>
        </Popconfirm>
      </template>
    </Table>
  </Page>
</template>
