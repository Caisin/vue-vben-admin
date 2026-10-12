<script setup lang="ts">
import type { GrantResource } from '#/api/res/grant-maintenance';

import { ref } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
  Pagination,
  Table,
  Tag,
} from 'antdv-next';

import { grantApi } from '#/api/res/grant-maintenance';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{ delivery: boolean; disabled?: boolean }>();
const selected = defineModel<GrantResource[]>('value', { required: true });
const open = ref(false);
const rows = ref<GrantResource[]>([]);
const keyword = ref('');
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const errorText = ref('');
let generation = 0;
async function load(reset = false) {
  if (reset) page.value = 1;
  const seq = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await grantApi(props.delivery).options(
      keyword.value,
      page.value,
    );
    if (seq !== generation) return;
    rows.value = result.items;
    total.value = Number(result.total);
  } catch (error) {
    if (seq === generation)
      errorText.value = requestErrorMessage(error, '读取作品失败');
  } finally {
    if (seq === generation) loading.value = false;
  }
}
function toggle(row: GrantResource, checked: boolean) {
  selected.value = checked
    ? [
        ...selected.value.filter(
          (r) => Number(r.res_id) !== Number(row.res_id),
        ),
        row,
      ]
    : selected.value.filter((r) => Number(r.res_id) !== Number(row.res_id));
}
</script>
<template>
  <div>
    <Button
      :disabled="disabled"
      @click="
        open = true;
        load(true);
      "
    >
      选择作品（已选 {{ selected.length }} 部）
    </Button>
    <div class="mt-2 flex flex-wrap gap-2">
      <Tag
        v-for="row in selected"
        :key="row.res_id"
        :closable="!disabled"
        @close.prevent="toggle(row, false)"
      >
        {{ row.name }} · {{ row.code }}
      </Tag>
    </div>
    <Modal
      v-model:open="open"
      title="选择授权作品"
      get-container="body"
      :width="840"
      :z-index="1250"
      :footer="null"
    >
      <div class="mb-3 flex gap-2">
        <Input
          v-model:value="keyword"
          placeholder="按作品名或编码搜索"
          allow-clear
          @press-enter="load(true)"
        />
        <Button :loading="loading" @click="load(true)">查询</Button>
      </div>
      <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
      <Table
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="res_id"
        :columns="[
          { title: '选择', key: 'select', width: 70 },
          { title: '作品名称', dataIndex: 'name' },
          { title: '作品编码', dataIndex: 'code' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <Checkbox
            v-if="column.key === 'select'"
            :checked="
              selected.some((r) => Number(r.res_id) === Number(record.res_id))
            "
            @change="(e) => toggle(record, e.target.checked)"
          />
        </template>
      </Table>
      <div class="mt-4 flex justify-between gap-3">
        <Pagination
          v-model:current="page"
          :page-size="20"
          :total="total"
          :show-size-changer="false"
          @change="load()"
        />
        <Button type="primary" @click="open = false">
          完成选择（{{ selected.length }}）
        </Button>
      </div>
    </Modal>
  </div>
</template>
