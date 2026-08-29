<script lang="ts" setup>
import { getLinkList, getLinkTotal } from '#/api/res/seas/report/ad';

import { adFilters, adLinkColumns } from '../_components/report-config';
import ReportTable from '../_components/report-table.vue';
</script>

<template>
  <ReportTable
    title="广告链接统计"
    date-field="stat_day"
    :columns="adLinkColumns"
    :filters="adFilters"
    :fetch-list="getLinkList"
    :fetch-total="getLinkTotal"
    row-key="link_id"
  />
</template>
