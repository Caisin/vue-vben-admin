<script setup lang="ts">
import type { SoftwareOperation } from '#/api/software';

import { ref } from 'vue';

import { Modal } from 'antdv-next';

import OperationLog from './operation-log.vue';

const emit = defineEmits<{ completed: [] }>();
const opened = ref(false);
const operation = ref<SoftwareOperation>();
function open(value: SoftwareOperation) {
  operation.value = value;
  opened.value = true;
}
defineExpose({ open });
</script>
<template>
  <Modal
    v-model:open="opened"
    title="软件操作进度"
    :footer="null"
    :width="800"
    centered
  >
    <OperationLog
      v-if="opened && operation"
      :operation-id="operation.id"
      @completed="emit('completed')"
    />
  </Modal>
</template>
