<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Modal,
  Space,
  TextArea,
  Upload,
} from 'antdv-next';

import { uploadImg } from '#/api/res/seas/set/feedback';

const props = defineProps<{
  open: boolean;
  thread?: { info?: Record<string, any>; items?: Record<string, any>[] };
}>();

const emit = defineEmits<{
  submit: [value: Record<string, any>];
  'update:open': [value: boolean];
}>();

const sending = ref(false);
const form = reactive({
  email: '',
  feed_back_type: '',
  msg: '',
  imgs: [] as string[],
});

const messages = computed(() => {
  const info = props.thread?.info;
  const items = props.thread?.items ?? [];
  return [info, ...items].filter(Boolean) as Record<string, any>[];
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.email = '';
    form.feed_back_type = String(props.thread?.info?.feed_back_type ?? '');
    form.msg = '';
    form.imgs = [];
  },
);

function contentMsg(record: any) {
  const content = record?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.msg ?? content.text ?? JSON.stringify(content);
}

function contentImgs(record: any): string[] {
  const imgs = record?.content?.imgs;
  if (!Array.isArray(imgs)) return [];
  return imgs
    .map((item) => (typeof item === 'string' ? item : item?.url))
    .filter(Boolean);
}

async function beforeUpload(file: File) {
  const result = await uploadImg({ file }, () => {});
  const urls = (Array.isArray(result) ? result : [])
    .map((item) => item.url)
    .filter(Boolean);
  form.imgs.push(...urls);
  message.success('图片上传成功');
  return false;
}

async function submit() {
  if (!form.msg.trim() && form.imgs.length === 0) {
    message.warning('请输入回复内容或上传图片');
    return;
  }
  sending.value = true;
  try {
    emit('submit', {
      email: form.email || undefined,
      feed_back_type: form.feed_back_type || undefined,
      content: { msg: form.msg, imgs: form.imgs },
    });
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    title="反馈线程"
    width="860px"
    :confirm-loading="sending"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Space direction="vertical" class="w-full" :size="16">
      <div
        class="max-h-[360px] overflow-auto rounded border border-solid border-gray-200 p-3"
      >
        <Space
          v-for="item in messages"
          :key="item.id"
          direction="vertical"
          class="mb-3 w-full rounded bg-gray-50 p-3"
          size="small"
        >
          <div class="text-xs text-gray-500">
            #{{ item.id }} UID: {{ item.uid }} 回复人:
            {{ item.reply_id || '用户' }} 时间: {{ item.created_at }}
          </div>
          <div>{{ contentMsg(item) }}</div>
          <Space v-if="contentImgs(item).length" wrap>
            <Image
              v-for="url in contentImgs(item)"
              :key="url"
              :src="url"
              :width="72"
            />
          </Space>
        </Space>
      </div>

      <Form layout="vertical">
        <FormItem label="反馈类型">
          <Input v-model:value="form.feed_back_type" allow-clear />
        </FormItem>
        <FormItem label="邮箱">
          <Input v-model:value="form.email" allow-clear />
        </FormItem>
        <FormItem label="回复内容">
          <TextArea v-model:value="form.msg" :rows="4" />
        </FormItem>
        <FormItem label="图片">
          <Upload
            :before-upload="beforeUpload"
            :show-upload-list="false"
            accept="image/*"
          >
            <Button>上传图片</Button>
          </Upload>
          <Space v-if="form.imgs.length" class="mt-2" wrap>
            <Image v-for="url in form.imgs" :key="url" :src="url" :width="72" />
          </Space>
        </FormItem>
      </Form>
    </Space>
  </Modal>
</template>
