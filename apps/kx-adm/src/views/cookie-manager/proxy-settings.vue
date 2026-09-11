<script setup lang="ts">
import type { SystemSettings } from '#/api/system/settings';

import { onMounted, reactive, ref } from 'vue';

import { Alert, Button, Form, FormItem, Input, message } from 'antdv-next';

import { SystemSettingsApi } from '#/api/system/settings';
const loading = ref(false);
const saving = ref(false);
const form = reactive<
  Pick<
    SystemSettings,
    'cookie_proxy_admin' | 'cookie_proxy_listen' | 'cookie_proxy_public'
  >
>({
  cookie_proxy_public: '',
  cookie_proxy_admin: '',
  cookie_proxy_listen: '127.0.0.1:18890',
});
async function load() {
  loading.value = true;
  try {
    Object.assign(form, await SystemSettingsApi.get());
  } finally {
    loading.value = false;
  }
}
async function save() {
  saving.value = true;
  try {
    const current = await SystemSettingsApi.get();
    const saved = await SystemSettingsApi.save({ ...current, ...form });
    Object.assign(form, saved);
    message.success('网站代理设置已保存，重启 kx-adm 后生效');
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="p-5">
    <h1>网站代理设置</h1>
    <p class="mb-5 text-muted-foreground">
      配置统一网站代理监听和系统认证回跳地址。设置保存到数据库，不再使用 bends。
    </p>
    <Alert
      class="mb-5"
      type="warning"
      show-icon
      message="修改监听地址或公网地址后需要重启 kx-adm；代理域名必须与后台域名分离。"
    /><Form layout="vertical" class="max-w-3xl">
      <FormItem label="代理公网地址">
        <Input
          v-model:value="form.cookie_proxy_public"
          placeholder="https://proxy.example.com"
        />
</FormItem><FormItem label="系统认证回跳地址">
        <Input
          v-model:value="form.cookie_proxy_admin"
          placeholder="https://admin.example.com/#/cookie-manager/my-sites"
        />
</FormItem><FormItem label="代理监听地址">
        <Input
          v-model:value="form.cookie_proxy_listen"
          placeholder="127.0.0.1:18890"
        />
</FormItem><Button
        type="primary"
        :loading="saving"
        :disabled="loading"
        @click="save"
      >
        保存代理设置
      </Button>
    </Form>
  </div>
</template>
