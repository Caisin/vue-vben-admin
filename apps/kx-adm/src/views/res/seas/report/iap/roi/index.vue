<script lang="ts" setup>
import { getDay, getList, getTotal } from '#/api/res/seas/report/iap/roi';

import { dayPayColumns } from '../../_components/report-config';
import ReportTable from '../../_components/report-table.vue';

const filters = [
  { field: 'uid', label: 'UID', type: 'number' as const },
  { field: 'link_id', label: '链接ID', type: 'number' as const },
];

function fetchList(params: Record<string, any>) {
  return params.stat_day
    ? getDay({ ...params, date: params.stat_day })
    : getList(params);
}
</script>

<template>
  <ReportTable
    title="IAP ROI 统计"
    date-field="stat_day"
    :columns="dayPayColumns"
    :filters="filters"
    :fetch-list="fetchList"
    :fetch-total="getTotal"
    row-key="stat_day"
  />
</template>
