<script lang="ts" setup>
import { getList } from '#/api/res/seas/report/day_reader';

import { dayReaderColumns, resFilters } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="每日阅读统计"
    date-field="stat_day"
    :columns="dayReaderColumns"
    :filters="resFilters"
    :fetch-list="getList"
    row-key="res_id"
  />
</template>
