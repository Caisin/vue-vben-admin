<script lang="ts" setup>
import { getList } from '#/api/res/seas/report/user_income';

import { userIncomeColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="用户广告收益统计"
    date-field="stat_day"
    :columns="userIncomeColumns"
    :fetch-list="getList"
    row-key="uid"
  />
</template>
