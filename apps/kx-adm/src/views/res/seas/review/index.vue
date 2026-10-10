<script setup lang="ts">
import type { ReviewResource } from '#/api/res/review';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Empty, Input, Table } from 'antdv-next';

import { reviewApi } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';

import ReviewWorkbench from '../global/source_manage/modules/review-workbench.vue';
const route = useRoute();
const router = useRouter();
const rows = ref<ReviewResource[]>([]);
const selected = ref<ReviewResource>();
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const search = ref('');
const loading = ref(false);
const errorText = ref('');
let generation = 0;
async function load() {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await reviewApi.resources(
      search.value,
      page.value,
      pageSize.value,
    );
    if (ticket !== generation) return;
    rows.value = result.items;
    total.value = Number(result.total);
    if (route.query.res && !selected.value)
      selected.value = await reviewApi.resource(String(route.query.res));
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取我的审核作品失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
function choose(resource: ReviewResource) {
  selected.value = resource;
  void router.replace({ query: { res: String(resource.id) } });
}
function searchResources() {
  page.value = 1;
  void load();
}
function changePage(pagination: { current?: number; pageSize?: number }) {
  page.value = pagination.current || 1;
  pageSize.value = pagination.pageSize || 20;
  void load();
}
onMounted(load);
</script>
<template>
  <Page title="我的作品审核" description="集中处理参与作品的分集意见与修订。">
    <div class="rounded-xl bg-background p-5">
      <template v-if="selected">
        <Button
          class="mb-4"
          @click="
            selected = undefined;
            router.replace({ query: {} });
          "
        >
          ← 返回作品列表
</Button><ReviewWorkbench
          :key="String(selected.id)"
          :res="selected.id"
          :name="selected.res_name"
          :initial-version="
            typeof route.query.version === 'string'
              ? route.query.version
              : undefined
          "
        />
      </template>
      <template v-else>
        <div class="mb-5 flex flex-wrap gap-3">
          <Input
            v-model:value="search"
            placeholder="搜索作品名称或编号"
            class="max-w-md"
            allow-clear
            @press-enter="searchResources"
          /><Button type="primary" :loading="loading" @click="searchResources">
            查询
</Button><Button
            :disabled="loading"
            @click="
              search = '';
              searchResources();
            "
          >
            重置
          </Button>
        </div>
        <Alert
          v-if="errorText"
          :message="errorText"
          type="error"
          class="mb-3"
        />
        <Table
          :loading="loading"
          :data-source="rows"
          row-key="id"
          :pagination="{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
          }"
          @change="changePage"
          :columns="[
            { title: '作品', key: 'name' },
            { title: '作品编号', dataIndex: 'resource_code' },
            { title: '下一步', key: 'action' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.key === 'name'"
              type="link"
              @click="choose(record)"
            >
              {{ record.res_name }}
</Button><Button v-if="column.key === 'action'" @click="choose(record)">
              进入逐集审核
            </Button>
          </template>
          <template #emptyText>
            <Empty
              description="暂无可审核作品，请让作品负责人将你添加为协作者"
            />
          </template>
        </Table>
      </template>
    </div>
  </Page>
</template>
