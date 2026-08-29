<script lang="ts" setup>
import { reactive, ref, watch } from 'vue';

import {
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  TextArea,
} from 'antdv-next';

import { getListAll as getSourceListAll } from '#/api/res/seas/global/source_manage';
import { savePage } from '#/api/res/seas/run/push';

const props = withDefaults(
  defineProps<{
    mode?: 'edit' | 'test';
    open?: boolean;
    record?: null | Record<string, any>;
  }>(),
  {
    mode: 'edit',
    open: false,
    record: null,
  },
);

const emit = defineEmits<{
  saved: [Record<string, any>];
  test: [Record<string, any>];
  'update:open': [boolean];
}>();

const saving = ref(false);
const sourceOptions = ref<{ label: string; value: number | string }[]>([]);
const form = reactive<Record<string, any>>({
  channel_id: undefined,
  content: '',
  endpoint_id: undefined,
  id: 0,
  img_url: '',
  item_id: undefined,
  remark: '',
  res_id: undefined,
  title: '',
  uid: undefined,
});

async function loadSources() {
  if (sourceOptions.value.length > 0) return;
  const payload: any = await getSourceListAll({
    page: 1,
    size: 500,
  });
  const rows = Array.isArray(payload) ? payload : (payload?.items ?? []);
  sourceOptions.value = rows.map((item: any) => ({
    label: `${item.id} - ${item.res_name ?? item.title ?? '未命名资源'}`,
    value: item.id,
  }));
}

function reset(record?: null | Record<string, any>) {
  Object.assign(form, {
    channel_id: undefined,
    content: '',
    endpoint_id: undefined,
    id: 0,
    img_url: '',
    item_id: undefined,
    remark: '',
    res_id: undefined,
    title: '',
    uid: undefined,
    ...record,
  });
  if (props.mode === 'test') {
    form.uid = undefined;
  }
}

function close() {
  emit('update:open', false);
}

function requireValue(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return message;
  }
  return '';
}

async function submit() {
  try {
    saving.value = true;
    if (props.mode === 'test') {
      const error =
        requireValue(form.id, '缺少推送记录 ID') ||
        requireValue(form.uid, '请输入测试用户 ID') ||
        requireValue(form.channel_id, '请输入 notify Push 通道 ID');
      if (error) {
        message.warning(error);
        return;
      }
      emit('test', {
        channel_id: Number(form.channel_id),
        endpoint_id: form.endpoint_id ? Number(form.endpoint_id) : undefined,
        id: form.id,
        uid: form.uid,
      });
      close();
      return;
    }

    const error = requireValue(form.res_id, '请选择资源');
    if (error) {
      message.warning(error);
      return;
    }
    const saved = await savePage({
      content: form.content || undefined,
      id: Number(form.id ?? 0),
      img_url: form.img_url || undefined,
      item_id: form.item_id ? Number(form.item_id) : undefined,
      remark: form.remark ?? '',
      res_id: Number(form.res_id),
      title: form.title || undefined,
    });
    emit('saved', saved);
    close();
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    reset(props.record);
    await loadSources();
  },
);
</script>

<template>
  <Modal
    :confirm-loading="saving"
    destroy-on-close
    :open="open"
    :title="
      mode === 'test' ? '测试推送' : form.id ? '编辑推送消息' : '新增推送消息'
    "
    width="680px"
    @cancel="close"
    @ok="submit"
  >
    <Form :model="form" layout="vertical">
      <template v-if="mode === 'test'">
        <FormItem label="记录 ID" required>
          <InputNumber v-model:value="form.id" class="w-full" disabled />
        </FormItem>
        <FormItem label="测试用户 ID" required>
          <InputNumber
            v-model:value="form.uid"
            class="w-full"
            placeholder="请输入用户 ID"
          />
        </FormItem>
        <FormItem label="Notify Push 通道 ID" required>
          <InputNumber
            v-model:value="form.channel_id"
            class="w-full"
            placeholder="请输入 channel_id"
          />
        </FormItem>
        <FormItem label="指定 Endpoint ID">
          <InputNumber
            v-model:value="form.endpoint_id"
            class="w-full"
            placeholder="留空则使用用户当前 Firebase endpoint"
          />
        </FormItem>
      </template>

      <template v-else>
        <FormItem label="资源" required>
          <Select
            v-model:value="form.res_id"
            option-filter-prop="label"
            :options="sourceOptions"
            placeholder="请选择资源"
            show-search
          />
        </FormItem>
        <FormItem label="章节 ID">
          <InputNumber
            v-model:value="form.item_id"
            class="w-full"
            placeholder="留空默认第一集免费章节"
          />
        </FormItem>
        <FormItem label="标题">
          <Input v-model:value="form.title" placeholder="留空使用资源标题" />
        </FormItem>
        <FormItem label="内容">
          <TextArea
            v-model:value="form.content"
            placeholder="留空使用资源简介"
            :rows="3"
          />
        </FormItem>
        <FormItem label="图片">
          <Input v-model:value="form.img_url" placeholder="留空使用资源封面" />
        </FormItem>
        <FormItem label="备注">
          <TextArea v-model:value="form.remark" :rows="2" />
        </FormItem>
      </template>
    </Form>
  </Modal>
</template>
