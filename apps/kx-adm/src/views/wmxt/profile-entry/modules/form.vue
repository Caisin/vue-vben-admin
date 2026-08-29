<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  WmxtMiniProgramPageOption,
  WmxtProfileEntry,
  WmxtProfileEntryWrite,
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
  profileTargetOptions,
} from '../data';

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtProfileEntry>();
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
      onChange: (value: WmxtRole) => void loadPageOptions(value, true),
      options: profileTargetOptions,
    },
    fieldName: 'target',
    help: '决定功能显示在管理端、个人端或单位端“我的”页面。目标页面和 API 仍由角色权限校验。',
    label: '目标端',
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    fieldName: 'code',
    help: '同一目标端内稳定唯一，建议使用小写字母和下划线。',
    label: '功能编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'group_name',
    help: '同名功能会显示在同一列表分组中；留空时归入“其他功能”。',
    label: '分组名称',
  },
  {
    component: 'Input',
    fieldName: 'title',
    help: '“我的”页面列表项主标题。',
    label: '功能名称',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'subtitle',
    formItemClass: 'md:col-span-2',
    help: '可选的业务说明，显示在标题下方；为空时列表自动使用紧凑布局。',
    label: '功能说明',
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
    help: '仅展示当前目标端可直接访问的启用页面；需要动态参数的页面不能作为固定入口。',
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
    help: '只提供小程序内置并已验证可显示的图标；没有上传图标时使用此项。',
    label: '内置图标',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'sort_order',
    help: '数字越小越靠前；列表也支持拖动排序。',
    label: '排序',
  },
  {
    component: 'FileUrlInput',
    componentProps: {
      accept: 'image/*',
      buttonText: '选择上传图标',
      placeholder: '可选：上传后覆盖内置图标',
      valueMode: 'id',
    },
    fieldName: 'icon_file_id',
    formItemClass: 'md:col-span-2',
    help: '复用公共文件组件并只保存稳定 file_id；清空后恢复内置图标。',
    label: '上传图标',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: enabledStatusOptions },
    fieldName: 'status',
    help: '停用后不会显示在对应端“我的”页面。',
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
  const pages = await WmxtAdminApi.profile_entry_pages({ target });
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
          options.length > 0 ? '请选择小程序页面' : '当前目标端暂无可选页面',
        showSearch: true,
      },
      fieldName: 'page_id',
    },
  ]);
  if (clearSelected) await formApi.setFieldValue('page_id', undefined);
}

function normalizeId(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
  return Number(value);
}

function normalizeWrite(
  values: Record<string, unknown>,
): WmxtProfileEntryWrite {
  return {
    code: String(values.code ?? '').trim(),
    group_name: String(values.group_name ?? '').trim(),
    icon_file_id: normalizeId(values.icon_file_id),
    icon_name: String(values.icon_name || 'apps').trim(),
    page_id: normalizeId(values.page_id),
    sort_order: Number(values.sort_order ?? 0),
    status: (values.status || 'active') as WmxtProfileEntryWrite['status'],
    subtitle: String(values.subtitle ?? '').trim(),
    target: (values.target || currentTarget.value) as WmxtRole,
    title: String(values.title ?? '').trim(),
  };
}

const [Drawer, drawerApi] = useVbenDrawer<{
  row?: WmxtProfileEntry;
  target?: WmxtRole;
}>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = normalizeWrite(await formApi.getValues());
      await (current.value?.id
        ? WmxtAdminApi.update_profile_entry(current.value.id, values)
        : WmxtAdminApi.create_profile_entry(values));
      message.success('我的功能已保存');
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
    current.value = row?.id
      ? await WmxtAdminApi.profile_entry(row.id)
      : undefined;
    await formApi.reset();
    await loadPageOptions(current.value?.target ?? currentTarget.value, false);
    await formApi.setValues(
      current.value ?? {
        code: '',
        group_name: '',
        icon_file_id: undefined,
        icon_name: 'apps',
        page_id: undefined,
        sort_order: 0,
        status: 'active',
        subtitle: '',
        target: currentTarget.value,
        title: '',
      },
    );
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑我的功能' : '新增我的功能',
);
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
