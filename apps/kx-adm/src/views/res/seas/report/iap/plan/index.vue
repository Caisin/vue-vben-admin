<script lang="ts" setup>
import { getList, getTotal, postCost } from '#/api/res/seas/report/iap/plan';

import { linkFilters, linkPayColumns } from '../../_components/report-config';
import ReportTable from '../../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="IAP 广告计划统计"
    date-field="in_link_day"
    :columns="linkPayColumns"
    :filters="linkFilters"
    :fetch-list="getList"
    :fetch-total="getTotal"
    :post-cost="postCost"
    row-key="ad_id"
  />
</template>
