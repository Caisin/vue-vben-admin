<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { AdminPermission, PermissionType } from '#/api/auth/admin';
import type {
  ApiAccessMode,
  ApiOperationType,
  ApiPermission,
} from '#/api/system/api-permission';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page, Tree } from '@vben/common-ui';
import { RotateCw } from '@vben/icons';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Form,
  FormItem,
  Input,
  message,
  Select,
  Space,
  Tag,
  TreeSelect,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ApiPermissionApi } from '#/api/system/api-permission';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { prependTreeOption } from '#/tree-select';
import { vxeSortParams } from '#/vxe-sort';

import {
  accessModeOptions,
  clientScopeOptions,
  operationOptions,
  useColumns,
  useFormSchema,
} from './data';
import PopupModal from './modules/popup-modal.vue';

interface CheckboxGrid {
  getCheckboxRecords?: () => ApiPermission[];
}

interface TreeSelectOption {
  children?: TreeSelectOption[];
  key: boolean | number | string;
  title: string;
  value: boolean | number | string;
}

interface MenuTreeNode {
  api_count: number;
  api_ids: Array<number | string>;
  children?: MenuTreeNode[];
  id: number | string;
  perm_type: 'all' | 'unassigned' | PermissionType;
  title: string;
}

interface MenuTreeSelectItem {
  id?: number | string;
  value?: MenuTreeNode;
}

interface PermissionNode {
  api_count: number;
  api_ids: Array<number | string>;
  auth_code: string;
  enabled: boolean;
  id: number | string;
  name: string;
  order_no: number;
  perm_type: PermissionType;
  pid: number | string;
  title: string;
}

const apiPermissionSortFields = [
  'id',
  'api_code',
  'api_key',
  'api_path',
  'api_method',
  'enabled',
  'auth_exempt',
  'security_exempt',
  'menu_perm_id',
  'created_at',
];

const syncing = ref(false);
const saving = ref(false);
const assigning = ref(false);
const batching = ref(false);
const editOpen = ref(false);
const assignOpen = ref(false);
const editing = ref<ApiPermission>();
const assigningApi = ref<ApiPermission>();
const permissions = ref<PermissionNode[]>([]);
const apiCountTotal = ref(0);
const menuTree = ref<MenuTreeNode[]>([]);
const menuOptions = ref<TreeSelectOption[]>([]);
const permissionOptions = ref<TreeSelectOption[]>([]);
const selectedMenuId = ref<number | string>('all');
const selectedMenuNode = ref<MenuTreeNode>();
const form = reactive({
  access_mode: 'menu' as ApiAccessMode,
  api_name: '',
  audit_debug: false,
  audit_enabled: true,
  enabled: true,
  menu_perm_id: 0 as number | string,
  operation_type: 'action' as ApiOperationType,
  security_enabled: true,
});
const assignForm = reactive({
  permission_ids: [] as Array<number | string>,
});

const selectedMenuTitle = computed(() => {
  if (selectedMenuNode.value) return selectedMenuNode.value.title;
  const value = normalizeMenuId(selectedMenuId.value);
  if (value === 'all') return '全部 API';
  if (value === 0) return '未归属 API';
  return permissionTitle(value) ?? '当前菜单 API';
});

const assignTitle = computed(() => {
  if (!assigningApi.value) return '高级：分配自定义权限';
  return `自定义权限：${assigningApi.value.api_method} ${assigningApi.value.api_path}`;
});

const [Grid, gridApi] = useVbenVxeGrid<ApiPermission>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onEnabledChange, onActionClick),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100, 200] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const ids = selectedApiIds();
          if (Array.isArray(ids) && ids.length === 0) {
            return { items: [], total: 0 };
          }
          const result = await ApiPermissionApi.list({
            access_mode: formValues.access_mode as ApiAccessMode | undefined,
            api_method: String(formValues.api_method ?? '') || undefined,
            api_path_prefix:
              String(formValues.api_path_prefix ?? '').trim() || undefined,
            enabled: formValues.enabled as boolean | undefined,
            ids,
            operation_type: formValues.operation_type as
              | ApiOperationType
              | undefined,
            page: page.currentPage,
            ...vxeSortParams(params, apiPermissionSortFields),
            security_exempt: formValues.security_exempt as boolean | undefined,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ApiPermission>,
});

function selectedApiIds() {
  const node = selectedMenuNode.value;
  if (!node || node.id === 'all') return undefined;
  if (node.api_ids.length === 0) return [];
  return node.api_ids.map(Number);
}

function normalizeMenuId(value: unknown): 'all' | number {
  let raw: unknown = value;
  if (value && typeof value === 'object') {
    const item = value as MenuTreeSelectItem;
    raw = item.value?.id ?? item.id;
  }
  if (raw === 'all') return 'all';
  if (raw === undefined || raw === null || raw === '') return 'all';

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 'all';
}

function normalizePermissionId(value: number | string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function statusColor(value: boolean) {
  return value ? 'success' : 'default';
}

async function onEnabledChange(enabled: boolean, row: ApiPermission) {
  await ApiPermissionApi.update(row.id, {
    access_mode: row.access_mode,
    api_name: row.api_name,
    audit_debug: row.audit_debug ?? false,
    audit_enabled: row.audit_enabled ?? true,
    auth_exempt: row.auth_exempt,
    enabled,
    menu_perm_id: row.menu_perm_id,
    operation_type: row.operation_type,
    security_exempt: row.security_exempt,
  });
  return true;
}

function methodColor(method: string) {
  const map: Record<string, string> = {
    DELETE: 'error',
    GET: 'processing',
    PATCH: 'warning',
    POST: 'success',
    PUT: 'warning',
  };
  return map[method] ?? 'default';
}

function accessModeLabel(value: ApiAccessMode) {
  return accessModeOptions.find((item) => item.value === value)?.label ?? value;
}

function accessModeColor(value: ApiAccessMode) {
  const map: Record<ApiAccessMode, string> = {
    custom: 'warning',
    login: 'default',
    menu: 'processing',
    public: 'success',
  };
  return map[value];
}

function clientScopeLabel(value: string) {
  return (
    clientScopeOptions.find((item) => item.value === value)?.label ?? value
  );
}

function clientScopeColor(value: string) {
  const map: Record<string, string> = {
    backend: 'processing',
    mobile: 'success',
    public: 'default',
  };
  return map[value] ?? 'default';
}

function operationLabel(value: ApiOperationType) {
  return operationOptions.find((item) => item.value === value)?.label ?? value;
}

function permissionTypeLabel(
  value: MenuTreeNode['perm_type'] | PermissionType,
) {
  const map: Record<MenuTreeNode['perm_type'], string> = {
    all: '全部',
    button: '按钮',
    catalog: '目录',
    embedded: '内嵌',
    link: '外链',
    menu: '菜单',
    unassigned: '未归属',
  };
  return map[value] ?? value;
}

function permissionTitle(id: number | string) {
  const key = String(id);
  for (const permission of permissions.value) {
    if (String(permission.id) === key) return permission.title;
  }
  return undefined;
}

function onActionClick({ code, row }: OnActionClickParams<ApiPermission>) {
  if (code === 'edit') openEdit(row);
  if (code === 'assign') openAssign(row);
}

function search() {
  gridApi.reload();
}

function findMenuNode(
  nodes: MenuTreeNode[],
  id: number | string,
): MenuTreeNode | undefined {
  const key = String(id);
  for (const node of nodes) {
    if (String(node.id) === key) return node;
    const child = node.children ? findMenuNode(node.children, id) : undefined;
    if (child) return child;
  }
  return undefined;
}

function selectMenu(value: MenuTreeSelectItem | number | string) {
  const id = normalizeMenuId(value);
  selectedMenuId.value = id;
  selectedMenuNode.value =
    typeof value === 'object' && value?.value
      ? value.value
      : findMenuNode(menuTree.value, id);
  search();
}

function checkedRows() {
  const grid = gridApi.grid as unknown as CheckboxGrid | undefined;
  return typeof grid?.getCheckboxRecords === 'function'
    ? grid.getCheckboxRecords()
    : [];
}

async function syncApis() {
  syncing.value = true;
  try {
    const count = await ApiPermissionApi.sync();
    message.success(`API 同步完成，共 ${count} 条`);
    await loadPermissions();
    await gridApi.query();
  } finally {
    syncing.value = false;
  }
}

async function batchAccessMode(access_mode: ApiAccessMode) {
  const rows = checkedRows();
  if (rows.length === 0) {
    message.warning('请先勾选 API');
    return;
  }
  const selectedMenu = normalizeMenuId(selectedMenuId.value);
  const menu_perm_id =
    access_mode === 'menu' && selectedMenu !== 'all' && selectedMenu > 0
      ? selectedMenu
      : undefined;
  if (access_mode === 'menu' && !menu_perm_id) {
    message.warning('跟随菜单时，请先在左侧选择具体菜单');
    return;
  }
  batching.value = true;
  try {
    const count = await ApiPermissionApi.batchUpdate({
      access_mode,
      ids: rows.map((row) => normalizePermissionId(row.id)),
      menu_perm_id,
    });
    message.success(`已更新 ${count} 条 API`);
    await loadPermissions();
    await gridApi.query();
  } finally {
    batching.value = false;
  }
}

async function openEdit(row: ApiPermission) {
  editing.value = await ApiPermissionApi.detail(row.id);
  Object.assign(form, {
    access_mode: editing.value.access_mode,
    api_name: editing.value.api_name,
    audit_debug: editing.value.audit_debug ?? false,
    audit_enabled: editing.value.audit_enabled ?? true,
    enabled: editing.value.enabled,
    menu_perm_id: editing.value.menu_perm_id,
    operation_type: editing.value.operation_type,
    security_enabled: !editing.value.security_exempt,
  });
  editOpen.value = true;
}

async function submitEdit() {
  if (!editing.value) return;
  const menu_perm_id = normalizePermissionId(form.menu_perm_id);
  if (form.access_mode === 'menu' && menu_perm_id <= 0) {
    message.warning('跟随菜单权限时必须选择所属菜单');
    return;
  }
  saving.value = true;
  try {
    await ApiPermissionApi.update(editing.value.id, {
      access_mode: form.access_mode,
      api_name: form.api_name,
      audit_debug: form.audit_debug,
      audit_enabled: form.audit_enabled,
      enabled: form.enabled,
      menu_perm_id,
      operation_type: form.operation_type,
      security_exempt: !form.security_enabled,
    });
    message.success('API 策略已保存');
    editOpen.value = false;
    await loadPermissions();
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function openAssign(row: ApiPermission) {
  assigningApi.value = await ApiPermissionApi.detail(row.id);
  assignForm.permission_ids = [...assigningApi.value.permission_ids];
  assignOpen.value = true;
}

async function submitAssign() {
  if (!assigningApi.value) return;
  assigning.value = true;
  try {
    await ApiPermissionApi.assign(assigningApi.value.id, {
      permission_ids: assignForm.permission_ids.map((id) =>
        normalizePermissionId(id),
      ),
    });
    message.success('API 自定义权限已保存');
    assignOpen.value = false;
    await loadPermissions();
    await gridApi.query();
  } finally {
    assigning.value = false;
  }
}

function permissionNode(permission: PermissionNode): MenuTreeNode {
  return {
    api_count: permission.api_count,
    api_ids: [...permission.api_ids],
    id: permission.id,
    perm_type: permission.perm_type,
    title: permission.title || permission.name,
  };
}

function comparePermissionNode(a: PermissionNode, b: PermissionNode) {
  const orderDiff = (a.order_no ?? 0) - (b.order_no ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return String(a.id).localeCompare(String(b.id), 'zh-Hans-CN', {
    numeric: true,
  });
}

function aggregateTreeApiCounts(node: MenuTreeNode) {
  const apiIds = new Set(node.api_ids);
  for (const child of node.children ?? []) {
    aggregateTreeApiCounts(child);
    for (const apiId of child.api_ids) apiIds.add(apiId);
  }
  node.api_ids = [...apiIds].toSorted((a, b) => Number(a) - Number(b));
  node.api_count = node.api_ids.length;
}

function buildMenuTree(items: PermissionNode[]) {
  const sorted = [...items].toSorted(comparePermissionNode);
  const nodeById = new Map<string, MenuTreeNode>();
  const roots: MenuTreeNode[] = [];
  for (const item of sorted) {
    nodeById.set(String(item.id), permissionNode(item));
  }
  for (const item of sorted) {
    const node = nodeById.get(String(item.id));
    if (!node) continue;
    const parent = nodeById.get(String(item.pid));
    if (!parent || String(item.pid) === '0') {
      roots.push(node);
    } else {
      parent.children ??= [];
      parent.children.push(node);
    }
  }
  for (const root of roots) aggregateTreeApiCounts(root);
  const unassignedNode: MenuTreeNode = {
    api_count: permissionApiCount(0),
    api_ids: permissionApiIds(0),
    id: 0,
    perm_type: 'unassigned',
    title: '未归属 API',
  };
  const root: MenuTreeNode = {
    api_count: apiCountTotal.value,
    api_ids: [],
    children: [unassignedNode, ...roots],
    id: 'all',
    perm_type: 'all',
    title: '全部 API',
  };
  aggregateTreeApiCounts(root);
  root.api_count = apiCountTotal.value;
  return [root];
}

function treeSelectLabel(permission: PermissionNode) {
  const suffix = permission.auth_code
    ? `${permission.auth_code} / ${permission.id}`
    : String(permission.id);
  return `${permission.title}（${permissionTypeLabel(permission.perm_type)} / ${permission.api_count} API / ${suffix}${permission.enabled ? '' : '，停用'}）`;
}

function buildTreeSelectOptions(items: PermissionNode[]): TreeSelectOption[] {
  const sorted = [...items].toSorted((a, b) => {
    const orderDiff = (a.order_no ?? 0) - (b.order_no ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.id).localeCompare(String(b.id), 'zh-Hans-CN', {
      numeric: true,
    });
  });
  const nodeById = new Map<string, TreeSelectOption>();
  const roots: TreeSelectOption[] = [];
  for (const item of sorted) {
    nodeById.set(String(item.id), {
      key: item.id,
      title: treeSelectLabel(item),
      value: item.id,
    });
  }
  for (const item of sorted) {
    const node = nodeById.get(String(item.id));
    if (!node) continue;
    const parent = nodeById.get(String(item.pid));
    if (!parent || String(item.pid) === '0') {
      roots.push(node);
    } else {
      parent.children ??= [];
      parent.children.push(node);
    }
  }
  return roots;
}

function permissionApiCount(id: number | string) {
  return apiCounts.value[String(id)]?.api_count ?? 0;
}

function permissionApiIds(id: number | string) {
  return apiCounts.value[String(id)]?.api_ids ?? [];
}

function toPermissionNode(item: AdminPermission): PermissionNode {
  return {
    api_count: permissionApiCount(item.id),
    api_ids: permissionApiIds(item.id),
    auth_code: item.auth_code,
    enabled: item.enabled,
    id: item.id,
    name: item.name,
    order_no: item.order_no,
    perm_type: item.perm_type,
    pid: item.pid,
    title: item.title,
  };
}

const apiCounts = ref<
  Record<string, { api_count: number; api_ids: Array<number | string> }>
>({});

async function loadPermissions() {
  const [items, counts] = await Promise.all([
    ApiPermissionApi.permissionOptions(),
    ApiPermissionApi.permissionCounts(),
  ]);
  apiCountTotal.value = counts.total;
  apiCounts.value = Object.fromEntries(
    counts.items.map((item) => [
      String(item.perm_id),
      { api_count: item.api_count, api_ids: item.api_ids },
    ]),
  );
  permissions.value = items.map((item) => toPermissionNode(item));
  const nonButtonPermissions: PermissionNode[] = [];
  for (const item of permissions.value) {
    if (item.perm_type !== 'button') nonButtonPermissions.push(item);
  }
  menuTree.value = buildMenuTree(permissions.value);
  const currentId = normalizeMenuId(selectedMenuId.value);
  selectedMenuNode.value =
    currentId === 'all' ? undefined : findMenuNode(menuTree.value, currentId);
  menuOptions.value = prependTreeOption(
    buildTreeSelectOptions(nonButtonPermissions),
    { key: 0, title: '未归属', value: 0 },
  );
  permissionOptions.value = buildTreeSelectOptions(permissions.value);
}

onMounted(() => {
  loadPermissions();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>API 权限</h1>
      </div>
      <Space>
        <Button
          v-access:code="'api_permissions:sync'"
          type="primary"
          :loading="syncing"
          @click="syncApis"
        >
          <template #icon><RotateCw /></template>同步 API
        </Button>
      </Space>
    </header>

    <div class="api-layout">
      <Card class="menu-card" size="small" title="按菜单查看">
        <Tree
          label-field="title"
          value-field="id"
          :tree-data="menuTree"
          :default-expanded-level="2"
          @select="selectMenu"
        >
          <template #node="{ value }">
            <span
              class="menu-node"
              :class="`menu-node--${value.perm_type}`"
              :title="`${permissionTypeLabel(value.perm_type)} · ${value.title}`"
            >
              <span class="menu-node-type" aria-hidden="true"></span>
              <span class="menu-node-title">{{ value.title }}</span>
              <Badge
                class="menu-node-count"
                :count="value.api_count"
                :overflow-count="999"
                show-zero
              />
            </span>
          </template>
        </Tree>
      </Card>

      <section class="api-panel">
        <Grid class="management-grid" :table-title="selectedMenuTitle">
          <template #toolbar-tools>
            <Space>
              <Button
                v-access:code="'api_permissions:edit'"
                :loading="batching"
                @click="batchAccessMode('menu')"
              >
                选中跟随当前菜单
              </Button>
              <Button
                v-access:code="'api_permissions:edit'"
                :loading="batching"
                @click="batchAccessMode('login')"
              >
                选中登录可访问
              </Button>
              <Button
                v-access:code="'api_permissions:edit'"
                :loading="batching"
                @click="batchAccessMode('public')"
              >
                选中公开访问
              </Button>
            </Space>
          </template>
          <template #method="{ row }">
            <Tag :color="methodColor(row.api_method)">{{ row.api_method }}</Tag>
          </template>
          <template #path="{ row }">
            <code>{{ row.api_path }}</code>
          </template>
          <template #accessMode="{ row }">
            <Tag :color="accessModeColor(row.access_mode)">
              {{ accessModeLabel(row.access_mode) }}
            </Tag>
          </template>
          <template #clientScope="{ row }">
            <Tag :color="clientScopeColor(row.client_scope)">
              {{ clientScopeLabel(row.client_scope) }}
            </Tag>
          </template>
          <template #operationType="{ row }">
            {{ operationLabel(row.operation_type) }}
          </template>
          <template #ownerMenu="{ row }">
            {{
              row.menu_perm_id && Number(row.menu_perm_id) > 0
                ? permissionTitle(row.menu_perm_id)
                : '未归属'
            }}
          </template>
          <template #name="{ row }">
            {{ displayValue(row.api_name) }}
          </template>
          <template #securityExempt="{ row }">
            <Tag :color="statusColor(!row.security_exempt)">
              {{ row.security_exempt ? '否' : '是' }}
            </Tag>
          </template>
          <template #auditEnabled="{ row }">
            <Tag :color="statusColor(row.audit_enabled ?? true)">
              {{ row.audit_enabled ? '是' : '否' }}
            </Tag>
          </template>
          <template #auditDebug="{ row }">
            <Tag
              :color="
                statusColor((row.audit_enabled ?? true) && !!row.audit_debug)
              "
            >
              {{ row.audit_enabled && row.audit_debug ? '是' : '否' }}
            </Tag>
          </template>
          <template #permissionCount="{ row }">
            <Button
              v-access:code="'api_permissions:assign'"
              size="small"
              type="link"
              @click="openAssign(row)"
            >
              {{ row.permission_count }} 项
            </Button>
          </template>
          <template #createdAt="{ row }">
            {{ Times.formatUnix(row.created_at) }}
          </template>
        </Grid>
      </section>
    </div>

    <PopupModal
      v-model:open="editOpen"
      :confirm-loading="saving"
      title="编辑 API 策略"
      width="min(720px, calc(100vw - 24px))"
      @ok="submitEdit"
    >
      <Form layout="vertical">
        <FormItem label="API">
          <Input
            disabled
            :value="editing ? `${editing.api_method} ${editing.api_path}` : ''"
          />
        </FormItem>
        <FormItem label="展示名称">
          <Input
            v-model:value="form.api_name"
            ::maxlength="100"
            placeholder="例如 用户列表 / 创建角色"
          />
        </FormItem>
        <div class="form-grid">
          <FormItem label="访问策略">
            <Select
              v-model:value="form.access_mode"
              :options="accessModeOptions"
            />
          </FormItem>
          <FormItem label="操作类型">
            <Select
              v-model:value="form.operation_type"
              :options="operationOptions"
            />
          </FormItem>
          <FormItem label="所属菜单">
            <TreeSelect
              v-model:value="form.menu_perm_id"
              allow-clear
              :dropdown-style="{ maxHeight: '420px', overflow: 'auto' }"
              :tree-data="menuOptions"
              tree-default-expand-all
              placeholder="选择后可跟随菜单权限"
            />
          </FormItem>
          <FormItem label="启用 API 权限规则">
            <Checkbox v-model:checked="form.enabled">启用</Checkbox>
          </FormItem>
          <FormItem label="参数加密">
            <Checkbox v-model:checked="form.security_enabled">
              全局安全开关启用时加密请求参数和响应
            </Checkbox>
          </FormItem>
          <FormItem label="操作审计">
            <Checkbox v-model:checked="form.audit_enabled">
              记录请求元数据、状态与耗时
            </Checkbox>
          </FormItem>
          <FormItem label="调试链路">
            <Checkbox
              v-model:checked="form.audit_debug"
              :disabled="!form.audit_enabled"
            >
              记录脱敏且限长的请求头、请求体和响应体
            </Checkbox>
          </FormItem>
        </div>
      </Form>
    </PopupModal>

    <PopupModal
      v-model:open="assignOpen"
      :confirm-loading="assigning"
      :title="assignTitle"
      width="min(760px, calc(100vw - 24px))"
      @ok="submitAssign"
    >
      <Form layout="vertical">
        <FormItem label="关联菜单/按钮权限">
          <TreeSelect
            v-model:value="assignForm.permission_ids"
            allow-clear
            class="w-full"
            :dropdown-style="{ maxHeight: '420px', overflow: 'auto' }"
            :tree-data="permissionOptions"
            tree-checkable
            tree-default-expand-all
            placeholder="仅自定义权限模式使用：拥有任一关联权限即可访问"
          />
        </FormItem>
      </Form>
    </PopupModal>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-heading {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.page-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.api-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.menu-card,
.api-panel,
.management-grid {
  min-height: 0;
}

.menu-card :deep(.ant-card-body) {
  height: calc(100vh - 240px);
  min-height: 360px;
  overflow: auto;
}

.menu-node {
  display: flex;
  gap: 5px;
  align-items: center;
  width: 100%;
  min-width: 0;
  font-size: 12px;
  line-height: 22px;
  color: hsl(var(--muted-foreground));
}

.menu-node-type {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
}

.menu-node-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: currentcolor;
  white-space: nowrap;
}

.menu-node-count {
  flex: 0 0 auto;
  margin-inline: 2px 4px;
}

.menu-node-count :deep(.ant-badge-count) {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 16px;
  background: hsl(var(--muted-foreground));
  box-shadow: none;
}

.menu-node--all {
  color: #1677ff;
}

.menu-node--button {
  color: #d97706;
}

.menu-node--catalog {
  color: #64748b;
}

.menu-node--embedded {
  color: #7c3aed;
}

.menu-node--link {
  color: #0891b2;
}

.menu-node--menu {
  color: #15803d;
}

.menu-node--unassigned {
  color: #dc2626;
}

.api-panel {
  display: flex;
  flex-direction: column;
}

.management-grid {
  flex: 1;
}

.filter-bar {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(220px, 1fr) repeat(4, 120px) auto;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

code {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}

@media (max-width: 1180px) {
  .api-layout {
    grid-template-columns: 1fr;
  }

  .menu-card :deep(.ant-card-body) {
    height: 240px;
    min-height: 0;
  }

  .filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .filter-bar,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
