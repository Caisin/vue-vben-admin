<script lang="ts" setup>
import { TabPane, Tabs } from 'antdv-next';

import DistrictReport from './district.vue';
import LinkReport from './link.vue';
import PlanReport from './plan.vue';
import PlatformReport from './platform.vue';
import PositionReport from './position.vue';
import UserReport from './user.vue';
</script>

<template>
  <Tabs destroy-inactive-tab-pane>
    <TabPane key="platform" tab="平台"><PlatformReport /></TabPane>
    <TabPane key="link" tab="链接"><LinkReport /></TabPane>
    <TabPane key="position" tab="广告位"><PositionReport /></TabPane>
    <TabPane key="district" tab="地区"><DistrictReport /></TabPane>
    <TabPane key="plan" tab="计划"><PlanReport /></TabPane>
    <TabPane key="user" tab="用户"><UserReport /></TabPane>
  </Tabs>
</template>
