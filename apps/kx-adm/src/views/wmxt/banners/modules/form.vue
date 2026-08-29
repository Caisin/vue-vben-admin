<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtBanner, WmxtBannerWrite } from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { enabledStatusOptions } from '../data';

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtBanner>();
const targetOptions = [
  { label: '全部', value: 'all' },
  { label: '个人端', value: 'personal' },
  { label: '单位端', value: 'org' },
];
const materialTypeOptions = [
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
];
const linkTypeOptions = [
  { label: '小程序页面', value: 'page' },
  { label: '网页链接', value: 'url' },
  { label: '不跳转', value: 'none' },
];
const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    help: '小程序轮播图上展示的标题，可为空。',
    label: '标题',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 2, maxRows: 5 } },
    fieldName: 'description',
    formItemClass: 'md:col-span-2',
    help: '轮播说明文字，可用于运营备注或前端展示。',
    label: '描述',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: targetOptions },
    fieldName: 'target',
    help: '控制轮播投放到个人端、单位端或全部端。',
    label: '投放端',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: materialTypeOptions },
    fieldName: 'material_type',
    help: '素材类型需与素材文件对应，图片填 image，视频填 video。',
    label: '素材类型',
    rules: 'selectRequired',
  },
  {
    component: 'FileUrlInput',
    componentProps: { accept: 'image/*,video/*', buttonText: '选择素材' },
    fieldName: 'url',
    formItemClass: 'md:col-span-2',
    help: '图片或视频素材；从文件库选择时保存文件 ID，展示时再换取临时 URL；公开外链才直接填写 URL。',
    label: '素材文件',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: linkTypeOptions },
    fieldName: 'link_type',
    help: '点击轮播后的跳转类型。',
    label: '跳转类型',
  },
  {
    component: 'Input',
    fieldName: 'link',
    help: 'link_type 为 page 时填写小程序页面路径；为 url 时填写网页地址。',
    label: '跳转地址',
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
const [Drawer, drawerApi] = useVbenDrawer<WmxtBanner>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as WmxtBannerWrite;
      await (current.value?.id
        ? WmxtAdminApi.update_banner(current.value.id, values)
        : WmxtAdminApi.create_banner(values));
      message.success('轮播已保存');
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
        description: '',
        link: '',
        link_type: 'page',
        material_type: 'image',
        sort_order: 0,
        status: 'active',
        target: 'all',
        title: '',
        url: '',
      },
    );
  },
});
const drawerTitle = computed(() =>
  current.value?.id ? '编辑轮播' : '新增轮播',
);
</script>
<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
