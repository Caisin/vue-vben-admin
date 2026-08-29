<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { ArrowLeft, IconifyIcon, LogOut } from '@vben/icons';
import { useAccessStore } from '@vben/stores';

import { Button, Space } from 'antdv-next';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Fallback404Demo' });

const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();

const hasNoAuthorizedMenus = computed(
  () =>
    Boolean(accessStore.accessToken) &&
    accessStore.isAccessChecked &&
    accessStore.accessMenus.length === 0,
);

async function logoutForAdminLogin() {
  await authStore.logout(false);
}
</script>

<template>
  <main
    class="fallback-page"
    :aria-labelledby="
      hasNoAuthorizedMenus ? 'no-menu-title' : 'not-found-title'
    "
  >
    <template v-if="hasNoAuthorizedMenus">
      <p class="fallback-code">403</p>
      <h1 id="no-menu-title">暂无授权菜单</h1>
      <p class="fallback-desc">
        当前账号尚未分配可访问的后台菜单。请联系管理员授权；如需立即处理，可退出后使用管理员账号登录。
      </p>
      <Space :size="12" wrap class="fallback-actions">
        <Button @click="router.back()">
          <ArrowLeft class="size-4" />
          返回上一页
        </Button>
        <Button
          :loading="authStore.loginLoading"
          type="primary"
          @click="logoutForAdminLogin"
        >
          <LogOut class="size-4" />
          退出登录
        </Button>
      </Space>
    </template>

    <template v-else>
      <p class="fallback-code">404</p>
      <h1 id="not-found-title">页面不存在</h1>
      <p class="fallback-desc">
        访问地址无效或页面已调整。可返回上一页，或回到首页重新选择功能入口。
      </p>
      <Space :size="12" wrap class="fallback-actions">
        <Button @click="router.back()">
          <ArrowLeft class="size-4" />
          返回上一页
        </Button>
        <Button type="primary" @click="router.push('/')">
          <IconifyIcon class="size-4" icon="lucide:house" />
          回到首页
        </Button>
      </Space>
    </template>
  </main>
</template>

<style scoped>
.fallback-page {
  display: grid;
  place-items: center;
  align-content: center;
  min-height: min(68vh, 680px);
  padding: 32px 16px;
  text-align: center;
}

.fallback-code {
  margin: 0;
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--muted-foreground) / 40%);
}

.fallback-page h1 {
  margin: 16px 0 0;
  font-size: 28px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.fallback-desc {
  max-width: 560px;
  margin: 12px 0 0;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.fallback-actions {
  justify-content: center;
  margin-top: 24px;
}

@media (max-width: 640px) {
  .fallback-code {
    font-size: 56px;
  }

  .fallback-page h1 {
    font-size: 22px;
  }
}
</style>
