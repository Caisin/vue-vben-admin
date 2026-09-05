<script setup lang="ts">
import type { Instance } from '#/api/data-sync';

import { reactive, ref, watch } from 'vue';

import { Button, Checkbox, Input, message, Modal, Select } from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { DataSourceApi } from '#/api/system/data-source';
const props = defineProps<{ instance?: Instance; open: boolean }>();
const emit = defineEmits<{ saved: [Instance]; 'update:open': [boolean] }>();
const form = reactive({
  code: '',
  name: '',
  ds_code: '',
  allow_insecure: false,
  enabled: true,
});
const saving = ref(false);
const options = ref<{ label: string; value: string }[]>([]);
async function load() {
  const page = await DataSourceApi.list({ size: 100, state: true });
  options.value = page.items
    .filter((source) =>
      ['mysql', 'postgres', 'postgresql'].includes(source.db_type),
    )
    .map((source) => ({
      value: source.ds_code,
      label: `${source.name} (${source.db_type})`,
    }));
}
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    Object.assign(
      form,
      props.instance ?? {
        code: '',
        name: '',
        ds_code: '',
        allow_insecure: false,
        enabled: true,
      },
    );
    await load();
  },
);
async function save() {
  if (
    !/^[a-z0-9_-]{1,64}$/.test(form.code) ||
    !form.name.trim() ||
    !form.ds_code
  ) {
    message.warning('请填写有效的小写实例编码、名称和数据源');
    return;
  }
  saving.value = true;
  try {
    const instance = props.instance
      ? await DataSyncApi.updateInstance(form.code, {
          name: form.name,
          enabled: form.enabled,
          version: props.instance.version,
        })
      : await DataSyncApi.createInstance({
          code: form.code,
          name: form.name,
          ds_code: form.ds_code,
          allow_insecure: form.allow_insecure,
        });
    emit('saved', instance);
    emit('update:open', false);
    message.success('实例已保存');
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="instance ? '编辑源实例' : '新增源实例'"
    :z-index="2300"
    ok-text="保存实例"
    :confirm-loading="saving"
    @ok="save"
    @cancel="emit('update:open', false)"
  >
    <div class="instance-form">
      <label class="instance-field">实例编码<Input
          v-model:value="form.code"
          :disabled="!!instance"
          :maxlength="64"
          placeholder="shop_east_01"
      /></label>
      <label class="instance-field">显示名称<Input v-model:value="form.name" :maxlength="128" /></label>
      <label class="instance-field">源数据源<Select
          v-model:value="form.ds_code"
          :disabled="!!instance"
          :options="options"
          show-search
          option-filter-prop="label"
      /></label>
      <div class="flex items-center gap-3">
        <Button size="small" @click="load">刷新数据源</Button><a
          href="/system/data-sources"
          target="_blank"
          rel="noopener noreferrer"
          >管理数据源</a>
      </div>
      <Checkbox v-model:checked="form.allow_insecure" :disabled="!!instance">
        允许不加密的源连接
      </Checkbox>
      <Checkbox v-if="instance" v-model:checked="form.enabled">
        启用实例
      </Checkbox>
    </div>
  </Modal>
</template>
<style scoped>
.instance-form {
  display: grid;
  gap: 16px;
}

.instance-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
