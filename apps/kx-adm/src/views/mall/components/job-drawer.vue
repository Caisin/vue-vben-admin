<script lang="ts" setup>
import type {
  MallJobCreateRequest,
  MallJobDispatchView,
  MallJobType,
} from '#/api/mall';
import type { JsonValue } from '#/api/request';
import type {
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Input,
  InputNumber,
  message,
  Space,
  Tag,
} from 'antdv-next';

import { MallAdminApi } from '#/api/mall';
import { FilePicker } from '#/components/file-picker';
import { Times } from '#/times';

const emit = defineEmits<{ success: [] }>();

interface JobDrawerData {
  default_sku_id?: number | string;
  job_type: MallJobType;
  params?: JsonValue;
  title: string;
}

const pickerRef = ref<FilePickerExpose>();
const data = ref<JobDrawerData>();
const inputFileId = ref<number | string>();
const inputFileName = ref('');
const skuId = ref<number | string>();
const idempotencyKey = ref('');
const submitting = ref(false);
const result = ref<MallJobDispatchView>();

const [Drawer, drawerApi] = useVbenDrawer<JobDrawerData>({
  async onOpenChange(open) {
    if (!open) {
      inputFileId.value = undefined;
      inputFileName.value = '';
      skuId.value = undefined;
      idempotencyKey.value = '';
      result.value = undefined;
      return;
    }
    data.value = drawerApi.getData();
    skuId.value = data.value?.default_sku_id;
    idempotencyKey.value = `${data.value?.job_type ?? 'mall_job'}-${Date.now()}`;
  },
});

const title = computed(() => data.value?.title ?? '商城批量任务');
const needSku = computed(() => data.value?.job_type === 'virtual_code_import');
const needInputFile = computed(() => data.value?.job_type !== 'order_export');

function openPicker() {
  pickerRef.value?.open();
}

function onFileSelected(files: SelectedStorageFile[]) {
  const [file] = files;
  inputFileId.value = file?.file_id;
  inputFileName.value = file?.file?.file_name ?? '';
}

async function submit() {
  if (!data.value) {
    return;
  }
  if (needInputFile.value && !inputFileId.value) {
    message.warning('请选择导入文件');
    return;
  }
  if (needSku.value && !skuId.value) {
    message.warning('请输入虚拟码目标 SKU ID');
    return;
  }
  submitting.value = true;
  drawerApi.lock();
  try {
    const payload: MallJobCreateRequest = {
      idempotency_key:
        idempotencyKey.value.trim() || `${data.value.job_type}-${Date.now()}`,
      job_type: data.value.job_type,
      params: data.value.params ?? {},
      ...(needInputFile.value ? { input_file_id: inputFileId.value } : {}),
      ...(needSku.value ? { sku_id: skuId.value } : {}),
    };
    result.value = await MallAdminApi.createJob(payload);
    message.success(result.value.message || '任务已提交');
    emit('success');
  } finally {
    submitting.value = false;
    drawerApi.unlock();
  }
}
</script>

<template>
  <Drawer class="w-full max-w-160" :title="title">
    <FilePicker ref="pickerRef" :multiple="false" @confirm="onFileSelected" />
    <div class="mx-4 grid gap-4">
      <Alert
        :message="
          needInputFile
            ? '任务文件必须上传到 mall/private 绑定的私有 Storage；明细、错误和导出结果保存在商城 Job，不写入 TaskRun 日志。'
            : '订单导出将按当前默认条件生成脱敏私有文件；导出结果保存在商城 Job，不写入 TaskRun 日志。'
        "
        show-icon
        type="info"
      />
      <Space v-if="needInputFile">
        <Button @click="openPicker">选择文件</Button>
        <span class="text-muted-foreground">
          {{ inputFileId ? `#${inputFileId} ${inputFileName}` : '未选择文件' }}
        </span>
      </Space>
      <Input
        v-model:value="idempotencyKey"
        placeholder="幂等键，重复提交同一键会复用既有 Job"
      />
      <InputNumber
        v-if="needSku"
        v-model:value="skuId"
        class="w-full"
        :min="1"
        placeholder="虚拟码目标 SKU ID"
      />
      <Button
        v-access:code="'mall:job:run'"
        :loading="submitting"
        type="primary"
        @click="submit"
      >
        提交任务
      </Button>
      <Descriptions v-if="result" bordered size="small" :column="1">
        <DescriptionsItem label="Job ID">{{ result.job.id }}</DescriptionsItem>
        <DescriptionsItem label="状态">
          <Tag>{{ result.job.status }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="总数">
          {{ result.job.total_count }}
        </DescriptionsItem>
        <DescriptionsItem label="成功/失败/跳过">
          {{ result.job.succeeded_count }} / {{ result.job.failed_count }} /
          {{ result.job.skipped_count }}
        </DescriptionsItem>
        <DescriptionsItem label="TaskRun">
          {{ result.job.task_run_id || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="更新时间">
          {{ Times.formatOptionalUnix(result.job.updated_at) }}
        </DescriptionsItem>
        <DescriptionsItem v-if="result.job.error_summary" label="错误摘要">
          {{ result.job.error_summary }}
        </DescriptionsItem>
      </Descriptions>
    </div>
  </Drawer>
</template>
