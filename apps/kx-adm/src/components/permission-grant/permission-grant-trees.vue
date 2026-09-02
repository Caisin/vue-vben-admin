<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';

import { computed, ref } from 'vue';

import { Tree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, InputSearch, Space, Spin, TabPane, Tabs } from 'antdv-next';

import {
  buildApiGrantTree,
  buildPermissionGrantTree,
  filterGrantTreeByIds,
  filterPermissionGrantTree,
  mergeSearchedGrantSelection,
  mergeVisibleGrantSelection,
  selectableGrantIds,
} from './tree';

const props = withDefaults(
  defineProps<{
    apis: ApiPermission[];
    loading?: boolean;
    menus: SystemMenu[];
    readonly?: boolean;
  }>(),
  { loading: false, readonly: false },
);

const permissionIds = defineModel<string[]>('permissionIds', {
  default: () => [],
});
const apiIds = defineModel<string[]>('apiIds', { default: () => [] });

const menuSearch = ref('');
const apiSearch = ref('');
const menuNodes = computed(() => buildPermissionGrantTree(props.menus));
const apiNodes = computed(() =>
  buildApiGrantTree(props.apis, { includeBound: true }),
);
const visibleMenuNodes = computed(() => {
  const nodes = props.readonly
    ? filterGrantTreeByIds(menuNodes.value, permissionIds.value)
    : menuNodes.value;
  return filterPermissionGrantTree(nodes, menuSearch.value);
});
const visibleApiNodes = computed(() => {
  const nodes = props.readonly
    ? filterGrantTreeByIds(apiNodes.value, apiIds.value)
    : apiNodes.value;
  return filterPermissionGrantTree(nodes, apiSearch.value);
});

function visibleSelectionModel(
  selected: { value: string[] },
  visibleNodes: { value: ReturnType<typeof buildPermissionGrantTree> },
  search: { value: string },
) {
  return computed({
    get: () => {
      const visibleIds = selectableGrantIds(visibleNodes.value);
      return selected.value.filter((id) => visibleIds.has(String(id)));
    },
    set: (next: Array<number | string>) => {
      if (props.readonly) return;
      if (search.value.trim()) {
        selected.value = mergeSearchedGrantSelection(selected.value, next);
        return;
      }
      selected.value = mergeVisibleGrantSelection(
        selected.value,
        next,
        visibleNodes.value,
      );
    },
  });
}

const visiblePermissionIds = visibleSelectionModel(
  permissionIds,
  visibleMenuNodes,
  menuSearch,
);
const visibleApiIds = visibleSelectionModel(apiIds, visibleApiNodes, apiSearch);

function selectAllApis() {
  apiIds.value = [...selectableGrantIds(apiNodes.value)];
}

function clearAllApis() {
  apiIds.value = [];
}
</script>

<template>
  <Spin :spinning="loading" :classes="{ root: 'w-full' }">
    <Tabs size="small">
      <TabPane key="permissions" :tab="`菜单权限 ${permissionIds.length}`">
        <InputSearch
          v-model:value="menuSearch"
          allow-clear
          placeholder="搜索菜单、按钮、权限码或路径"
        />
        <div class="grant-tree-scroll">
          <Tree
            v-model="visiblePermissionIds"
            bordered
            check-strictly
            :default-expanded-level="2"
            icon-field="icon"
            label-field="label"
            multiple
            :tree-data="visibleMenuNodes"
            value-field="id"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.icon" :icon="value.icon" />
              <span>{{ value.label }}</span>
            </template>
          </Tree>
        </div>
      </TabPane>
      <TabPane key="apis" :tab="`API 权限 ${apiIds.length}`">
        <div class="grant-toolbar">
          <InputSearch
            v-model:value="apiSearch"
            allow-clear
            placeholder="搜索 API 名称、方法、路径或编码"
          />
          <Space v-if="!readonly">
            <Button size="small" @click="selectAllApis">选择全部 API</Button>
            <Button size="small" @click="clearAllApis">取消全部 API</Button>
          </Space>
        </div>
        <div class="grant-tree-scroll">
          <Tree
            v-model="visibleApiIds"
            bordered
            check-strictly
            :default-expanded-level="1"
            label-field="label"
            multiple
            :show-icon="false"
            :tree-data="visibleApiNodes"
            value-field="id"
          >
            <template #node="{ value }">
              <span v-if="value.method" class="api-method">
                {{ value.method }}
              </span>
              <span>{{ value.label }}</span>
            </template>
          </Tree>
        </div>
      </TabPane>
    </Tabs>
  </Spin>
</template>

<style scoped>
.grant-tree-scroll {
  min-height: 220px;
  max-height: 360px;
  margin-top: 8px;
  overflow: auto;
}

.grant-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.api-method {
  display: inline-block;
  width: 48px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}
</style>
