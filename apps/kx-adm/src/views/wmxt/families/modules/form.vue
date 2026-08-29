<script lang="ts" setup>
import type { SelectOption } from '../../utils';

import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtFamily, WmxtFamilyWrite } from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

interface DrawerData {
  row?: WmxtFamily;
  userOptions?: SelectOption[];
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtFamily>();

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    help: '家庭在小程序端展示的名称。',
    label: '家庭名称',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'invite_code',
    help: '家庭成员加入时使用的邀请码；为空时保存时自动生成。',
    label: '邀请码',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      optionFilterProp: 'label',
      options: [],
      showSearch: true,
    },
    fieldName: 'creator_user_id',
    help: '家庭创建者用户；用于家庭归属、成员管理和家庭端积分业务。',
    label: '创建者',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'member_count',
    help: '当前家庭成员数量统计。',
    label: '成员数量',
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
      const values = await formApi.getValues();
      const payload: WmxtFamilyWrite = {
        creator_user_id: Number(values.creator_user_id),
        invite_code: values.invite_code || `F${Date.now()}`,
        member_count: Number(values.member_count ?? 0),
        name: values.name,
      };
      await (current.value?.id
        ? WmxtAdminApi.update_family(current.value.id, payload)
        : WmxtAdminApi.create_family(payload));
      message.success('家庭已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    current.value = data?.row?.id ? data.row : undefined;
    await formApi.reset();
    await formApi.updateSchema([
      {
        componentProps: {
          class: 'w-full',
          optionFilterProp: 'label',
          options: data?.userOptions ?? [],
          showSearch: true,
        },
        fieldName: 'creator_user_id',
      },
    ]);
    await formApi.setValues(
      current.value ?? {
        creator_user_id: undefined,
        invite_code: '',
        member_count: 0,
        name: '',
      },
    );
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑家庭' : '新增家庭',
);
</script>

<template>
  <Drawer class="w-full max-w-140" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
