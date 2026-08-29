<script lang="ts" setup>
import { getPositionList, getPositionTotal } from '#/api/res/seas/report/ad';

import { adFilters, adPositionColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="广告位统计"
    date-field="stat_day"
    :columns="adPositionColumns"
    :filters="adFilters"
    :fetch-list="getPositionList"
    :fetch-total="getPositionTotal"
    row-key="ad_position"
  />
</template>
