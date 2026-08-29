<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, nextTick, reactive, watch } from 'vue';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  TextArea,
  Upload,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

const props = withDefaults(
  defineProps<{
    mode?: 'editor' | 'player' | 'selector';
    moduleKey: string;
    open?: boolean;
    record?: Record<string, any>;
    title: string;
  }>(),
  { mode: 'editor', open: false, record: () => ({}) },
);

const emit = defineEmits<{
  close: [];
  confirm: [value: Record<string, any>];
  upload: [file: File];
}>();

const model = reactive<Record<string, any>>({});

const fields = computed(() => {
  const keys = Object.keys(model);
  if (keys.length > 0) return keys;
  if (props.mode === 'selector') return ['id', 'name', 'title', 'state'];
  if (props.mode === 'player') return ['title', 'url', 'duration', 'state'];
  return ['id', 'name', 'title', 'remark', 'state'];
});

const columns = computed(() =>
  fields.value.map((key) => ({ field: key, title: labelize(key) })),
);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: columns.value,
    height: 260,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions,
});

watch(
  () => props.record,
  async (record) => {
    Object.keys(model).forEach((key) => Reflect.deleteProperty(model, key));
    Object.assign(model, JSON.parse(JSON.stringify(record ?? {})));
    await nextTick();
    gridApi.setGridOptions({ columns: columns.value });
    await gridApi.grid.reloadData(Object.keys(model).length > 0 ? [model] : []);
  },
  { immediate: true },
);

function labelize(key: string) {
  const labels: Record<string, string> = {
    duration: '时长',
    id: 'ID',
    name: '名称',
    remark: '备注',
    state: '状态',
    title: '标题',
    url: '地址',
  };
  return labels[key] ?? key;
}

function confirm() {
  emit('confirm', JSON.parse(JSON.stringify(model)));
}

function beforeUpload(file: File) {
  emit('upload', file);
  return false;
}
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    width="720px"
    @cancel="emit('close')"
    @ok="confirm"
  >
    <Space v-if="mode === 'player'" direction="vertical" class="w-full">
      <video
        v-if="model.url"
        class="max-h-[420px] w-full bg-black"
        controls
        :src="model.url"
      ></video>
      <Card v-else>请从资源章节行传入播放地址后预览。</Card>
      <Form layout="vertical">
        <FormItem v-for="key in fields" :key="key" :label="labelize(key)">
          <Input v-model:value="model[key]" allow-clear />
        </FormItem>
      </Form>
    </Space>

    <Space v-else-if="mode === 'selector'" direction="vertical" class="w-full">
      <Grid />
      <Upload :before-upload="beforeUpload" :show-upload-list="false">
        <Button>上传文件</Button>
      </Upload>
    </Space>

    <Form v-else layout="vertical">
      <FormItem v-for="key in fields" :key="key" :label="labelize(key)">
        <InputNumber
          v-if="typeof model[key] === 'number'"
          v-model:value="model[key]"
          class="w-full"
        />
        <TextArea
          v-else-if="typeof model[key] === 'object'"
          :value="JSON.stringify(model[key], null, 2)"
          :rows="4"
          @change="
            (event) => (model[key] = JSON.parse(event.target.value || 'null'))
          "
        />
        <Select
          v-else-if="key === 'state'"
          v-model:value="model[key]"
          allow-clear
          :options="[
            { label: '启用', value: 1 },
            { label: '停用', value: 0 },
          ]"
        />
        <Input v-else v-model:value="model[key]" allow-clear />
      </FormItem>
    </Form>
  </Modal>
</template>
