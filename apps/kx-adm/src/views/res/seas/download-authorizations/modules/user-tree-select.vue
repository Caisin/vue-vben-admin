<script setup lang="ts">
import type { DownloadUserTreeNode } from '#/api/res/downloads';

import { computed } from 'vue';

import { Alert, Button, TreeSelect } from 'antdv-next';

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
const selected = computed({
  get: () => value.value.map(String),
  set: (values: string[] | undefined) => {
    // 组织节点仅展开，提交值只包含用户 ID。
    value.value = [
      ...new Set((values ?? []).filter((v) => /^\d+$/.test(v)).map(Number)),
    ];
  },
});
function contains(nodes: DownloadUserTreeNode[], key: string): boolean {
  return nodes.some(
    (node) => node.value === key || contains(node.children ?? [], key),
  );
}
const tree = computed(() => {
  const source = props.allowDisabled
    ? filterOptions(props.treeData)
    : props.treeData;
  return [
    ...source,
    ...selected.value
      .filter((key) => !contains(props.treeData, key))
      .map((key) => ({
        value: key,
        title: `用户 #${key}（不在当前组织树）`,
        selectable: false,
        disabled: true,
        children: [],
      })),
  ];
});
function filterOptions(nodes: DownloadUserTreeNode[]): DownloadUserTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    disabled: false,
    children: filterOptions(node.children ?? []),
  }));
}
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
        <Button size="small" @click="emit('retry')"> 重新加载组织树 </Button>
      </template>
    </Alert>
  </div>
</template>
