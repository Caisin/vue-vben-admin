<script lang="ts" setup>
import {
  getList,
  getTotal,
  postCost,
} from '#/api/res/seas/report/iap/plan_paytime';

import { dayPayColumns, linkFilters } from '../../_components/report-config';
import ReportTable from '../../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="IAP 付费时间计划统计"
    date-field="pay_day"
    :columns="dayPayColumns"
    :filters="linkFilters"
    :fetch-list="getList"
    :fetch-total="getTotal"
    :post-cost="postCost"
    row-key="ad_id"
  />
</template>
