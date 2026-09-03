<script lang="ts" setup>
import type { UploadFile } from 'antdv-next';

import type { ImportExportDefinition, TransferRun } from '#/api/import-export';

import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ArrowUpToLine, Download, ExternalLink, RotateCw } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  message,
  Modal,
  Space,
  Tag,
  Upload,
} from 'antdv-next';

import { ImportExportApi } from '#/api/import-export';

const props = withDefaults(
  defineProps<{
    buttonSize?: 'large' | 'middle' | 'small';
    buttonText?: string;
    definitionCode: string;
    disabled?: boolean;
  }>(),
  {
    buttonText: '导入',
    buttonSize: 'middle',
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
const resultDownloading = ref(false);
const definition = ref<ImportExportDefinition>();
const file = ref<File>();
const run = ref<TransferRun>();
let pollTimer: number | undefined;
const router = useRouter();

const terminal = computed(() =>
  [
    'cancelled',
    'failed',
    'partially_succeeded',
    'submit_failed',
    'succeeded',
  ].includes(run.value?.status ?? ''),
);

const accept = computed(() =>
  definition.value?.accepted_extensions.map((value) => `.${value}`).join(','),
);
const fileList = computed<UploadFile[]>(() =>
  file.value
    ? [{ name: file.value.name, status: 'done', uid: 'business-import-file' }]
    : [],
);

function clearPoll() {
  if (pollTimer !== undefined) window.clearTimeout(pollTimer);
  pollTimer = undefined;
}

async function show() {
  open.value = true;
  file.value = undefined;
  run.value = undefined;
  loading.value = true;
  try {
    definition.value = await ImportExportApi.definition(props.definitionCode);
    run.value =
      (await ImportExportApi.activeImportRun(props.definitionCode)) ??
      undefined;
    if (run.value) schedulePoll();
  } finally {
    loading.value = false;
  }
}

function chooseFile(selected: File) {
  const extension = selected.name.split('.').pop()?.toLowerCase() ?? '';
  if (!definition.value?.accepted_extensions.includes(extension)) {
    message.warning('文件格式不符合当前导入定义');
    return Upload.LIST_IGNORE;
  }
  if (selected.size > definition.value.max_file_size) {
    message.warning('文件超过当前导入定义允许的大小');
    return Upload.LIST_IGNORE;
  }
  file.value = selected;
  return false;
}

async function downloadTemplate() {
  if (!definition.value) return;
  downloading.value = true;
  try {
    const blob = await ImportExportApi.template(props.definitionCode);
    downloadFileFromBlob({
      fileName: `${definition.value.display_name}导入模板.xlsx`,
      source: blob,
    });
  } finally {
    downloading.value = false;
  }
}

async function downloadResult() {
  if (!run.value?.has_result) return;
  resultDownloading.value = true;
  try {
    const blob = await ImportExportApi.runFile(run.value.id, 'result');
    downloadFileFromBlob({
      fileName: `${definition.value?.display_name ?? '导入'}结果-${run.value.id}.xlsx`,
      source: blob,
    });
  } finally {
    resultDownloading.value = false;
  }
}

function openHistory() {
  const href = router.resolve({
    path: '/system/import-export-runs',
    query: { definition_code: props.definitionCode, direction: 'import' },
  }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
}

async function submit() {
  if (!file.value) {
    message.warning('请选择导入文件');
    return;
  }
  submitting.value = true;
  try {
    run.value = await ImportExportApi.createImportRun(
      props.definitionCode,
      file.value,
    );
    emit('submitted', run.value);
    message.success('导入任务已提交');
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
    run.value = await ImportExportApi.importRun(
      props.definitionCode,
      run.value.id,
    );
    if (['partially_succeeded', 'succeeded'].includes(run.value.status)) {
      emit('completed', run.value);
    }
  } finally {
    schedulePoll();
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
  <Button :disabled="disabled" :size="buttonSize" @click="show">
    <ArrowUpToLine class="size-4" />{{ buttonText }}
  </Button>

  <Modal
    v-model:open="open"
    :confirm-loading="submitting"
    :ok-button-props="{ disabled: loading || Boolean(run && !terminal) }"
    :ok-text="run ? '关闭' : '开始导入'"
    :title="definition?.display_name ?? '业务导入'"
    @ok="run ? (open = false) : submit()"
  >
    <div v-if="loading" class="py-8 text-center">加载中...</div>
    <div v-else-if="definition" class="grid gap-4">
      <Space>
        <Button :loading="downloading" @click="downloadTemplate">
          <Download class="size-4" />下载模板
        </Button>
        <span class="text-sm text-muted-foreground">
          版本 {{ definition.version }} ·
          {{ definition.accepted_extensions.join(' / ').toUpperCase() }}
        </span>
      </Space>

      <template v-if="!run">
        <Upload.Dragger
          :accept="accept"
          :before-upload="chooseFile"
          :file-list="fileList"
          :max-count="1"
        >
          <ArrowUpToLine class="mx-auto mb-2 size-6" />
          <div>{{ file?.name ?? '选择或拖入导入文件' }}</div>
        </Upload.Dragger>
      </template>

      <template v-else>
        <div class="flex items-center justify-between gap-3">
          <Tag :color="statusColor(run.status)">{{ run.status }}</Tag>
          <Space>
            <Button
              v-if="run.has_result"
              :loading="resultDownloading"
              @click="downloadResult"
            >
              <Download class="size-4" />下载结果
            </Button>
            <Button v-if="!terminal" type="text" @click="refreshRun">
              <RotateCw class="size-4" />刷新
            </Button>
            <Button type="link" @click="openHistory">
              <ExternalLink class="size-4" />导入记录
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
