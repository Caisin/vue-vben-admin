<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  CredentialFieldSpec,
  CredentialKind,
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

import { profileOptions } from '../data';

const emit = defineEmits<{ success: [] }>();
const authStore = useAuthStore();
const credential = ref<CredentialView>();
const profiles = ref<CredentialProfileSpec[]>([]);
const profilePair = ref('');
const totpCode = ref('');
const spec = computed(() =>
  profiles.value.find(
    (item) => `${item.kind}:${item.profile}` === profilePair.value,
  ),
);

function payloadFieldNames() {
  return [
    ...new Set(
      profiles.value.flatMap((profile) =>
        profile.fields.map((field) => field.name),
      ),
    ),
  ];
}

function resetPayloadValues() {
  return formApi.setValues(
    Object.fromEntries(
      payloadFieldNames().map((field) => [`payload_${field}`, '']),
    ),
  );
}

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
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: profileOptions(profiles.value),
      },
      fieldName: 'profile_pair',
      formItemClass: 'md:col-span-2',
      help: '修改类型时必须重新填写目标类型的完整材料。',
      label: '凭证类型',
      rules: 'selectRequired',
    },
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
  handleValuesChange(values, changedFields) {
    if (!changedFields.includes('profile_pair')) return;
    void (async () => {
      profilePair.value = String(values.profile_pair ?? '');
      await resetPayloadValues();
      formApi.setState({ schema: schema() });
      await formApi.setValues({ profile_pair: profilePair.value });
    })();
  },
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
    const [kind, profile = ''] = String(values.profile_pair).split(':') as [
      CredentialKind,
      string,
    ];
    const payload: CredentialPayload = buildCredentialPayload(
      kind,
      values,
      profile,
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
          kind,
          payload,
          profile,
        },
        grant.grant_token,
      );
      message.success('凭证类型与材料已更新');
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
      profilePair.value = '';
      totpCode.value = '';
      return;
    }
    const data = drawerApi.getData();
    credential.value = data?.item;
    profiles.value = data?.profiles ?? [];
    profilePair.value = credential.value
      ? `${credential.value.kind}:${credential.value.profile}`
      : '';
    formApi.setState({ schema: schema() });
    await formApi.reset();
    await formApi.setValues({ profile_pair: profilePair.value });
  },
});
</script>

<template>
  <Drawer
    class="w-full max-w-180"
    :title="`更换类型与材料 - ${credential?.name ?? ''}`"
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
