<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  TargetRole,
  TaskStatus,
  WmxtTask,
  WmxtTaskWrite,
} from '#/api/wmxt';
import type { StorageFileReference } from '#/components/file-picker';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { fileRefsFromJson, fileRefsToJson, toNumber } from '../../utils';

interface TaskFormValues {
  category: string;
  deadline?: number | string;
  description: string;
  images_refs: StorageFileReference[];
  location_lat?: number;
  location_lng?: number;
  location_name: string;
  location_required: boolean;
  max_participants: number;
  points: number;
  status: TaskStatus;
  target_role: TargetRole;
  task_type: string;
  title: string;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtTask>();

const schema: VbenFormSchema<TaskFormValues>[] = [
  {
    component: 'Input',
    componentProps: { placeholder: '请输入任务标题' },
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    help: '小程序任务列表和详情页展示的主标题，也是用户识别任务的主要信息。',
    label: '标题',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 4 } },
    fieldName: 'description',
    formItemClass: 'md:col-span-2',
    help: '任务详情说明，需包含完成要求、提交材料口径和注意事项。',
    label: '描述',
    rules: 'required',
  },
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_task_category' },
    fieldName: 'category',
    help: '用于小程序端任务分类筛选和运营统计。',
    label: '分类',
    rules: 'selectRequired',
  },
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_task_type' },
    fieldName: 'task_type',
    help: '任务业务类型，决定任务在小程序端的归属和展示语义。',
    label: '类型',
    rules: 'selectRequired',
  },
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_target_role' },
    fieldName: 'target_role',
    help: '控制哪些小程序角色可以看到并参与该任务。',
    label: '对象',
    rules: 'selectRequired',
  },
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_task_status' },
    fieldName: 'status',
    help: '草稿不对用户开放；发布后可参与；关闭后停止参与。',
    label: '状态',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'points',
    help: '用户完成任务并审核通过后可获得的积分。',
    label: '积分',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'max_participants',
    help: '最大参与人数；填 0 表示不限制。',
    label: '人数上限',
  },
  {
    component: 'DatePicker',
    componentProps: { class: 'w-full', showTime: true, valueFormat: 'X' },
    fieldName: 'deadline',
    help: '超过截止时间后，小程序端不应继续允许提交。',
    label: '截止时间',
    rules: 'required',
  },
  {
    component: 'Switch',
    fieldName: 'location_required',
    help: '开启后，用户提交任务时需要提供定位信息。',
    label: '要求定位',
  },
  {
    component: 'Input',
    fieldName: 'location_name',
    formItemClass: 'md:col-span-2',
    help: '任务地点名称，小程序端用于展示定位要求。',
    label: '地点名称',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', precision: 6 },
    dependencies: {
      show: (values) => Boolean(values.location_required),
      triggerFields: ['location_required'],
    },
    fieldName: 'location_lat',
    help: '需要精确校验位置时填写纬度。',
    label: '纬度',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', precision: 6 },
    dependencies: {
      show: (values) => Boolean(values.location_required),
      triggerFields: ['location_required'],
    },
    fieldName: 'location_lng',
    help: '需要精确校验位置时填写经度。',
    label: '经度',
  },
  {
    component: 'FileUrlsInput',
    componentProps: {
      accept: 'image/*',
      buttonText: '选择图片',
      valueMode: 'ref-list',
    },
    fieldName: 'images_refs',
    formItemClass: 'md:col-span-2',
    help: '任务详情展示图片；从文件库选择后仅保存稳定文件引用，预览时再换取临时 URL。',
    label: '详情图片',
  },
];

const [Form, formApi] = useVbenForm<TaskFormValues>({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
    labelClass: 'whitespace-nowrap',
    labelWidth: 96,
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

function buildPayload(values: TaskFormValues): WmxtTaskWrite {
  return {
    category: values.category,
    deadline: toNumber(values.deadline),
    description: values.description,
    id: current.value?.id,
    images: fileRefsToJson(values.images_refs),
    location_lat: values.location_required
      ? (values.location_lat ?? null)
      : null,
    location_lng: values.location_required
      ? (values.location_lng ?? null)
      : null,
    location_name: values.location_name ?? '',
    location_required: Boolean(values.location_required),
    max_participants: toNumber(values.max_participants),
    points: toNumber(values.points),
    status: values.status,
    target_role: values.target_role,
    task_type: values.task_type,
    title: values.title,
  };
}

const [Drawer, drawerApi] = useVbenDrawer<WmxtTask>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues();
    if (
      values.location_required &&
      (values.location_lat === undefined || values.location_lng === undefined)
    ) {
      message.warning('要求定位时请填写经纬度');
      return;
    }

    drawerApi.lock();
    try {
      const payload = buildPayload(values);
      await (current.value?.id
        ? WmxtAdminApi.update_task(current.value.id, payload)
        : WmxtAdminApi.create_task(payload));
      message.success('任务已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const row = drawerApi.getData();
    current.value = row?.id ? row : undefined;
    await formApi.reset();
    await formApi.setValues({
      category: current.value?.category || '环境整治',
      deadline: current.value?.deadline
        ? String(current.value.deadline)
        : undefined,
      description: current.value?.description ?? '',
      images_refs: fileRefsFromJson(current.value?.images),
      location_name: current.value?.location_name ?? '',
      location_required: current.value?.location_required ?? false,
      max_participants: 0,
      points: toNumber(current.value?.points),
      status: current.value?.status ?? 'published',
      target_role: current.value?.target_role ?? 'org',
      task_type: current.value?.task_type || 'org',
      title: current.value?.title ?? '',
    });
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑任务' : '新增任务',
);
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
