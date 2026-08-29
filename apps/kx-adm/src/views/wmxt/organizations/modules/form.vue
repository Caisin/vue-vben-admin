<script lang="ts" setup>
import type { SelectOption } from '../../utils';

import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtOrganizationView, WmxtOrganizationWrite } from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

interface DrawerData {
  row?: WmxtOrganizationView;
  userOptions?: SelectOption[];
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtOrganizationView>();

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    help: '单位在小程序端展示的名称。',
    label: '单位名称',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'org_code',
    help: '单位唯一编码，用于导入、统计和展示。',
    label: '单位代码',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      optionFilterProp: 'label',
      options: [],
      showSearch: true,
    },
    fieldName: 'admin_user_id',
    help: '单位管理员用户；用于单位端管理、积分扣减和资料审核等业务归属。',
    label: '管理员',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'member_count',
    help: '当前单位成员数量统计。',
    label: '成员数量',
  },
  {
    component: 'Input',
    fieldName: 'invite_code',
    help: '单位成员加入时使用的邀请码；为空时保存时自动生成。',
    label: '邀请码',
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
      const payload: WmxtOrganizationWrite = {
        admin_user_id: Number(values.admin_user_id),
        invite_code: values.invite_code || `O${Date.now()}`,
        member_count: Number(values.member_count ?? 0),
        name: values.name,
        org_code: values.org_code,
      };
      await (current.value?.id
        ? WmxtAdminApi.update_organization(current.value.id, payload)
        : WmxtAdminApi.create_organization(payload));
      message.success('单位已保存');
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
        fieldName: 'admin_user_id',
      },
    ]);
    await formApi.setValues(
      current.value ?? {
        admin_user_id: undefined,
        invite_code: '',
        member_count: 0,
        name: '',
        org_code: '',
      },
    );
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑单位' : '新增单位',
);
</script>

<template>
  <Drawer class="w-full max-w-150" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
