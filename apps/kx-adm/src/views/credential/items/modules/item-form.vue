<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  CredentialFieldSpec,
  CredentialKind,
  CredentialProfileSpec,
  CredentialView,
} from '#/api/credential';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { buildCredentialPayload, CredentialApi } from '#/api/credential';

import { kindLabel, profileOptions } from '../data';

const emit = defineEmits<{ success: [] }>();
const profiles = ref<CredentialProfileSpec[]>([]);
const editing = ref<CredentialView>();

function selectedSpec(profilePair: unknown) {
  const [kind, profile] = String(profilePair ?? '').split(':');
  return profiles.value.find(
    (item) => item.kind === kind && item.profile === profile,
  );
}

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

function fieldComponent(
  field: CredentialFieldSpec,
  profile: CredentialProfileSpec,
) {
  if (field.name === 'header_name' && profile.allowed_headers.length > 0)
    return 'Select';
  if (field.name === 'scheme') return 'Select';
  if (field.field_type === 'password') return 'InputPassword';
  if (field.field_type === 'textarea') return 'Textarea';
  return 'Input';
}

function fieldSchema(
  field: CredentialFieldSpec,
  profile: CredentialProfileSpec,
): VbenFormSchema {
  const component = fieldComponent(field, profile);
  const selectOptions =
    field.name === 'scheme'
      ? ['Bearer', 'Basic'].map((value) => ({ label: value, value }))
      : profile.allowed_headers.map((value) => ({ label: value, value }));
  return {
    component,
    componentProps: {
      autocomplete: component === 'InputPassword' ? 'new-password' : 'off',
      class: 'w-full',
      maxlength: field.max_length,
      options: component === 'Select' ? selectOptions : undefined,
      rows: component === 'Textarea' ? 6 : undefined,
    },
    fieldName: `payload_${field.name}`,
    formItemClass: component === 'Textarea' ? 'md:col-span-2' : 'col-span-1',
    help: '创建必须填写当前类型完整材料，空值不会继承其它 profile。',
    label: field.label,
    rules: field.required ? 'required' : undefined,
  };
}

function formSchema(profilePair?: unknown): VbenFormSchema[] {
  const profile = selectedSpec(profilePair);
  const editingMetadata = Boolean(editing.value);
  return [
    {
      component: 'Input',
      componentProps: { class: 'w-full', disabled: editingMetadata },
      fieldName: 'code',
      label: '凭证编码',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { class: 'w-full' },
      fieldName: 'name',
      label: '凭证名称',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        disabled: editingMetadata,
        options: profileOptions(profiles.value),
      },
      fieldName: 'profile_pair',
      formItemClass: 'md:col-span-2',
      label: '凭证类型 / Profile',
      rules: 'selectRequired',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'expires_at',
      label: '过期 Unix 秒',
    },
    ...(profile?.fields.map((field) => fieldSchema(field, profile)) ?? []),
    {
      component: 'Textarea',
      componentProps: { class: 'w-full', rows: 3 },
      fieldName: 'remark',
      formItemClass: 'md:col-span-2',
      label: '备注',
    },
  ];
}

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  layout: 'vertical',
  handleValuesChange(values, changedFields) {
    if (editing.value || !changedFields.includes('profile_pair')) return;
    void (async () => {
      await resetPayloadValues();
      formApi.setState({ schema: formSchema(values.profile_pair) });
      await formApi.setValues({ profile_pair: values.profile_pair });
    })();
  },
  schema: formSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Modal, modalApi] = useVbenModal<{
  defaultProfilePair?: string;
  item?: CredentialView;
  profiles: CredentialProfileSpec[];
}>({
  class: 'w-[min(920px,calc(100vw-24px))]',
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    modalApi.lock();
    try {
      if (editing.value) {
        await CredentialApi.update(editing.value.code, {
          name: String(values.name ?? '').trim(),
          remark: String(values.remark ?? '').trim(),
        });
      } else {
        const [kind, profile = ''] = String(values.profile_pair).split(':') as [
          CredentialKind,
          string,
        ];
        await CredentialApi.create({
          code: String(values.code ?? '').trim(),
          expires_at: values.expires_at as number | string | undefined,
          kind,
          name: String(values.name ?? '').trim(),
          payload: buildCredentialPayload(kind, values),
          profile,
          remark: String(values.remark ?? '').trim(),
        });
      }
      message.success('凭证已保存');
      modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
      await formApi.reset();
    }
  },
  async onOpenChange(open) {
    if (!open) {
      editing.value = undefined;
      await formApi.reset();
      return;
    }
    const data = modalApi.getData();
    profiles.value = data?.profiles ?? [];
    editing.value = data?.item;
    const profilePair = editing.value
      ? `${editing.value.kind}:${editing.value.profile}`
      : data?.defaultProfilePair;
    await formApi.reset();
    formApi.setState({
      schema: formSchema(profilePair),
    });
    await formApi.setValues(
      editing.value
        ? {
            ...editing.value,
            profile_pair: `${editing.value.kind}:${editing.value.profile}`,
          }
        : { profile_pair: profilePair },
    );
  },
});

const title = computed(() => (editing.value ? '编辑凭证元数据' : '新增凭证'));
</script>

<template>
  <Modal :title="title">
    <Form class="mx-4" />
    <p class="mx-4 mt-2 text-xs text-gray-500">
      {{
        editing
          ? '编辑不会加载或修改密钥材料。'
          : `请选择类型后填写完整材料；Profile 由后端 registry 固定，例如 ${kindLabel('access_key')}。`
      }}
    </p>
  </Modal>
</template>
