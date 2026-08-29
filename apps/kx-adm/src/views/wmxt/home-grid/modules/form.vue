<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  WmxtHomeEntry,
  WmxtHomeEntryWrite,
  WmxtMiniProgramPageOption,
  WmxtRole,
} from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import {
  builtinIconOptions,
  enabledStatusOptions,
  homeTargetOptions,
} from '../data';

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtHomeEntry>();
const currentTarget = ref<WmxtRole>('personal');

function pageOptionLabel(page: WmxtMiniProgramPageOption) {
  const scopeLabel = page.scope === 'common' ? '通用' : page.scope;
  return `${page.title}（${scopeLabel} / ${page.route}）`;
}

const schema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      onChange: (value: WmxtRole) => {
        void loadPageOptions(value, true);
      },
      options: homeTargetOptions,
    },
    fieldName: 'target',
    help: '控制入口展示在管理端、个人端或单位端首页。切换后会重新加载可选小程序页面。',
    label: '首页端',
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    fieldName: 'code',
    help: '同一首页端内稳定唯一的业务编码，用于后续识别入口配置。',
    label: '入口编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'title',
    help: '首页入口显示名称，建议 2-6 个中文字符，过长会换行。',
    label: '入口名称',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      optionFilterProp: 'label',
      options: [],
      placeholder: '请选择可直接跳转的小程序页面',
      showSearch: true,
    },
    fieldName: 'page_id',
    formItemClass: 'md:col-span-2',
    help: '仅展示当前首页端可直接跳转的已启用页面；需要业务参数的页面不会出现在这里。',
    label: '小程序页面',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      optionFilterProp: 'label',
      options: builtinIconOptions,
      showSearch: true,
    },
    fieldName: 'icon_name',
    help: '未上传自定义图标时，小程序与列表使用该内置图标名称作为 fallback。',
    label: '内置图标',
    rules: 'selectRequired',
  },
  {
    component: 'FileUrlInput',
    componentProps: {
      accept: 'image/*',
      buttonText: '选择上传图标',
      placeholder: '可选：选择图片后覆盖内置图标展示',
      valueMode: 'id',
    },
    fieldName: 'icon_file_id',
    formItemClass: 'md:col-span-2',
    help: '自定义图片图标可选；为空时保留 icon_name 内置图标。选择文件时只保存稳定 file_id。',
    label: '上传图标',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'sort_order',
    help: '数字越小越靠前；列表也支持拖动排序并保存为连续顺序。',
    label: '排序',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: enabledStatusOptions },
    fieldName: 'status',
    help: '启用后会按后台排序出现在对应首页，入口数量不受限制。',
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

async function loadPageOptions(target: WmxtRole, clearSelected: boolean) {
  currentTarget.value = target;
  const pages = await WmxtAdminApi.home_entry_pages({ target });
  const options = pages.map((page) => ({
    disabled: !page.selectable,
    label: pageOptionLabel(page),
    value: page.id,
  }));
  await formApi.updateSchema([
    {
      componentProps: {
        class: 'w-full',
        optionFilterProp: 'label',
        options,
        placeholder:
          options.length > 0 ? '请选择小程序页面' : '当前首页端暂无可选页面',
        showSearch: true,
      },
      fieldName: 'page_id',
    },
  ]);
  if (clearSelected) {
    await formApi.setFieldValue('page_id', undefined);
  }
}

function normalizeId(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
  return Number(value);
}

function normalizeWrite(values: Record<string, unknown>): WmxtHomeEntryWrite {
  return {
    code: String(values.code ?? '').trim(),
    icon_file_id: normalizeId(values.icon_file_id),
    icon_name: String(values.icon_name || 'apps').trim(),
    page_id: normalizeId(values.page_id),
    sort_order: Number(values.sort_order ?? 0),
    status: (values.status || 'active') as WmxtHomeEntryWrite['status'],
    target: (values.target || currentTarget.value) as WmxtRole,
    title: String(values.title ?? '').trim(),
  };
}

const [Drawer, drawerApi] = useVbenDrawer<{
  row?: WmxtHomeEntry;
  target?: WmxtRole;
}>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = normalizeWrite(await formApi.getValues());
      await (current.value?.id
        ? WmxtAdminApi.update_home_entry(current.value.id, values)
        : WmxtAdminApi.create_home_entry(values));
      message.success('首页入口已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    const row = data?.row;
    currentTarget.value = data?.target ?? row?.target ?? 'personal';
    current.value = row?.id ? await WmxtAdminApi.home_entry(row.id) : undefined;
    await formApi.reset();
    await loadPageOptions(current.value?.target ?? currentTarget.value, false);
    await formApi.setValues(
      current.value ?? {
        code: '',
        icon_file_id: undefined,
        icon_name: 'apps',
        page_id: undefined,
        sort_order: 0,
        status: 'active',
        target: currentTarget.value,
        title: '',
      },
    );
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑首页入口' : '新增首页入口',
);
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
