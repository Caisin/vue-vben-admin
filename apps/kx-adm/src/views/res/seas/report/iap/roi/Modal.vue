<script lang="ts" setup>
import { Modal } from 'antdv-next';

const props = withDefaults(
  defineProps<{ open?: boolean; record?: Record<string, any> }>(),
  {
    open: false,
    record: () => ({}),
  },
);
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Modal
    :footer="null"
    :open="props.open"
    title="IAP ROI 明细"
    width="820px"
    @cancel="emit('close')"
  >
    <pre class="detail-json">{{ JSON.stringify(props.record, null, 2) }}</pre>
  </Modal>
</template>

<style scoped>
.detail-json {
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
