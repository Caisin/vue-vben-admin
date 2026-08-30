<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { ExternalLink, Plus, RotateCw } from '@vben/icons';

import { Button, Modal, Select, Space, Tooltip } from 'antdv-next';

interface Props {
  allowClear?: boolean;
  disabled?: boolean;
  loading?: boolean;
  managePath?: string;
  manageQuery?: Record<string, string | undefined>;
  maintenanceTitle?: string;
  modelValue?: null | number | string;
  options?: Array<{
    disabled?: boolean;
    label: string;
    value: number | string;
  }>;
  placeholder?: string;
  readOnlySource?: string;
  showManage?: boolean;
  showMaintenance?: boolean;
  showRefresh?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: true,
  disabled: false,
  loading: false,
  managePath: undefined,
  manageQuery: undefined,
  maintenanceTitle: '新增',
  modelValue: undefined,
  options: () => [],
  placeholder: '请选择',
  readOnlySource: undefined,
  showManage: true,
  showMaintenance: false,
  showRefresh: true,
});

const emit = defineEmits<{
  manage: [];
  refresh: [];
  'update:modelValue': [value: null | number | string | undefined];
}>();

const maintenanceOpen = ref(false);
const router = useRouter();

function openManage() {
  if (!props.managePath) return;
  const href = router.resolve({
    path: props.managePath,
    query: props.manageQuery,
  }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
  emit('manage');
}

function refresh() {
  emit('refresh');
}

function updateValue(value: unknown) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    emit('update:modelValue', value);
  } else {
    emit('update:modelValue', undefined);
  }
}

function completeMaintenance(value?: number | string) {
  if (value !== undefined) emit('update:modelValue', value);
  maintenanceOpen.value = false;
  emit('refresh');
}

defineExpose({ completeMaintenance });
</script>

<template>
  <div class="reference-select">
    <Space class="reference-select__controls" :size="6">
      <Select
        class="reference-select__input"
        :allow-clear="props.allowClear"
        :disabled="props.disabled"
        :loading="props.loading"
        :options="props.options"
        option-filter-prop="label"
        :placeholder="props.placeholder"
        show-search
        :value="props.modelValue"
        @update:value="updateValue"
      >
        <template v-if="props.showMaintenance" #popupRender="menuNode">
          <component :is="menuNode" />
          <div class="reference-select__create" @mousedown.prevent.stop>
            <Button
              block
              :disabled="props.disabled"
              size="small"
              type="link"
              @click="maintenanceOpen = true"
            >
              <template #icon><Plus /></template>
              新增配置
            </Button>
          </div>
        </template>
      </Select>
      <Tooltip v-if="props.showRefresh" title="刷新列表">
        <Button aria-label="刷新列表" :loading="props.loading" @click="refresh">
          <template #icon><RotateCw /></template>
        </Button>
      </Tooltip>
    </Space>
    <div v-if="props.readOnlySource" class="reference-select__source">
      {{ props.readOnlySource }}
    </div>
    <Modal
      v-model:open="maintenanceOpen"
      destroy-on-close
      :title="props.maintenanceTitle"
      width="560"
    >
      <slot name="maintenance" :complete="completeMaintenance"></slot>
      <template #footer>
        <Button
          v-if="props.showManage && props.managePath"
          type="link"
          @click="openManage"
        >
          <template #icon><ExternalLink /></template>
          前往完整维护页面
        </Button>
        <Button @click="maintenanceOpen = false">关闭</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.reference-select__controls {
  display: flex;
  width: 100%;
}

.reference-select__input {
  flex: 1;
  min-width: 0;
}

.reference-select__source {
  margin-top: 4px;
  font-size: 12px;
  color: var(--vben-gray-500, #8c8c8c);
}

.reference-select__create {
  padding: 6px 8px;
  border-top: 1px solid var(--vben-border-color, #f0f0f0);
}
</style>
