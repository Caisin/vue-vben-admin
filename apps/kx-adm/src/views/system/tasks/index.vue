<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { TabPane, Tabs } from 'antdv-next';

import List from './list.vue';
import ScheduleList from './schedule-list.vue';
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <h1>任务调度</h1>
    </header>
    <Tabs class="management-tabs" destroy-inactive-tab-pane>
      <TabPane key="runs" tab="执行记录">
        <List embedded />
      </TabPane>
      <TabPane key="schedules" tab="调度配置">
        <ScheduleList />
      </TabPane>
    </Tabs>
  </Page>
</template>

<style scoped>
.management-tabs {
  flex: 1;
  min-height: 0;
}

.management-tabs :deep(.ant-tabs-content-holder),
.management-tabs :deep(.ant-tabs-content),
.management-tabs :deep(.ant-tabs-tabpane-active) {
  height: 100%;
  min-height: 0;
}

.management-tabs :deep(.ant-tabs-tabpane-active) {
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .page-heading {
    align-items: flex-start;
  }
}
</style>
