<script setup lang="ts">
import type { ImageEnvStatus } from './index';

import { onMounted, ref } from 'vue';

import { Alert, Button, Card, Input } from 'antdv-next';

import { desktop, imageEnvStatus, setImageEnv } from './index';

const imageStatus = ref<ImageEnvStatus>();
const imageStatusError = ref('');
const imageStatusBusy = ref(false);
const imageKey = ref('');
const imageConfigBusy = ref(false);
const imageSkillUrl = `${import.meta.env.BASE_URL}skills/kx-image-gen.zip`;

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

async function saveImageConfig() {
  const key = imageKey.value.trim();
  if (!key) {
    imageStatusError.value = '请先填写从 sub2api.qinjiu8.com 复制的 key。';
    return;
  }
  imageConfigBusy.value = true;
  imageStatusError.value = '';
  try {
    imageStatus.value = await setImageEnv(key);
    imageKey.value = '';
  } catch (error) {
    imageStatusError.value = String(error);
  } finally {
    imageConfigBusy.value = false;
  }
}

onMounted(() => {
  if (desktop) void checkImageEnv();
});
</script>

<template>
  <Card title="GPT 生图 Skill" :bordered="false">
    <Alert
      v-if="!desktop"
      type="info"
      message="此功能仅在 kx-adm Tauri 桌面端可用。"
      class="mb-4"
    />
    <template v-else>
      <p class="mb-4 text-sm text-muted-foreground">
        使用 GPT 原生 image_gen。配置只保存到本机文件，Skill
        每次调用前会先加载该文件。
      </p>
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <div class="font-medium">环境变量</div>
          <div class="font-mono">IMG_OPEN_AI_KEY</div>
        </div>
        <div>
          <div class="font-medium">Base URL</div>
          <div class="font-mono">https://sub2api.qinjiu8.com/</div>
        </div>
        <div v-if="imageStatus?.configPath" class="md:col-span-2">
          <div class="font-medium">Skill 配置文件</div>
          <div class="break-all font-mono">{{ imageStatus.configPath }}</div>
        </div>
      </div>
      <label for="image-open-ai-key" class="mt-4 block text-sm font-medium">
        环境变量值
      </label>
      <Input
        id="image-open-ai-key"
        v-model:value="imageKey"
        class="my-2 max-w-xl"
        type="password"
        autocomplete="off"
        placeholder="从 sub2api.qinjiu8.com 复制后粘贴"
      />
      <Alert
        v-if="imageStatus"
        :type="imageStatus.available ? 'success' : 'warning'"
        :message="imageStatus.message"
        class="my-3"
      />
      <Alert
        v-if="imageStatusError"
        type="error"
        :message="imageStatusError"
        class="my-3"
      />
      <div class="flex flex-wrap gap-2">
        <Button :loading="imageConfigBusy" @click="saveImageConfig">
          保存 Skill 配置
        </Button>
        <Button :loading="imageStatusBusy" @click="checkImageEnv">
          检查配置
        </Button>
        <a
          class="ant-btn ant-btn-default inline-flex items-center"
          :href="imageSkillUrl"
          download="kx-image-gen.zip"
        >
          下载 GPT 生图 Skill
        </a>
      </div>
      <p class="mt-3 text-xs text-muted-foreground">
        不要把 key 发送到聊天或提交到代码仓库。保存后重新打开 Skill
        或终端即可使用。
      </p>
    </template>
  </Card>
</template>
