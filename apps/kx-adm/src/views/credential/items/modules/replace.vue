<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  CredentialFieldSpec,
  CredentialPayload,
  CredentialProfileSpec,
  CredentialView,
} from '#/api/credential';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Input, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { buildCredentialPayload, CredentialApi } from '#/api/credential';
import { useAuthStore } from '#/store';

const emit = defineEmits<{ success: [] }>();
const authStore = useAuthStore();
const credential = ref<CredentialView>();
const profiles = ref<CredentialProfileSpec[]>([]);
const totpCode = ref('');
const spec = computed(() =>
  profiles.value.find(
    (item) =>
      item.kind === credential.value?.kind &&
      item.profile === credential.value?.profile,
  ),
);

function fieldComponent(field: CredentialFieldSpec) {
  if (field.name === 'service_account_json' || field.name === 'json')
    return 'JsonFileInput';
  if (
    field.name === 'header_name' &&
    (spec.value?.allowed_headers.length ?? 0) > 0
  )
    return 'Select';
  if (field.name === 'scheme') return 'Select';
  if (field.field_type === 'password') return 'InputPassword';
  if (field.field_type === 'textarea') return 'Textarea';
  return 'Input';
}

function schema(): VbenFormSchema[] {
  return [
    ...(spec.value?.fields ?? []).map((field) => ({
      component: fieldComponent(field),
      componentProps: {
        autocomplete: field.field_type === 'password' ? 'new-password' : 'off',
        maxlength: field.max_length,
        options:
          field.name === 'scheme'
            ? ['Bearer', 'Basic'].map((value) => ({ label: value, value }))
            : spec.value?.allowed_headers.map((value) => ({
                label: value,
                value,
              })),
        rows: field.field_type === 'textarea' ? 6 : undefined,
      },
      fieldName: `payload_${field.name}`,
      formItemClass:
        field.field_type === 'textarea' ? 'md:col-span-2' : 'col-span-1',
      help: '替换时必须重新提供完整材料，空值不会继承旧值。',
      label: field.label,
      rules: field.required ? 'required' : undefined,
    })),
    {
      component: 'DatePicker',
      componentProps: { class: 'w-full', showTime: true, valueFormat: 'X' },
      fieldName: 'expires_at',
      help: '不填写表示永不过期。',
      label: '过期时间',
    },
  ];
}

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  layout: 'vertical',
  schema: [],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<{
  item: CredentialView;
  profiles: CredentialProfileSpec[];
}>({
  async onConfirm() {
    if (!credential.value || !/^\d{6}$/.test(totpCode.value)) {
      message.warning('请填写材料并输入 6 位 TOTP');
      return;
    }
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    const payload: CredentialPayload = buildCredentialPayload(
      credential.value.kind,
      values,
    );
    drawerApi.lock();
    let succeeded = false;
    try {
      const grant = await authStore.authorizeStepUp(
        'credential.replace',
        totpCode.value,
      );
      await CredentialApi.replace(
        credential.value.code,
        {
          expires_at: values.expires_at,
          payload,
        },
        grant.grant_token,
      );
      message.success('凭证已替换');
      succeeded = true;
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
      totpCode.value = '';
      if (succeeded) await formApi.reset();
    }
  },
  async onOpenChange(open) {
    if (!open) {
      credential.value = undefined;
      totpCode.value = '';
      return;
    }
    const data = drawerApi.getData();
    credential.value = data?.item;
    profiles.value = data?.profiles ?? [];
    formApi.setState({ schema: schema() });
    await formApi.reset();
  },
});
</script>

<template>
  <Drawer
    class="w-full max-w-180"
    :title="`替换凭证 - ${credential?.name ?? ''}`"
  >
    <div class="mx-4 grid gap-4">
      <Input
        :value="totpCode"
        autocomplete="one-time-code"
        inputmode="numeric"
        ::maxlength="6"
        placeholder="输入 6 位 TOTP 获取 credential.replace 授权"
        @update:value="
          totpCode = String($event).replaceAll(/\D/g, '').slice(0, 6)
        "
      />
      <Form />
    </div>
  </Drawer>
</template>
