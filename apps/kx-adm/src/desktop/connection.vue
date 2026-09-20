<script setup lang="ts">
import { ref } from 'vue';

import { Alert, Button, Input } from 'antdv-next';

import { configureDesktop, desktop, desktopApiBase } from './index';
const base = ref(desktopApiBase() ?? '');
const errorText = ref('');
const busy = ref(false);
async function save() {
  busy.value = true;
  errorText.value = '';
  try {
    await configureDesktop(base.value);
  } catch (error) {
    errorText.value = String(error);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <details v-if="desktop" class="mb-4 rounded border p-3">
    <summary>桌面端服务连接</summary>
    <p class="my-2 text-sm text-muted-foreground">
      登录信息保存在本机 localStorage，重启后自动恢复，用于后台上传。
    </p>
    <label for="desktop-server">API 地址（含服务前缀）</label>
    <Input
      id="desktop-server"
      v-model:value="base"
      class="my-2"
      placeholder="https://example.com/api"
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-2" />
    <Button :loading="busy" @click="save">保存地址并重新登录</Button>
  </details>
</template>
