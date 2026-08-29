<script lang="ts" setup>
import { getList } from '#/api/res/seas/report/fb_back';

import { fbBackColumns, fbBackFilters } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="Facebook 回传统计"
    date-field="created_at"
    :columns="fbBackColumns"
    :filters="fbBackFilters"
    :fetch-list="getList"
    row-key="id"
  />
</template>
