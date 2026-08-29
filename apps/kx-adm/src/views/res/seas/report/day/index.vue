<script lang="ts" setup>
import { getList, getTotal, postCost } from '#/api/res/seas/report/day';

import { dayPayColumns, linkFilters } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="每日付费统计"
    date-field="in_link_day"
    :columns="dayPayColumns"
    :filters="linkFilters"
    :fetch-list="getList"
    :fetch-total="getTotal"
    :post-cost="postCost"
    row-key="in_link_day"
  />
</template>
