<script lang="ts" setup>
import { getList, getTotal } from '#/api/res/seas/report/ad';

import { adFilters, adPlatformColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="广告平台统计"
    date-field="stat_day"
    :columns="adPlatformColumns"
    :filters="adFilters"
    :fetch-list="getList"
    :fetch-total="getTotal"
    row-key="ad_platform"
  />
</template>
