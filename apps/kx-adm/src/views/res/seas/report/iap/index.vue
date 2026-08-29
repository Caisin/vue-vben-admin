<script lang="ts" setup>
import { TabPane, Tabs } from 'antdv-next';

import PlanReport from './plan/index.vue';
import PlanPaytimeReport from './plan_paytime/index.vue';
import RoiReport from './roi/index.vue';
import TotalReport from './total/index.vue';
</script>

<template>
  <Tabs destroy-inactive-tab-pane>
    <TabPane key="total" tab="总览"><TotalReport /></TabPane>
    <TabPane key="roi" tab="ROI"><RoiReport /></TabPane>
    <TabPane key="plan" tab="计划"><PlanReport /></TabPane>
    <TabPane key="plan_paytime" tab="付费时间"><PlanPaytimeReport /></TabPane>
  </Tabs>
</template>
