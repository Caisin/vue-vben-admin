<script lang="ts" setup>
import { getList } from '#/api/res/seas/report/fb_sub';

import { fbSubColumns, resFilters } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="Facebook 关注统计"
    date-field="stat_day"
    :columns="fbSubColumns"
    :filters="resFilters"
    :fetch-list="getList"
    row-key="res_id"
  />
</template>
