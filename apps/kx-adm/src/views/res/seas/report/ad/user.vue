<script lang="ts" setup>
import { getUserList, getUserTotal } from '#/api/res/seas/report/ad';

import { adFilters, adUserColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="广告用户统计"
    date-field="stat_day"
    :columns="adUserColumns"
    :filters="adFilters"
    :fetch-list="getUserList"
    :fetch-total="getUserTotal"
    row-key="uid"
  />
</template>
