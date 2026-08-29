<script lang="ts" setup>
import { getDistrictList, getDistrictTotal } from '#/api/res/seas/report/ad';

import { adDistrictColumns, adFilters } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="广告地区统计"
    date-field="stat_day"
    :columns="adDistrictColumns"
    :filters="adFilters"
    :fetch-list="getDistrictList"
    :fetch-total="getDistrictTotal"
    row-key="country"
  />
</template>
