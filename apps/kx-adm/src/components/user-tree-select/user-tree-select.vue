<script setup lang="ts">
import type { DownloadUserTreeNode } from '#/api/res/downloads';

import { computed } from 'vue';

import { Alert, Button, TreeSelect } from 'antdv-next';

import { firstUserValues, userId, userTreeOptions } from './options';

const props = defineProps<{
  treeData: DownloadUserTreeNode[];
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  allowDisabled?: boolean;
  id?: string;
}>();
const emit = defineEmits<{ retry: [] }>();
const value = defineModel<number[]>('value', { required: true });
const source = computed(() =>
  userTreeOptions(props.treeData, props.allowDisabled),
);
const firstValues = computed(() => firstUserValues(source.value));
const selected = computed({
  get: () =>
    value.value.map(
      (uid) => firstValues.value.get(uid) ?? `user:${uid}:missing`,
    ),
  set: (values: string[] | undefined) => {
    value.value = [
      ...new Set(
        (values ?? [])
          .map((item) => userId(item))
          .filter((uid): uid is number => uid !== undefined),
      ),
    ];
  },
});
const tree = computed(() => [
  ...source.value,
  ...value.value
    .filter((uid) => !firstValues.value.has(uid))
    .map((uid) => ({
      value: `user:${uid}:missing`,
      title: `用户 #${uid}（不在当前组织树）`,
      selectable: false,
      disabled: true,
      children: [],
    })),
]);
</script>
<template>
  <div class="min-w-72">
    <TreeSelect
      :id="id"
      v-model:value="selected"
      :tree-data="tree"
      :loading="loading"
      :disabled="disabled || loading || !!error"
      tree-node-filter-prop="title"
      multiple
      show-search
      allow-clear
      placeholder="展开组织、部门选择多个用户，或搜索姓名"
      class="w-full"
    />
    <Alert v-if="error" :message="error" type="error" class="mt-2">
      <template #action>
        <Button size="small" @click="emit('retry')">重新加载组织树</Button>
      </template>
    </Alert>
  </div>
</template>
