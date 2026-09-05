<script setup lang="ts">
import type { Instance, JobDetail } from '#/api/data-sync';
import type { DataSourceView } from '#/api/system/data-source';

import { computed, ref, watch } from 'vue';

import { Plus } from '@vben/icons';

import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  TabPane,
  Tabs,
} from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { StorageConfigApi } from '#/api/storage/config';
import { DataSourceApi } from '#/api/system/data-source';

import {
  fillDefaultTargetTable,
  jobForm,
  newBinding,
  setStrategy,
  validateForm,
} from './data';
import MetadataSelect from './metadata-select.vue';
import SourceFields from './source-fields.vue';
import StrategyFields from './strategy-fields.vue';
import WarehouseSelect from './warehouse-select.vue';

const props = defineProps<{
  detail?: JobDetail;
  instances: Instance[];
  open: boolean;
}>();
const emit = defineEmits<{
  instance: [];
  saved: [number];
  'update:open': [boolean];
}>();
const form = ref(jobForm());
const saving = ref(false);
const submitted = ref(false);
const targetTableField = ref<HTMLElement>();
const targetTableMissing = computed(
  () => submitted.value && !form.value.target_table.trim(),
);
const sources = ref<DataSourceView[]>([]);
const stores = ref<{ label: string; value: string }[]>([]);
const targets = computed(() =>
  sources.value
    .filter((source) => source.db_type === 'databend')
    .map((source) => ({ value: source.ds_code, label: source.name })),
);
const targetKey = computed(() =>
  props.open && form.value.target_ds_code
    ? JSON.stringify([
        form.value.target_ds_code,
        form.value.allow_insecure,
        form.value.warehouse,
      ])
    : '',
);
let opened = 0;
watch(
  () => props.open,
  async (open) => {
    const request = ++opened;
    if (!open) return;
    submitted.value = false;
    form.value = jobForm(props.detail);
    const [data, storage] = await Promise.all([
      DataSourceApi.list({ size: 100, state: true }),
      StorageConfigApi.list({ size: 100, is_public: false }),
    ]);
    if (request !== opened) return;
    sources.value = data.items;
    stores.value = storage.items.map((store) => ({
      label: store.storage_name,
      value: store.code,
    }));
  },
);
watch(
  () => form.value.config.sources[0]?.table,
  () => {
    if (props.open && !props.detail) fillDefaultTargetTable(form.value);
  },
  { immediate: true },
);
async function save() {
  submitted.value = true;
  const invalid = validateForm(form.value);
  if (invalid) {
    message.warning(invalid);
    if (invalid === '请填写目标表名') {
      targetTableField.value?.scrollIntoView({
        block: 'center',
        behavior: 'auto',
      });
      targetTableField.value
        ?.querySelector('input')
        ?.focus({ preventScroll: true });
    }
    return;
  }
  saving.value = true;
  try {
    for (const source of form.value.config.sources) {
      if (form.value.config.mode === 'id_append') source.updated_column = null;
      source.soft_delete_column ||= null;
    }
    const job = await DataSyncApi.save(form.value, props.detail?.job.id);
    emit('update:open', false);
    emit('saved', job.id);
    message.success('同步配置已保存');
  } finally {
    saving.value = false;
  }
}
function addSource() {
  form.value.config.sources.push(newBinding());
  setStrategy(form.value.config, form.value.config.mode);
}
</script>
<template>
  <Modal
    :open="open"
    :title="detail ? '编辑同步配置' : '新增同步任务'"
    :width="1040"
    :z-index="2200"
    ok-text="保存配置"
    :confirm-loading="saving"
    @ok="save"
    @cancel="emit('update:open', false)"
  >
    <div class="editor">
      <h3>任务与目标</h3>
      <div class="form-grid">
        <label>任务名称<Input v-model:value="form.name" :maxlength="128" /></label>
        <label>Databend 数据源<Select
            v-model:value="form.target_ds_code"
            aria-label="Databend 数据源"
            :options="targets"
            show-search
            option-filter-prop="label"
            :disabled="!!detail"
            @change="
              form.target_database = '';
              form.warehouse = null;
            "
        /></label>
        <label>目标数据库<MetadataSelect
            v-model:value="form.target_database"
            label="目标数据库"
            :context-key="targetKey"
            :disabled="!!detail || !targetKey"
            :load="
              (keyword) =>
                DataSyncApi.targetDatabases({
                  ds_code: form.target_ds_code,
                  allow_insecure: form.allow_insecure,
                  warehouse: form.warehouse,
                  keyword,
                })
            "
        /></label>
        <label ref="targetTableField"><span>目标表 <span class="text-red-500" aria-hidden="true">*</span></span><Input
            v-model:value="form.target_table"
            placeholder="新建目标表名"
            aria-label="目标表"
            aria-required="true"
            :aria-invalid="targetTableMissing"
            :status="targetTableMissing ? 'error' : undefined"
            :disabled="!!detail"
          /><span
            v-if="targetTableMissing"
            class="text-xs text-red-500"
            role="alert"
            >请填写目标表名</span></label>
        <label>计算仓库<WarehouseSelect
            v-model:value="form.warehouse"
            :ds-code="form.target_ds_code"
            :allow-insecure="form.allow_insecure"
            :active="open"
        /></label>
        <label>私有批次存储<Select
            v-model:value="form.config.storage_code"
            :options="stores"
            show-search
            option-filter-prop="label"
        /></label>
        <label class="check"><Checkbox v-model:checked="form.allow_insecure">允许不加密的目标连接</Checkbox></label>
      </div>
      <StrategyFields
        v-model:config="form.config"
        :disabled="!!detail?.active"
      />
      <h3 class="section-heading">
        源实例<Button type="link" @click="emit('instance')">
          <Plus class="size-4" />新增实例
        </Button>
      </h3>
      <Tabs
        type="editable-card"
        hide-add
        @edit="
          (key, action) =>
            action === 'remove' && form.config.sources.splice(Number(key), 1)
        "
      >
        <TabPane
          v-for="(source, index) in form.config.sources"
          :key="String(index)"
          :tab="source.instance_code || `源 ${index + 1}`"
          :closable="form.config.sources.length > 1"
        >
          <SourceFields
            :source="source"
            @update:source="(value) => (form.config.sources[index] = value)"
            :instances="instances"
            :mode="form.config.mode"
            :active="open"
          />
        </TabPane>
      </Tabs>
      <Button @click="addSource"><Plus class="size-4" />添加源绑定</Button>
      <h3>读取与增量策略</h3>
      <div class="form-grid">
        <label>ID 区间跨度<InputNumber
            v-model:value="form.config.limits.id_span"
            :min="1"
            :max="1000000"
        /></label>
        <label>每批最多行数<InputNumber
            v-model:value="form.config.limits.max_rows"
            :min="1"
            :max="10000"
        /></label>
        <label>每批字节上限<InputNumber
            v-model:value="form.config.limits.max_bytes"
            :min="1024"
            :max="67108864"
        /></label>
        <label>并发源数<InputNumber
            v-model:value="form.config.limits.source_concurrency"
            :min="1"
            :max="8"
        /></label>
        <label>时间重叠窗口（秒）<InputNumber
            v-model:value="form.config.limits.overlap_seconds"
            :min="0"
            :max="2678400"
        /></label>
        <label>提交等待窗口（秒）<InputNumber
            v-model:value="form.config.limits.settle_delay_seconds"
            :min="0"
            :max="86400"
        /></label>
      </div>
    </div>
  </Modal>
</template>
<style scoped>
.editor {
  max-height: 70vh;
  padding: 0 4px;
  overflow-y: auto;
}

h3 {
  margin: 20px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.form-grid > label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.check {
  justify-content: flex-end;
  padding-bottom: 6px;
}

.form-grid :deep(.ant-input-number) {
  width: 100%;
}

@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
