<script lang="ts" setup>
import type {
  PhoneAccount,
  PhoneAccountFilterOptions,
  UpdatePhoneAccountInput,
} from '#/api/msg';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { PhoneAccountApi } from '#/api/msg';

import { createFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();

interface DrawerData {
  filterOptions?: PhoneAccountFilterOptions;
  row?: PhoneAccount;
}

interface PhoneAccountFormValues extends UpdatePhoneAccountInput {
  password_set?: boolean;
}

const editing = ref<PhoneAccount>();

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema: createFormSchema({
    platforms: [],
    purposes: [],
    statuses: [],
    types: [],
  }),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<DrawerData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const raw = (await formApi.getValues()) as PhoneAccountFormValues;
      const payload = normalizeSubmitValues(raw);
      if (editing.value) {
        await PhoneAccountApi.update(editing.value.account_key, payload);
        message.success('号码账号已更新');
      } else {
        await PhoneAccountApi.create(payload);
        message.success('号码账号已创建');
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
    await formApi.updateSchema(
      createFormSchema(
        data?.filterOptions ?? {
          platforms: [],
          purposes: [],
          statuses: [],
          types: [],
        },
      ),
    );
    await formApi.reset();
    await formApi.setValues(
      editing.value
        ? {
            account_name: editing.value.account_name,
            account_type: editing.value.account_type,
            clear_password: false,
            login_url: editing.value.login_url,
            note: editing.value.note,
            password: '',
            password_set: editing.value.password_set,
            phone_number: editing.value.phone_number,
            platform: editing.value.platform,
            purpose: editing.value.purpose,
            status: editing.value.status,
          }
        : {
            clear_password: false,
            password: '',
            status: 'active',
          },
    );
  },
});

function normalizeSubmitValues(
  values: PhoneAccountFormValues,
): UpdatePhoneAccountInput {
  return {
    account_name: String(values.account_name ?? '').trim(),
    account_type: String(values.account_type ?? '').trim(),
    clear_password: Boolean(values.clear_password),
    login_url: String(values.login_url ?? '').trim(),
    note: String(values.note ?? '').trim(),
    password: values.password ? String(values.password) : undefined,
    phone_number: String(values.phone_number ?? '').trim(),
    platform: String(values.platform ?? '').trim(),
    purpose: String(values.purpose ?? '').trim(),
    status: values.status,
  };
}

const drawerTitle = computed(() =>
  editing.value ? '编辑号码账号' : '新增号码账号',
);
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Alert
      v-if="editing?.password_set"
      class="mx-4 mb-4"
      message="密码输入框留空会保留原值；勾选清空后将删除已保存密码。"
      show-icon
      type="warning"
    />
    <Form class="mx-4" />
  </Drawer>
</template>
