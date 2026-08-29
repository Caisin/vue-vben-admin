<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { ArrowLeft, IconifyIcon } from '@vben/icons';

import { Button, Space } from 'antdv-next';

defineOptions({ name: 'Fallback403Demo' });

const router = useRouter();
</script>

<template>
  <main class="fallback-page" aria-labelledby="forbidden-title">
    <p class="fallback-code">403</p>
    <h1 id="forbidden-title">无权访问此页面</h1>
    <p class="fallback-desc">
      当前账号没有该页面权限。可返回上一页，或进入首页后选择已授权菜单。
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
  max-width: 520px;
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
