<script lang="ts" setup>
import { getPlanList, getPlanTotal } from '#/api/res/seas/report/ad';

import { adFilters, adPlanColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="广告计划统计"
    date-field="stat_day"
    :columns="adPlanColumns"
    :filters="adFilters"
    :fetch-list="getPlanList"
    :fetch-total="getPlanTotal"
    row-key="ad_id"
  />
</template>
