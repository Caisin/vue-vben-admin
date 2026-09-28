<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type {
  DownloadBatchView,
  DownloadBatchWrite,
  DownloadUserTreeNode,
} from '#/api/res/downloads';

import { computed, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';
import dayjs from 'dayjs';

import { ResDownloadApi } from '#/api/res/downloads';
import { requestErrorMessage } from '#/request-errors';

import UserTreeSelect from './user-tree-select.vue';

const props = defineProps<{
  initialUid?: number;
  userTree: DownloadUserTreeNode[];
  userTreeLoading: boolean;
  userTreeError: string;
}>();
const emit = defineEmits<{ saved: []; retry: [] }>();
const open = defineModel<boolean>('open', { default: false });
const form = reactive<DownloadBatchWrite>({
  mode: 'name',
  text: '',
  grant: { uid: 0, can_download: true, valid_from: 0, valid_until: 0 },
});
const preview = ref<DownloadBatchView>();
const applied = ref(false);
const busy = ref(false);
const submitError = ref('');
const uid = computed({
  get: () => Number(form.grant.uid) || undefined,
  set: (v: number | undefined) => {
    form.grant.uid = v ?? 0;
  },
});
function timeField(field: 'valid_from' | 'valid_until') {
  return computed({
    get: () => (form.grant[field] > 0 ? dayjs.unix(form.grant[field]) : null),
    set: (v: Dayjs | null | undefined) => {
      form.grant[field] = v?.isValid() ? v.unix() : 0;
    },
  });
}
const validFrom = timeField('valid_from');
const validUntil = timeField('valid_until');
const count = computed(() => preview.value?.matched_res_ids.length ?? 0);
const modes = [
  { label: '每行一个剧名', value: 'name' },
  { label: '每行一个作品编码', value: 'code' },
];
const columns = [
  { title: '行号', dataIndex: 'line', width: 65 },
  { title: '输入', dataIndex: 'input', width: 180 },
  { title: '匹配结果', key: 'result', width: 200 },
  { title: '匹配剧目 / 作品编码', key: 'matches' },
];

watch(open, (value) => {
  if (!value) {
    return;
  }
  form.text = '';
  form.mode = 'name';
  form.grant = {
    uid: props.initialUid ?? 0,
    can_download: true,
    valid_from: 0,
    valid_until: 0,
  };
  preview.value = undefined;
  applied.value = false;
  submitError.value = '';
});
watch(
  () => [
    form.mode,
    form.text,
    form.grant.uid,
    form.grant.valid_from,
    form.grant.valid_until,
  ],
  () => {
    preview.value = undefined;
    applied.value = false;
    submitError.value = '';
  },
);
async function submit(apply: boolean) {
  if (busy.value) return;
  submitError.value = '';
  if (!form.grant.uid || !form.text.trim()) {
    submitError.value = '请选择用户并输入剧名或作品编码';
    return;
  }
  if (apply && (!preview.value || applied.value || !count.value)) return;
  busy.value = true;
  try {
    const data: DownloadBatchWrite = {
      mode: form.mode,
      text: form.text,
      grant: { ...form.grant },
      ...(apply ? { expected_res_ids: preview.value?.matched_res_ids } : {}),
    };
    const result = await (apply
      ? ResDownloadApi.saveBatch(data)
      : ResDownloadApi.previewBatch(data));
    preview.value = result;
    if (apply) {
      applied.value = true;
      message.success(`已授权 ${result.granted_count} 部剧`);
      emit('saved');
    }
  } catch (error) {
    submitError.value = requestErrorMessage(
      error,
      apply ? '批量授权失败，请重新预览后重试' : '匹配失败',
    );
    if (apply) preview.value = undefined;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    title="批量剧授权"
    :width="900"
    :closable="!busy"
    :mask-closable="!busy"
    :keyboard="!busy"
    :footer="null"
  >
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="剧名完整匹配；同名剧不自动授权。作品编码匹配其关联的全部短剧。空行忽略，重复行去重。"
      description="每次最多 200 行、500 部剧。确认后仅授权匹配成功的剧目，已有授权按本次有效期更新。"
    />
    <Alert
      v-if="submitError"
      :message="submitError"
      type="error"
      class="mb-4"
      show-icon
    />
    <Form layout="vertical" :disabled="busy">
      <FormItem label="授权用户" html-for="batch-grant-user" required>
        <UserTreeSelect
          id="batch-grant-user"
          v-model:value="uid"
          :tree-data="userTree"
          :loading="userTreeLoading"
          :error="userTreeError"
          :disabled="busy"
          @retry="emit('retry')"
        />
      </FormItem>
      <FormItem label="匹配方式" html-for="batch-grant-mode">
        <Select
          id="batch-grant-mode"
          v-model:value="form.mode"
          :options="modes"
        />
      </FormItem>
      <FormItem
        :label="form.mode === 'name' ? '剧名列表' : '作品编码列表'"
        html-for="batch-grant-text"
        required
      >
        <Input.TextArea
          id="batch-grant-text"
          v-model:value="form.text"
          :rows="7"
          :maxlength="81920"
          :placeholder="
            form.mode === 'name'
              ? '每行输入一个完整剧名'
              : '每行输入一个作品编码'
          "
        />
      </FormItem>
      <Space wrap>
        <FormItem label="生效时间">
          <DatePicker
            v-model:value="validFrom"
            show-time
            allow-clear
            placeholder="留空立即生效"
          />
        </FormItem>
        <FormItem label="失效时间">
          <DatePicker
            v-model:value="validUntil"
            show-time
            allow-clear
            placeholder="留空永久有效"
          />
        </FormItem>
      </Space>
    </Form>
    <Alert
      v-if="preview"
      class="mb-3"
      :type="applied ? 'success' : 'info'"
      show-icon
      :message="
        applied
          ? `已授权 ${preview.granted_count} 部剧，未匹配及重名项未授权`
          : `可授权 ${count} 部剧，请检查下方匹配结果`
      "
    />
    <Table
      v-if="preview"
      :data-source="preview.lines"
      :columns="columns"
      row-key="line"
      size="small"
      :pagination="{ pageSize: 10 }"
      :scroll="{ x: 650 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'result'">
          <Tag :color="record.status === 'matched' ? 'success' : 'warning'">
            {{ record.message }}
          </Tag>
        </template>
        <template v-if="column.key === 'matches'">
          <div v-for="item in record.matches" :key="item.res_id">
            {{ item.res_name }} · {{ item.resource_code || '无作品编码' }} · #{{
              item.res_id
            }}
          </div>
        </template>
      </template>
    </Table>
    <Space class="mt-4 flex justify-end">
      <Button :disabled="busy" @click="open = false">
        {{ applied ? '完成' : '关闭' }}
      </Button>
      <Button :loading="busy" :disabled="applied" @click="submit(false)">
        预览匹配
      </Button>
      <Button
        type="primary"
        :loading="busy"
        :disabled="!preview || !count || applied"
        @click="submit(true)"
      >
        确认授权 {{ count }} 部剧
      </Button>
    </Space>
  </Modal>
</template>
