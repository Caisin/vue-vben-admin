<script lang="ts" setup>
import type { PhoneGroup, PhoneGroupWrite } from '#/api/msg';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import { PhoneGroupApi } from '#/api/msg';

const emit = defineEmits<{ success: [] }>();

const editing = ref<PhoneGroup>();

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 64 },
      fieldName: 'grp_code',
      label: '分组编码',
      rules: z
        .string()
        .min(1, '请输入分组编码')
        .regex(/^[\w-]+$/, '仅支持字母、数字、下划线和短横线'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 100 },
      fieldName: 'grp_name',
      label: '分组名称',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      defaultValue: 0,
      fieldName: 'order_no',
      label: '排序',
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用',
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 1000, rows: 4, showCount: true },
      fieldName: 'remark',
      formItemClass: 'md:col-span-2',
      label: '备注',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<{ row?: PhoneGroup }>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as PhoneGroupWrite;
      const payload = normalizeSubmitValues(values);
      if (editing.value) {
        await PhoneGroupApi.update(editing.value.id, payload);
        message.success('号码分组已更新');
      } else {
        await PhoneGroupApi.create(payload);
        message.success('号码分组已创建');
      }
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    editing.value = data?.row;
    await formApi.reset();
    await formApi.setValues(
      editing.value
        ? {
            enabled: editing.value.enabled,
            grp_code: editing.value.grp_code,
            grp_name: editing.value.grp_name,
            order_no: editing.value.order_no,
            remark: editing.value.remark,
          }
        : { enabled: true, order_no: 0, remark: '' },
    );
  },
});

function normalizeSubmitValues(values: PhoneGroupWrite): PhoneGroupWrite {
  return {
    enabled: Boolean(values.enabled),
    grp_code: String(values.grp_code ?? '').trim(),
    grp_name: String(values.grp_name ?? '').trim(),
    order_no: Number(values.order_no ?? 0),
    remark: String(values.remark ?? '').trim(),
  };
}

const drawerTitle = computed(() =>
  editing.value ? '编辑号码分组' : '新增号码分组',
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
