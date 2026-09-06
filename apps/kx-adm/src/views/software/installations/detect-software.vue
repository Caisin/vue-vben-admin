<script setup lang="ts">
import type { SoftwareDetection } from '#/api/software';

import { onScopeDispose, ref, watch } from 'vue';

import { createIconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Input,
  Select,
} from 'antdv-next';

import { SoftwareApi } from '#/api/software';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{ provider?: string; serverId?: number | string }>();
const Scan = createIconifyIcon('lucide:scan-search');
const selectedProvider = ref('mysql');
const binaryPath = ref('');
const result = ref<SoftwareDetection>();
const loading = ref(false);
const detectionError = ref('');
let generation = 0;
onScopeDispose(() => {
  generation++;
});
watch(
  [() => props.serverId, () => props.provider, selectedProvider, binaryPath],
  () => {
    generation++;
    result.value = undefined;
    detectionError.value = '';
    loading.value = false;
  },
);
async function detect() {
  if (!props.serverId) return;
  const current = ++generation;
  loading.value = true;
  detectionError.value = '';
  result.value = undefined;
  try {
    const value = await SoftwareApi.detectSoftware(
      props.serverId,
      props.provider || selectedProvider.value,
      binaryPath.value.trim() || undefined,
    );
    if (current === generation) result.value = value;
  } catch (error) {
    if (current === generation)
      detectionError.value = requestErrorMessage(error, '设备软件检测失败');
  } finally {
    if (current === generation) loading.value = false;
  }
}
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <div class="flex flex-wrap gap-2">
      <Select
        v-if="!props.provider"
        v-model:value="selectedProvider"
        aria-label="检测软件"
        class="w-40"
        :options="[
          { label: 'MySQL', value: 'mysql' },
          { label: 'PostgreSQL', value: 'postgres' },
          { label: 'Redis', value: 'redis' },
          { label: '其它程序', value: 'custom' },
        ]"
      />
      <Input
        v-model:value="binaryPath"
        aria-label="检测程序路径"
        class="min-w-40 flex-1"
        placeholder="自定义程序绝对路径（可选）"
      />
      <Button :disabled="!serverId" :loading="loading" @click="detect">
        <Scan class="size-4" />检测已有安装
      </Button>
    </div>
    <Alert
      v-if="detectionError"
      :message="detectionError"
      show-icon
      type="error"
    />
    <Descriptions
      v-if="result"
      :column="1"
      bordered
      size="small"
      class="break-all"
    >
      <DescriptionsItem label="安装状态">
        {{ result.installed ? '已检测到安装' : '标准路径未发现安装' }}
      </DescriptionsItem>
      <DescriptionsItem label="包管理器">{{ result.manager }}</DescriptionsItem>
      <DescriptionsItem label="程序路径">
        {{ result.binary_path || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="版本">
        {{ result.version_output || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="服务状态">
        {{ result.service_status || 'unknown' }}
      </DescriptionsItem>
    </Descriptions>
  </div>
</template>
