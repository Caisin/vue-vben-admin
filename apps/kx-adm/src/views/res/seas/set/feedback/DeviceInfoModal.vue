<script lang="ts" setup>
import { computed } from 'vue';

import { Descriptions, DescriptionsItem, Modal } from 'antdv-next';

const props = defineProps<{ open: boolean; record?: Record<string, any> }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const deviceInfo = computed(() => {
  const content = props.record?.content;
  if (content && typeof content === 'object') {
    return (
      content.device_info ??
      content.deviceInfo ??
      props.record?.device_info ??
      {}
    );
  }
  return props.record?.device_info ?? {};
});
</script>

<template>
  <Modal
    :footer="null"
    :open="open"
    title="设备信息"
    width="720px"
    @cancel="emit('update:open', false)"
  >
    <Descriptions bordered :column="1" size="small">
      <DescriptionsItem
        v-for="(value, key) in deviceInfo"
        :key="key"
        :label="String(key)"
      >
        {{ typeof value === 'object' ? JSON.stringify(value, null, 2) : value }}
      </DescriptionsItem>
    </Descriptions>
    <pre v-if="!Object.keys(deviceInfo || {}).length">{{
      JSON.stringify(record, null, 2)
    }}</pre>
  </Modal>
</template>
