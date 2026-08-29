<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtNotification, WmxtNotificationWrite } from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { toNumber } from '../../utils';
import { enabledStatusOptions, targetRoleOptions } from '../data';

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtNotification>();

const noticeTypeOptions = [
  { label: '系统通知', value: 'system' },
  { label: '任务通知', value: 'task' },
  { label: '积分通知', value: 'points' },
  { label: '商城通知', value: 'mall' },
  { label: '活动通知', value: 'activity' },
];

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    help: '小程序通知列表展示的标题。',
    label: '标题',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 10, minRows: 4 } },
    fieldName: 'content',
    formItemClass: 'md:col-span-2',
    help: '通知正文内容，会在小程序通知详情中展示。',
    label: '内容',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: noticeTypeOptions },
    fieldName: 'notice_type',
    help: '用于小程序端分类展示和运营筛选。',
    label: '类型',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      options: targetRoleOptions.filter((item) => item.value !== 'family'),
    },
    fieldName: 'target',
    help: '控制通知面向个人端、单位端或全部用户。',
    label: '目标',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'sort_order',
    help: '数字越小越靠前。',
    label: '排序',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: enabledStatusOptions },
    fieldName: 'status',
    help: '启用后小程序端可见；停用后隐藏。',
    label: '状态',
    rules: 'selectRequired',
  },
];

const [Form, formApi] = useVbenForm({
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

const [Drawer, drawerApi] = useVbenDrawer<WmxtNotification>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      const payload: WmxtNotificationWrite = {
        content: values.content,
        id: current.value?.id,
        notice_type: values.notice_type,
        published_at: current.value?.published_at,
        sort_order: toNumber(values.sort_order),
        status: values.status,
        target: values.target,
        title: values.title,
      };
      await (current.value?.id
        ? WmxtAdminApi.update_notification(current.value.id, payload)
        : WmxtAdminApi.create_notification(payload));
      message.success('通知已保存');
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
    await formApi.setValues(
      current.value ?? {
        content: '',
        notice_type: 'system',
        sort_order: 0,
        status: 'active',
        target: 'personal',
        title: '',
      },
    );
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑通知' : '新增通知',
);
</script>

<template>
  <Drawer class="w-full max-w-150" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
