<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { GrantValues } from '#/api/res/grant-maintenance';

import {
  CheckboxGroup,
  DatePicker,
  FormItem,
  InputNumber,
  Switch,
} from 'antdv-next';
import dayjs from 'dayjs';

import { grantModules } from '#/api/res/grant-maintenance';
const props = defineProps<{
  delivery: boolean;
  materialOnly?: boolean;
  fields?: (keyof GrantValues)[];
  disabled?: boolean;
}>();
const value = defineModel<GrantValues>('value', { required: true });
const visible = (field: keyof GrantValues) =>
  !props.fields || props.fields.includes(field);
function setTime(
  field: 'valid_from' | 'valid_until',
  date: Dayjs | Dayjs[] | null | undefined,
) {
  const single = Array.isArray(date) ? date[0] : date;
  value.value[field] = single?.isValid() ? single.unix() : 0;
}
</script>
<template>
  <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
    <FormItem v-if="visible('valid_from')" label="生效时间">
      <DatePicker
        :value="value.valid_from ? dayjs.unix(value.valid_from) : null"
        show-time
        allow-clear
        :disabled="disabled"
        placeholder="留空立即生效"
        @change="(date) => setTime('valid_from', date)"
      />
    </FormItem>
    <FormItem v-if="visible('valid_until')" label="失效时间">
      <DatePicker
        :value="value.valid_until ? dayjs.unix(value.valid_until) : null"
        show-time
        allow-clear
        :disabled="disabled"
        placeholder="留空永久有效"
        @change="(date) => setTime('valid_until', date)"
      />
    </FormItem>
    <FormItem v-if="visible('seq_from')" label="起始集数（0 不限）">
      <InputNumber
        v-model:value="value.seq_from"
        :min="0"
        :precision="0"
        :disabled="disabled"
      />
    </FormItem>
    <FormItem v-if="visible('seq_until')" label="结束集数（0 不限）">
      <InputNumber
        v-model:value="value.seq_until"
        :min="0"
        :precision="0"
        :disabled="disabled"
      />
    </FormItem>
    <FormItem v-if="visible('can_download')" label="允许下载">
      <Switch
        v-model:checked="value.can_download"
        :disabled="disabled"
        checked-children="启用"
        un-checked-children="停用"
      />
    </FormItem>
    <FormItem
      v-if="delivery && visible('modules')"
      label="允许下载的材料模块"
      class="sm:col-span-2"
    >
      <CheckboxGroup
        v-model:value="value.modules"
        :options="
          materialOnly === undefined
            ? grantModules
            : grantModules.filter((m) =>
                materialOnly ? m.value !== 'film' : m.value === 'film',
              )
        "
        :disabled="disabled"
      />
    </FormItem>
  </div>
</template>
