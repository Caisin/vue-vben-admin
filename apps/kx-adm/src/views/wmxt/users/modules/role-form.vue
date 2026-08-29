<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtAdminUser, WmxtRole } from '#/api/wmxt';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { wmxtRoleOptions } from '../data';

interface RoleFormValues {
  roles: WmxtRole[];
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtAdminUser>();

const schema: VbenFormSchema<RoleFormValues>[] = [
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      mode: 'multiple',
      options: wmxtRoleOptions,
      placeholder: '至少选择一个角色',
    },
    fieldName: 'roles',
    help: '角色彼此独立，可同时授予个人端、单位端和管理端；至少保留一个角色。',
    label: '小程序角色',
    rules: 'selectRequired',
  },
];

const [Form, formApi] = useVbenForm<RoleFormValues>({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
    labelClass: 'whitespace-nowrap',
    labelWidth: 96,
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer<WmxtAdminUser>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !current.value) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      await WmxtAdminApi.update_user_roles(current.value.user_id, values.roles);
      message.success('小程序角色已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    current.value = drawerApi.getData();
    await formApi.reset();
    await formApi.setValues({
      roles: current.value?.roles?.length
        ? [...current.value.roles]
        : ['personal'],
    });
  },
});
</script>

<template>
  <Drawer class="w-full max-w-100" title="小程序角色权限">
    <Form class="mx-4" />
  </Drawer>
</template>
