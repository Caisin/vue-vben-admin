<script setup lang="ts">
import type { ImageEnvStatus } from './index';

import { onMounted, ref } from 'vue';

import { Alert, Button, Input } from 'antdv-next';

import {
  configureDesktop,
  desktop,
  desktopApiBase,
  imageEnvStatus,
} from './index';
const base = ref(desktopApiBase() ?? '');
const errorText = ref('');
const busy = ref(false);
const imageStatus = ref<ImageEnvStatus>();
const imageStatusError = ref('');
const imageStatusBusy = ref(false);
const imageKey = ref('');
const imageCopyBusy = ref(false);
const imageSkillUrl = `${import.meta.env.BASE_URL}skills/kx-image-gen.zip`;
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
async function checkImageEnv() {
  imageStatusBusy.value = true;
  imageStatusError.value = '';
  try {
    imageStatus.value = await imageEnvStatus();
  } catch (error) {
    imageStatusError.value = String(error);
  } finally {
    imageStatusBusy.value = false;
  }
}
async function copyImageEnvCommand() {
  const key = imageKey.value.trim();
  if (!key) {
    imageStatusError.value = '请先填写从 sub2api.qinjiu8.com 复制的 key。';
    return;
  }
  imageCopyBusy.value = true;
  imageStatusError.value = '';
  try {
    const escaped = key.replaceAll("'", String.raw`'\''`);
    const command = /win/i.test(navigator.userAgent)
      ? `[Environment]::SetEnvironmentVariable('IMG_OPEN_AI_KEY','${escaped}','User')`
      : `export IMG_OPEN_AI_KEY='${escaped}'`;
    await navigator.clipboard.writeText(command);
    imageKey.value = '';
  } catch {
    imageStatusError.value = '无法写入剪贴板，请手动复制环境变量设置命令。';
  } finally {
    imageCopyBusy.value = false;
  }
}
onMounted(() => {
  void checkImageEnv();
});
</script>
<template>
  <div v-if="desktop" class="mb-4 space-y-3 rounded border p-3">
    <details open>
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

    <details open>
      <summary>GPT 生图 Skill</summary>
      <p class="my-2 text-sm text-muted-foreground">
        Skill 使用 GPT 原生 image_gen，仅覆盖 API 地址和环境变量 key，不会把 key
        写入网页或下载包。
      </p>
      <dl class="grid gap-1 text-sm">
        <div class="flex flex-wrap gap-2">
          <dt class="font-medium">环境变量</dt>
          <dd class="font-mono">IMG_OPEN_AI_KEY</dd>
        </div>
        <div class="flex flex-wrap gap-2">
          <dt class="font-medium">Base URL</dt>
          <dd class="font-mono">https://sub2api.qinjiu8.com/</dd>
        </div>
      </dl>
      <label for="image-open-ai-key" class="mt-2 block text-sm font-medium">
        环境变量值
      </label>
      <Input
        id="image-open-ai-key"
        v-model:value="imageKey"
        class="my-2"
        type="password"
        autocomplete="off"
        placeholder="从 sub2api.qinjiu8.com 复制后粘贴"
      />
      <Alert
        v-if="imageStatus"
        :type="imageStatus.available ? 'success' : 'warning'"
        :message="imageStatus.message"
        class="my-2"
      />
      <Alert
        v-if="imageStatusError"
        type="error"
        :message="imageStatusError"
        class="my-2"
      />
      <div class="flex flex-wrap gap-2">
        <Button :loading="imageCopyBusy" @click="copyImageEnvCommand">
          复制设置命令
        </Button>
        <Button :loading="imageStatusBusy" @click="checkImageEnv">
          检查环境变量
        </Button>
        <a
          class="ant-btn ant-btn-default inline-flex items-center"
          :href="imageSkillUrl"
          download="kx-image-gen.zip"
        >
          下载 GPT 生图 Skill
        </a>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        请从 sub2api.qinjiu8.com 复制 key，在操作系统环境变量中设置
        IMG_OPEN_AI_KEY；设置后完全退出并重启电脑，点击“检查环境变量”。不要把
        key 发送到聊天或提交到代码仓库。复制的 macOS/Linux
        命令只对当前终端生效；需要重启后仍有效时，请在系统环境变量设置中持久化。
      </p>
    </details>
  </div>
</template>
