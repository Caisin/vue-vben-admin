<script setup lang="ts">
import type { AccountField, FieldValue } from '#/api/account-manager';

import { computed, useId } from 'vue';

import { useAccess } from '@vben/access';

import {
  Checkbox,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  Select,
  Switch,
  TextArea,
} from 'antdv-next';

import { CredentialSelect } from '#/components/credential';

defineProps<{ fields: AccountField[]; configuredSecrets: string[] }>();
const { hasAccessByCodes } = useAccess();
const canCreateCredential = computed(() =>
  hasAccessByCodes(['credential:create']),
);
const values = defineModel<Record<string, FieldValue>>({ required: true });
const id = useId();
function textValue(key: string) {
  const value = values.value[key];
  return typeof value === 'string' ? value : '';
}
function writeText(field: AccountField, raw: number | string | undefined) {
  const value = String(raw ?? '');
  if (field.sensitive && !value)
    Reflect.deleteProperty(values.value, field.key);
  else values.value[field.key] = value || null;
}
function setCleared(key: string, checked: unknown) {
  if (checked === true) values.value[key] = null;
  else Reflect.deleteProperty(values.value, key);
}
</script>
<template>
  <template
    v-for="field in fields.filter((value) => value.enabled)"
    :key="field.key"
  >
    <FormItem
      :label="field.label"
      :required="field.required"
      :html-for="`${id}-${field.key}`"
    >
      <template v-if="field.sensitive">
        <TextArea
          v-if="field.kind === 'textarea'"
          :id="`${id}-${field.key}`"
          :value="textValue(field.key)"
          :disabled="values[field.key] === null"
          :rows="4"
          :placeholder="
            configuredSecrets.includes(field.key)
              ? '已设置，留空保留'
              : '请输入'
          "
          @update:value="writeText(field, $event)"
        />
        <InputPassword
          v-else
          :id="`${id}-${field.key}`"
          :value="textValue(field.key)"
          :disabled="values[field.key] === null"
          autocomplete="new-password"
          :placeholder="
            configuredSecrets.includes(field.key)
              ? '已设置，留空保留'
              : '请输入'
          "
          @update:value="writeText(field, $event)"
        />
        <Checkbox
          v-if="configuredSecrets.includes(field.key)"
          :checked="values[field.key] === null"
          @update:checked="setCleared(field.key, $event)"
        >
          清空已保存的{{ field.label }}
        </Checkbox>
      </template>
      <CredentialSelect
        v-else-if="field.kind === 'credential'"
        :input-id="`${id}-${field.key}`"
        :model-value="textValue(field.key) || null"
        :allow-create="canCreateCredential"
        create-kind="password"
        placeholder="搜索并选择已有凭证"
        @update:model-value="values[field.key] = $event || null"
      />
      <TextArea
        v-else-if="field.kind === 'textarea'"
        :id="`${id}-${field.key}`"
        :value="textValue(field.key)"
        :rows="3"
        @update:value="writeText(field, $event)"
      />
      <InputNumber
        v-else-if="field.kind === 'number'"
        :id="`${id}-${field.key}`"
        class="w-full"
        :value="
          typeof values[field.key] === 'number'
            ? (values[field.key] as number)
            : undefined
        "
        @update:value="
          values[field.key] =
            typeof $event === 'string' || typeof $event === 'number'
              ? $event
              : null
        "
      />
      <Switch
        v-else-if="field.kind === 'boolean'"
        :id="`${id}-${field.key}`"
        :checked="values[field.key] === true"
        @update:checked="values[field.key] = $event === true"
      />
      <Select
        v-else-if="field.kind === 'select'"
        :id="`${id}-${field.key}`"
        :value="textValue(field.key) || undefined"
        :options="field.options.map((value) => ({ label: value, value }))"
        allow-clear
        @update:value="
          values[field.key] =
            typeof $event === 'string' || typeof $event === 'number'
              ? $event
              : null
        "
      />
      <Input
        v-else
        :id="`${id}-${field.key}`"
        :value="textValue(field.key)"
        :type="
          field.kind === 'date'
            ? 'date'
            : field.kind === 'email'
              ? 'email'
              : field.kind === 'url'
                ? 'url'
                : 'text'
        "
        @update:value="writeText(field, $event)"
      />
    </FormItem>
  </template>
</template>
