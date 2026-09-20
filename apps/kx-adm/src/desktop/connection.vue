<script setup lang="ts">
import { ref } from 'vue';

import { Alert, Button, Input } from 'antdv-next';

import { configureDesktop, desktop, desktopApiBase } from './index';

const base = ref(desktopApiBase() ?? '');
const errorText = ref('');
const busy = ref(false);
const editing = ref(false);

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
  <div v-if="desktop" class="mb-4 text-right">
    <button
      type="button"
      class="text-xs text-muted-foreground underline-offset-4 hover:underline"
      @click="editing = !editing"
    >
      桌面服务地址设置
    </button>
    <div v-if="editing" class="mt-2 rounded border p-3 text-left">
      <p class="my-2 text-sm text-muted-foreground">
        默认复用当前 Web 服务地址；仅在桌面端需要连接其它服务时修改。
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
    </div>
  </div>
</template>
