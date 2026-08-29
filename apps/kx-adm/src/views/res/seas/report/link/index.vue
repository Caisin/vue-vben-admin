<script lang="ts" setup>
import { getList, getTotal, postCost } from '#/api/res/seas/report/link';

import { linkFilters, linkPayColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="推广链接付费统计"
    date-field="in_link_day"
    :columns="linkPayColumns"
    :filters="linkFilters"
    :fetch-list="getList"
    :fetch-total="getTotal"
    :post-cost="postCost"
    row-key="link_id"
  />
</template>
