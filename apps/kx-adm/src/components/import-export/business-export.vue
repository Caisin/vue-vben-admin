<script lang="ts" setup>
import type { ImportExportDefinition, TransferRun } from '#/api/import-export';

import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { Download, RotateCw } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Space,
  Switch,
  Tag,
} from 'antdv-next';

import { ImportExportApi } from '#/api/import-export';

const props = withDefaults(
  defineProps<{
    buttonText?: string;
    defaultOptions?: Record<string, unknown>;
    definitionCode: string;
    disabled?: boolean;
  }>(),
  {
    buttonText: '导出',
    defaultOptions: () => ({}),
    disabled: false,
  },
);

const emit = defineEmits<{
  completed: [run: TransferRun];
  submitted: [run: TransferRun];
}>();

const open = ref(false);
const loading = ref(false);
const submitting = ref(false);
const downloading = ref(false);
const definition = ref<ImportExportDefinition>();
const run = ref<TransferRun>();
const options = reactive<Record<string, any>>({});
let pollTimer: number | undefined;

const fields = computed(() =>
  Object.entries(definition.value?.options_schema.properties ?? {}).map(
    ([name, schema]) => ({
      name,
      required: definition.value?.options_schema.required?.includes(name),
      title: schema.title || name,
      type: schema.type || 'string',
    }),
  ),
);

const terminal = computed(() =>
  [
    'cancelled',
    'failed',
    'partially_succeeded',
    'submit_failed',
    'succeeded',
  ].includes(run.value?.status ?? ''),
);

function clearPoll() {
  if (pollTimer !== undefined) window.clearTimeout(pollTimer);
  pollTimer = undefined;
}

async function show() {
  open.value = true;
  run.value = undefined;
  loading.value = true;
  try {
    definition.value = await ImportExportApi.definition(props.definitionCode);
    for (const key of Object.keys(options))
      Reflect.deleteProperty(options, key);
    for (const [name, schema] of Object.entries(
      definition.value.options_schema.properties ?? {},
    )) {
      options[name] =
        props.defaultOptions[name] ??
        schema.default ??
        (schema.type === 'boolean' ? false : '');
    }
    run.value =
      (await ImportExportApi.activeExportRun(props.definitionCode)) ??
      undefined;
    if (run.value) schedulePoll();
  } finally {
    loading.value = false;
  }
}

async function submit() {
  for (const field of fields.value) {
    if (
      field.required &&
      (options[field.name] === undefined || options[field.name] === '')
    ) {
      message.warning(`请填写${field.title}`);
      return;
    }
  }
  submitting.value = true;
  try {
    run.value = await ImportExportApi.createExportRun(
      props.definitionCode,
      options,
    );
    emit('submitted', run.value);
    message.success('导出任务已提交');
    schedulePoll();
  } finally {
    submitting.value = false;
  }
}

function schedulePoll() {
  clearPoll();
  if (!run.value || terminal.value) return;
  pollTimer = window.setTimeout(refreshRun, document.hidden ? 10_000 : 1000);
}

async function refreshRun() {
  if (!run.value) return;
  try {
    run.value = await ImportExportApi.exportRun(
      props.definitionCode,
      run.value.id,
    );
    if (terminal.value) emit('completed', run.value);
  } finally {
    schedulePoll();
  }
}

async function downloadResult() {
  if (!run.value?.has_result || !definition.value) return;
  downloading.value = true;
  try {
    const blob = await ImportExportApi.exportFile(
      props.definitionCode,
      run.value.id,
    );
    downloadFileFromBlob({
      fileName: `${definition.value.display_name}.xlsx`,
      source: blob,
    });
  } finally {
    downloading.value = false;
  }
}

function statusColor(status: string) {
  if (status === 'succeeded') return 'success';
  if (['cancelled', 'failed', 'submit_failed'].includes(status)) return 'error';
  if (status === 'partially_succeeded') return 'warning';
  return 'processing';
}

onBeforeUnmount(clearPoll);
</script>

<template>
  <Button :disabled="disabled" @click="show">
    <Download class="size-4" />{{ buttonText }}
  </Button>

  <Modal
    v-model:open="open"
    :confirm-loading="submitting"
    :ok-button-props="{ disabled: loading || Boolean(run && !terminal) }"
    :ok-text="run ? '关闭' : '开始导出'"
    :title="definition?.display_name ?? '业务导出'"
    @ok="run ? (open = false) : submit()"
  >
    <div v-if="loading" class="py-8 text-center">加载中...</div>
    <div v-else-if="definition" class="grid gap-4">
      <Form v-if="!run && fields.length" layout="vertical">
        <FormItem
          v-for="field in fields"
          :key="field.name"
          :label="field.title"
          :required="field.required"
        >
          <Switch
            v-if="field.type === 'boolean'"
            v-model:checked="options[field.name]"
          />
          <InputNumber
            v-else-if="field.type === 'integer' || field.type === 'number'"
            v-model:value="options[field.name]"
            class="w-full"
          />
          <Input v-else v-model:value="options[field.name]" />
        </FormItem>
      </Form>

      <template v-if="run">
        <div class="flex items-center justify-between">
          <Tag :color="statusColor(run.status)">{{ run.status }}</Tag>
          <Space>
            <Button v-if="!terminal" type="text" @click="refreshRun">
              <RotateCw class="size-4" />刷新
            </Button>
            <Button
              v-if="run.has_result"
              :loading="downloading"
              type="primary"
              @click="downloadResult"
            >
              <Download class="size-4" />下载结果
            </Button>
          </Space>
        </div>
        <Descriptions bordered :column="3" size="small">
          <DescriptionsItem label="总数">
            {{ run.total_count ?? '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="成功">
            {{ run.succeeded_count }}
          </DescriptionsItem>
          <DescriptionsItem label="失败">
            {{ run.failed_count }}
          </DescriptionsItem>
          <DescriptionsItem label="处理结果" :span="3">
            {{ run.error_message || run.message }}
          </DescriptionsItem>
        </Descriptions>
      </template>
    </div>
  </Modal>
</template>
