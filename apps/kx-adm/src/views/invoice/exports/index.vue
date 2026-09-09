<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import ExportHistoryTable from '../modules/export-history-table.vue';

const route = useRoute();
const initialExportId = computed(() => {
  const value = route.query.export_id;
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^[1-9]\d*$/.test(id) ? id : undefined;
});
</script>

<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">发票导出任务</h1>
    <ExportHistoryTable :initial-export-id="initialExportId" />
  </Page>
</template>
