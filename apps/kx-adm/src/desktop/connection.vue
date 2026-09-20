<script setup lang="ts">
import { ref } from 'vue';

import { Settings } from '@vben/icons';

import { Alert, Button, Input, Tooltip } from 'antdv-next';

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
    <Tooltip title="桌面服务地址设置">
      <button
        type="button"
        aria-label="桌面服务地址设置"
        class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="editing = !editing"
      >
        <Settings class="size-4" />
      </button>
    </Tooltip>
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
