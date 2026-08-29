<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtModule, WmxtModuleWrite } from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { enabledStatusOptions } from '../data';

interface DrawerData {
  page_code?: string;
  pageOptions?: Array<{ label: string; value: string }>;
  row?: WmxtModule;
  sort_order?: number;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtModule>();
const defaultPageCode = ref('personal_home');
const defaultSortOrder = ref(0);
const pageOptions = ref<Array<{ label: string; value: string }>>([]);

const schema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: [] },
    fieldName: 'page_code',
    help: '小程序页面编码，用于决定模块在哪个页面展示，例如 personal_home。',
    label: '页面编码',
    rules: 'required',
  },
  {
    component: 'DicSelect',
    componentProps: { code: 'wmxt_module_code' },
    fieldName: 'module_code',
    help: '模块唯一编码，小程序按该编码识别模块能力和内容来源。',
    label: '模块编码',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: { placeholder: '如：文明资讯' },
    fieldName: 'module_name',
    help: '小程序端展示给用户看的模块名称。',
    label: '模块名称',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: enabledStatusOptions },
    fieldName: 'status',
    help: '启用后小程序页面展示该模块；停用后隐藏。',
    label: '状态',
    rules: 'selectRequired',
  },
  {
    component: 'Switch',
    fieldName: 'vote_enabled',
    help: '开启后，小程序内容列表会展示投票能力。',
    label: '允许投票',
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

const [Drawer, drawerApi] = useVbenDrawer<DrawerData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as Omit<
        WmxtModuleWrite,
        'sort_order'
      >;
      const payload: WmxtModuleWrite = {
        ...values,
        sort_order: current.value?.sort_order ?? defaultSortOrder.value,
      };
      await (current.value?.id
        ? WmxtAdminApi.update_module(current.value.id, payload)
        : WmxtAdminApi.create_module(payload));
      message.success('内容模块已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    current.value = data?.row;
    defaultPageCode.value = data?.page_code ?? 'personal_home';
    defaultSortOrder.value = data?.sort_order ?? 0;
    pageOptions.value = data?.pageOptions ?? [];
    await formApi.updateSchema([
      {
        componentProps: { class: 'w-full', options: pageOptions.value },
        fieldName: 'page_code',
      },
    ]);
    await formApi.reset();
    await formApi.setValues(
      current.value ?? {
        module_code: '',
        module_name: '',
        page_code: defaultPageCode.value,
        status: 'active',
        vote_enabled: false,
      },
    );
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑内容模块' : '新增内容模块',
);
</script>

<template>
  <Drawer class="w-full max-w-150" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
