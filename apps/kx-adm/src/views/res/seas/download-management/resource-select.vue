<script setup lang="ts">
import type { DownloadResourceOption } from '#/api/res/downloads';

import { computed, onMounted, ref } from 'vue';

import { Alert, Button, Select } from 'antdv-next';

import { ResDownloadApi } from '#/api/res/downloads';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{ kind: 'code' | 'name' }>();
const value = defineModel<number | string>('value');
const rows = ref<DownloadResourceOption[]>([]);
const chosen = ref<DownloadResourceOption>();
const keyword = ref('');
const page = ref(0);
const total = ref(0);
const loading = ref(false);
const errorText = ref('');
let revision = 0;
const options = computed(() => {
  const values = new Map<
    number | string,
    { label: string; value: number | string }
  >();
  for (const row of [...(chosen.value ? [chosen.value] : []), ...rows.value]) {
    const key = props.kind === 'code' ? row.resource_code : row.res_id;
    if (!key) continue;
    values.set(key, {
      value: key,
      label:
        props.kind === 'code'
          ? row.resource_code
          : `${row.res_name} · ${row.resource_code || '无编码'} · #${row.res_id}`,
    });
  }
  return [...values.values()];
});
async function load(reset = false) {
  if (loading.value && !reset) return;
  const request = ++revision;
  const next = reset ? 1 : page.value + 1;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await ResDownloadApi.taskResources({
      page: next,
      size: 50,
      keyword: keyword.value || undefined,
    });
    if (request !== revision) return;
    rows.value = reset ? result.items : [...rows.value, ...result.items];
    page.value = next;
    total.value = result.total;
  } catch (error) {
    if (request === revision)
      errorText.value = requestErrorMessage(error, '加载资源选项失败');
  } finally {
    if (request === revision) loading.value = false;
  }
}
function search(text: string) {
  keyword.value = text;
  rows.value = [];
  page.value = 0;
  total.value = 0;
  void load(true);
}
function select(input: unknown) {
  const next =
    typeof input === 'number' || typeof input === 'string' ? input : undefined;
  chosen.value =
    rows.value.find(
      (row) =>
        (props.kind === 'code' ? row.resource_code : row.res_id) === next,
    ) ?? chosen.value;
  value.value = next;
}
onMounted(() => load(true));
</script>
<template>
  <div class="min-w-64">
    <Select
      :id="`download-resource-${kind}`"
      class="w-full"
      :value="value"
      :options="options"
      :loading="loading"
      :aria-label="kind === 'code' ? '作品编码筛选' : '剧名筛选'"
      :filter-option="false"
      allow-clear
      show-search
      :placeholder="kind === 'code' ? '搜索作品编码' : '搜索剧名或编码'"
      @search="search"
      @update:value="select"
    >
      <template #popupRender="menuNode">
        <component :is="menuNode" />
        <div
          v-if="rows.length < total || errorText"
          class="p-2"
          @mousedown.prevent
        >
          <Button
            block
            size="small"
            :loading="loading"
            @click="load(page === 0)"
          >
            {{ errorText ? '重试加载' : '加载更多' }}
          </Button>
        </div>
      </template>
    </Select>
    <Alert v-if="errorText" type="error" :message="errorText" class="mt-2" />
  </div>
</template>
