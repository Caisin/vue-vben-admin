<script lang="ts" setup>
import { Drawer } from 'antdv-next';

import ExportHistoryTable from './export-history-table.vue';

defineProps<{ initialExportId?: number | string }>();
const open = defineModel<boolean>('open', { required: true });
</script>

<template>
  <Drawer
    :open="open"
    size="min(1280px, 100vw)"
    title="导出任务"
    @close="open = false"
  >
    <ExportHistoryTable :active="open" :initial-export-id="initialExportId" />
  </Drawer>
</template>
