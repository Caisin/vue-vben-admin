<script lang="ts" setup>
import type {
  PayDefaultTemplatePlatform,
  PayDefaultTemplates,
  PayItem,
  PayTemplate,
} from '#/api/asset/pay';

import { computed, onMounted, ref, watch } from 'vue';

import { Check } from '@vben/icons';

import {
  Button,
  Empty,
  message,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import { PayApi } from '#/api/asset/pay';

const platform = ref<PayDefaultTemplatePlatform>('web');
const platforms = [
  { label: 'Web / H5', value: 'web' },
  { label: 'App', value: 'app' },
];
const loading = ref(false);
const previewLoading = ref(false);
const saving = ref(false);
const templates = ref<PayTemplate[]>([]);
const defaults = ref<PayDefaultTemplates>({});
const selectedTemplateId = ref<number | string>();
const previewItems = ref<PayItem[]>([]);
let previewRequest = 0;

const templateOptions = computed(() =>
  templates.value.map((template) => ({
    label: `${template.name} (${template.code})`,
    value: template.id,
  })),
);
const currentDefaultId = computed(() =>
  platform.value === 'web'
    ? defaults.value.web_template_id
    : defaults.value.app_template_id,
);
const selectedTemplate = computed(() =>
  templates.value.find(
    (template) => String(template.id) === String(selectedTemplateId.value),
  ),
);
const isCurrentDefault = computed(
  () =>
    selectedTemplateId.value !== undefined &&
    String(selectedTemplateId.value) === String(currentDefaultId.value),
);

const previewColumns = [
  { dataIndex: 'title', key: 'title', minWidth: 180, title: '商品' },
  { dataIndex: 'code', key: 'code', minWidth: 150, title: '商品编码' },
  { dataIndex: 'item_type', key: 'item_type', width: 100, title: '类型' },
  { dataIndex: 'platform', key: 'platform', width: 100, title: '平台' },
  {
    key: 'amount',
    title: '金额（最小单位）',
    width: 170,
    customRender: ({ record }: { record: PayItem }) =>
      `${record.amount_minor} ${record.currency}`,
  },
  { dataIndex: 'summary', key: 'summary', minWidth: 180, title: '摘要' },
  {
    key: 'enabled',
    title: '状态',
    width: 90,
    customRender: ({ record }: { record: PayItem }) =>
      record.enabled ? '启用' : '停用',
  },
];

async function load() {
  loading.value = true;
  try {
    const [templatePage, defaultValues] = await Promise.all([
      PayApi.templateList({ enabled: true, page: 1, size: 100 }),
      PayApi.defaultTemplates(),
    ]);
    templates.value = templatePage.items;
    defaults.value = defaultValues;
    applyCurrentDefault();
  } finally {
    loading.value = false;
  }
}

function applyCurrentDefault() {
  selectedTemplateId.value = currentDefaultId.value ?? templates.value[0]?.id;
}

async function loadPreview(templateId?: number | string) {
  const request = ++previewRequest;
  if (templateId === undefined) {
    previewItems.value = [];
    return;
  }
  previewLoading.value = true;
  try {
    const page = await PayApi.itemList({
      page: 1,
      size: 100,
      template_id: templateId,
    });
    if (request === previewRequest) previewItems.value = page.items;
  } finally {
    if (request === previewRequest) previewLoading.value = false;
  }
}

async function saveDefault() {
  if (selectedTemplateId.value === undefined) return;
  saving.value = true;
  try {
    defaults.value = await PayApi.setDefaultTemplate(platform.value, {
      template_id: selectedTemplateId.value,
    });
    message.success('默认支付模板已更新');
  } finally {
    saving.value = false;
  }
}

watch(platform, applyCurrentDefault);
watch(selectedTemplateId, (value) => loadPreview(value), { immediate: true });
onMounted(load);
</script>

<template>
  <Spin :spinning="loading">
    <div class="flex min-h-0 flex-col gap-4 py-2">
      <div class="flex flex-wrap items-center gap-3 border-b pb-4">
        <Segmented v-model:value="platform" :options="platforms" />
        <Select
          v-model:value="selectedTemplateId"
          class="w-full min-w-64 sm:w-96"
          :options="templateOptions"
          show-search
          option-filter-prop="label"
        />
        <Button
          type="primary"
          :disabled="!selectedTemplateId || isCurrentDefault"
          :loading="saving"
          @click="saveDefault"
        >
          <Check class="size-4" />
          {{ isCurrentDefault ? '当前默认' : '设为默认' }}
        </Button>
      </div>

      <div v-if="selectedTemplate" class="min-h-0">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h3 class="text-base font-medium">{{ selectedTemplate.name }}</h3>
          <Tag>{{ selectedTemplate.code }}</Tag>
          <Tag v-if="isCurrentDefault" color="success">当前默认</Tag>
        </div>
        <Spin :spinning="previewLoading">
          <Table
            :columns="previewColumns"
            :data-source="previewItems"
            :pagination="false"
            row-key="id"
            size="small"
            :scroll="{ x: 1100 }"
          >
            <template #emptyText><Empty /></template>
          </Table>
        </Spin>
      </div>
      <Empty v-else />
    </div>
  </Spin>
</template>
