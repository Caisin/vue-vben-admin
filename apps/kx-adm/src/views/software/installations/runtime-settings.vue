<script setup lang="ts">
import { computed } from 'vue';

import { FormItem, Input, InputNumber, Select } from 'antdv-next';
const props = defineProps<{ provider: string }>();
const values = defineModel<Record<string, string>>({ required: true });
const fields = computed(() => {
  const bind =
    (
      { mysql: 'bind-address', postgres: 'listen_addresses' } as Record<
        string,
        string
      >
    )[props.provider] ?? 'bind';
  const list = [
    { key: bind, label: '监听地址', kind: 'text' },
    { key: 'port', label: '服务端口', kind: 'number' },
  ];
  if (props.provider === 'redis')
    list.push(
      { key: 'maxmemory', label: '最大内存', kind: 'text' },
      { key: 'maxmemory-policy', label: '内存淘汰策略', kind: 'policy' },
      { key: 'appendonly', label: 'AOF 持久化', kind: 'boolean' },
    );
  else
    list.push(
      { key: 'max_connections', label: '最大连接数', kind: 'number' },
      {
        key:
          props.provider === 'mysql'
            ? 'innodb_buffer_pool_size'
            : 'shared_buffers',
        label: '缓存内存',
        kind: 'text',
      },
    );
  return list;
});
function update(key: string, value: unknown) {
  const next = { ...values.value };
  if (value === undefined || value === null || value === '')
    Reflect.deleteProperty(next, key);
  else next[key] = String(value);
  values.value = next;
}
</script>
<template>
  <div class="grid grid-cols-2 gap-x-3 max-sm:grid-cols-1">
    <FormItem v-for="field in fields" :key="field.key" :label="field.label">
      <InputNumber
        v-if="field.kind === 'number'"
        :value="values[field.key] ? Number(values[field.key]) : null"
        class="w-full"
        :min="1"
        :max="field.key === 'port' ? 65535 : 100000"
        placeholder="保留原配置"
        @update:value="update(field.key, $event)"
      />
      <Select
        v-else-if="field.kind === 'boolean'"
        :value="values[field.key]"
        allow-clear
        placeholder="保留原配置"
        :options="[
          { label: '启用', value: 'yes' },
          { label: '关闭', value: 'no' },
        ]"
        @update:value="update(field.key, $event)"
      />
      <Select
        v-else-if="field.kind === 'policy'"
        :value="values[field.key]"
        allow-clear
        placeholder="保留原配置"
        :options="
          [
            'noeviction',
            'allkeys-lru',
            'volatile-lru',
            'allkeys-lfu',
            'volatile-lfu',
            'allkeys-random',
            'volatile-random',
            'volatile-ttl',
          ].map((value) => ({ label: value, value }))
        "
        @update:value="update(field.key, $event)"
      />
      <Input
        v-else
        :value="values[field.key]"
        placeholder="保留原配置"
        @update:value="update(field.key, $event)"
      />
    </FormItem>
  </div>
</template>
