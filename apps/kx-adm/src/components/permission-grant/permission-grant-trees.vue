<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';

import { computed, ref } from 'vue';

import { Tree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, InputSearch, Space, Spin, Tag } from 'antdv-next';

import {
  buildPermissionGrantTree,
  filterGrantTreeByIds,
  filterPermissionGrantTree,
  mergeVisibleGrantSelection,
  selectableGrantIds,
} from './tree';

const props = withDefaults(
  defineProps<{
    apis: ApiPermission[];
    loading?: boolean;
    menus: SystemMenu[];
    readonly?: boolean;
    refreshable?: boolean;
  }>(),
  { loading: false, readonly: false },
);
const emit = defineEmits<{ refresh: [] }>();
const permissionIds = defineModel<string[]>('permissionIds', {
  default: () => [],
});
const search = ref('');
const showApis = ref(false);
const nodes = computed(() =>
  buildPermissionGrantTree(props.menus, props.apis, true),
);
const catalogueIds = computed(() => selectableGrantIds(nodes.value));
const assignedCount = computed(
  () =>
    permissionIds.value.filter((id) => catalogueIds.value.has(String(id)))
      .length,
);
const visibleNodes = computed(() => {
  const tree = props.readonly
    ? filterGrantTreeByIds(nodes.value, permissionIds.value)
    : nodes.value;
  return filterPermissionGrantTree(tree, search.value);
});
const selected = computed({
  get: () =>
    permissionIds.value.filter((id) =>
      visibleSelectableIds.value.has(String(id)),
    ),
  set: (next: Array<number | string>) => {
    if (!props.readonly)
      permissionIds.value = mergeVisibleGrantSelection(
        permissionIds.value,
        next,
        visibleNodes.value,
      );
  },
});
const visibleSelectableIds = computed(() =>
  selectableGrantIds(visibleNodes.value),
);
const apiById = computed(
  () => new Map(props.apis.map((api) => [String(api.id), api])),
);
const effectiveApis = computed(() => {
  const granted = new Set(permissionIds.value);
  const ids = new Set<string>();
  function visit(items: ReturnType<typeof buildPermissionGrantTree>) {
    for (const item of items) {
      if (granted.has(item.id) && !item.disabled)
        for (const id of item.apiIds ?? []) ids.add(id);
      visit(item.children ?? []);
    }
  }
  visit(nodes.value);
  return [...ids].flatMap((id) => {
    const api = apiById.value.get(id);
    return api?.enabled ? [api] : [];
  });
});
function selectVisible() {
  selected.value = [...visibleSelectableIds.value];
}
function clearVisible() {
  selected.value = [];
}
</script>

<template>
  <Spin :spinning="loading" :classes="{ root: 'w-full' }">
    <div class="mb-3 text-sm text-muted-foreground">
      按菜单功能分配权限，关联 API 自动生效。选择菜单不会自动选择功能按钮。
    </div>
    <InputSearch
      v-model:value="search"
      allow-clear
      placeholder="搜索菜单、功能、权限码或报错中的 API 编码"
    />
    <Space class="my-2" wrap>
      <Button
        v-if="refreshable"
        size="small"
        :loading="loading"
        @click="emit('refresh')"
      >
        刷新权限目录
      </Button>
      <Tag>
        {{ assignedCount }} 项节点 / {{ effectiveApis.length }} 个关联 API
      </Tag>
      <template v-if="!readonly">
        <Button size="small" @click="selectVisible">
          全选当前结果（含按钮）
        </Button>
        <Button size="small" @click="clearVisible">清空当前结果</Button>
      </template>
    </Space>
    <div class="grant-tree-scroll">
      <Tree
        v-model="selected"
        class="min-w-max max-w-none"
        :auto-check-parent="false"
        bordered
        check-strictly
        :default-expanded-level="2"
        :disabled="readonly"
        icon-field="icon"
        label-field="label"
        multiple
        :tree-data="visibleNodes"
        value-field="id"
      >
        <template #node="{ value }">
          <IconifyIcon v-if="value.icon" :icon="value.icon" />
          <span class="whitespace-nowrap">{{ value.label }}</span>
          <Tag v-if="value.permissionType === 'button'" size="small">功能</Tag>
          <span
            v-if="value.apiIds?.length"
            class="text-xs text-muted-foreground"
          >
            {{ value.apiIds.length }} API
          </span>
        </template>
      </Tree>
    </div>
    <details
      v-if="effectiveApis.length"
      class="mt-3 text-sm"
      @toggle="showApis = ($event.target as HTMLDetailsElement).open"
    >
      <summary class="cursor-pointer">
        查看自动关联的 API（{{ effectiveApis.length }}）
      </summary>
      <div v-if="showApis" class="grant-tree-scroll">
        <div v-for="api in effectiveApis" :key="api.id" class="py-1">
          {{ api.api_name }}
          <code>{{ api.api_method }} {{ api.api_path }}</code>
        </div>
      </div>
    </details>
  </Spin>
</template>
<style scoped>
.grant-tree-scroll {
  min-height: 80px;
  max-height: calc(100dvh - 230px);
  overflow: auto;
}

code {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}
</style>
