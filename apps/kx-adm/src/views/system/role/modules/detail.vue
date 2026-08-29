<script lang="ts" setup>
import type { RoleApiPermissionDetail, RolePermissionDetail } from '../data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRole } from '#/api';
import type { AdminPermission, AdminRoleDetail } from '#/api/auth/admin';
import type { ApiPermissionCount } from '#/api/system/api-permission';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Descriptions,
  DescriptionsItem,
  message,
  Space,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AdminPermissionApi, AdminRoleApi } from '#/api/auth/admin';
import { ApiPermissionApi } from '#/api/system/api-permission';
import { displayValue } from '#/management';
import { Times } from '#/times';

import {
  accessModeColor,
  accessModeLabel,
  methodColor,
  operationTypeLabel,
  permissionTypeColor,
  permissionTypeLabel,
  useApiDetailColumns,
  usePermissionDetailColumns,
} from '../data';

const drawerLoading = ref(false);
const roleDetail = ref<AdminRoleDetail>();
const permissionRows = ref<RolePermissionDetail[]>([]);
const apiRows = ref<RoleApiPermissionDetail[]>([]);
const homePermission = computed(() =>
  permissionRows.value.find(
    (permission) =>
      String(permission.id) === String(roleDetail.value?.home_perm_id),
  ),
);

const [PermissionGrid, permissionGridApi] =
  useVbenVxeGrid<RolePermissionDetail>({
    gridOptions: {
      columns: usePermissionDetailColumns(),
      height: 280,
      pagerConfig: { enabled: false },
      rowConfig: { keyField: 'id' },
      toolbarConfig: {
        custom: false,
        export: false,
        refresh: false,
        search: false,
        zoom: false,
      },
    } as VxeTableGridOptions<RolePermissionDetail>,
  });

const [ApiGrid, apiGridApi] = useVbenVxeGrid<RoleApiPermissionDetail>({
  gridOptions: {
    columns: useApiDetailColumns(),
    height: 360,
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const start = (page.currentPage - 1) * page.pageSize;
          return {
            items: apiRows.value.slice(start, start + page.pageSize),
            total: apiRows.value.length,
          };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions<RoleApiPermissionDetail>,
});

const [Drawer, drawerApi] = useVbenDrawer<SystemRole>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const row = drawerApi.getData();
    if (!row) return;
    await loadRoleDetail(row.id);
  },
});

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function toPermissionRow(
  id: number | string,
  permission: AdminPermission | undefined,
  count: ApiPermissionCount | undefined,
): RolePermissionDetail {
  if (!permission) {
    return {
      api_count: count?.api_count ?? 0,
      auth_code: '',
      enabled: undefined,
      id,
      missing: true,
      order_no: 0,
      path: '',
      perm_type: undefined,
      title: `未知权限 #${id}`,
    };
  }
  return {
    api_count: count?.api_count ?? 0,
    auth_code: permission.auth_code,
    enabled: permission.enabled,
    id: permission.id,
    missing: false,
    order_no: permission.order_no,
    path: permission.path,
    perm_type: permission.perm_type,
    title: permission.title,
  };
}

async function loadRoleDetail(roleId: string) {
  drawerLoading.value = true;
  roleDetail.value = undefined;
  permissionRows.value = [];
  apiRows.value = [];
  try {
    const [detail, permissions, countSummary] = await Promise.all([
      AdminRoleApi.detail(roleId),
      AdminPermissionApi.list(),
      ApiPermissionApi.permissionCounts(),
    ]);
    roleDetail.value = detail;
    const permissionIds = Array.isArray(detail.permission_ids)
      ? detail.permission_ids
      : [];
    const roleApiIds = Array.isArray(detail.api_ids) ? detail.api_ids : [];

    const permissionById = new Map(
      permissions.map((permission) => [String(permission.id), permission]),
    );
    const countByPermissionId = new Map(
      countSummary.items.map((count) => [String(count.perm_id), count]),
    );
    permissionRows.value = permissionIds
      .map((id) =>
        toPermissionRow(
          id,
          permissionById.get(String(id)),
          countByPermissionId.get(String(id)),
        ),
      )
      .toSorted(
        (left, right) =>
          Number(left.missing) - Number(right.missing) ||
          left.order_no - right.order_no ||
          left.title.localeCompare(right.title),
      );

    const apiPermissionTitles = new Map<string, string[]>();
    for (const apiId of roleApiIds) {
      apiPermissionTitles.set(String(apiId), ['角色直接授权']);
    }
    for (const permission of permissionRows.value) {
      const count = countByPermissionId.get(String(permission.id));
      for (const apiId of count?.api_ids ?? []) {
        const key = String(apiId);
        const titles = apiPermissionTitles.get(key) ?? [];
        if (!titles.includes(permission.title)) titles.push(permission.title);
        apiPermissionTitles.set(key, titles);
      }
    }

    const apiIds = [...apiPermissionTitles.keys()];
    const apiPages = await Promise.all(
      chunks(apiIds, 100).map(async (ids) => {
        const page = await ApiPermissionApi.list({
          ids: ids.map(Number),
          page: 1,
          size: 100,
        });
        return page.items;
      }),
    );
    const apiById = new Map(
      apiPages.flat().map((api) => [String(api.id), api]),
    );
    apiRows.value = [...apiById.values()]
      .map((api) => ({
        ...api,
        permission_titles: apiPermissionTitles.get(String(api.id)) ?? [],
      }))
      .toSorted(
        (left, right) =>
          left.api_path.localeCompare(right.api_path) ||
          left.api_method.localeCompare(right.api_method),
      );

    await nextTick();
    await Promise.all([
      permissionGridApi.grid.reloadData(permissionRows.value),
      apiGridApi.reload(),
    ]);
  } catch {
    message.error('角色详情加载失败');
  } finally {
    drawerLoading.value = false;
  }
}
</script>

<template>
  <Drawer
    class="w-full max-w-300"
    :footer="false"
    :loading="drawerLoading"
    :title="roleDetail ? `角色详情：${roleDetail.role_name}` : '角色详情'"
  >
    <template v-if="roleDetail">
      <Descriptions :column="{ xs: 1, sm: 2, lg: 3 }" bordered size="small">
        <DescriptionsItem label="角色 ID">
          {{ roleDetail.role_id }}
        </DescriptionsItem>
        <DescriptionsItem label="角色名称">
          {{ roleDetail.role_name }}
        </DescriptionsItem>
        <DescriptionsItem label="状态">
          <Tag :color="roleDetail.enabled ? 'success' : 'default'">
            {{ roleDetail.enabled ? '启用' : '禁用' }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="排序">
          {{ roleDetail.order_no }}
        </DescriptionsItem>
        <DescriptionsItem label="登录默认页面">
          <template v-if="homePermission">
            {{ homePermission.title }}（{{
              displayValue(homePermission.path)
            }}）
          </template>
          <template v-else>
            {{
              roleDetail.home_perm_id
                ? `权限 #${roleDetail.home_perm_id}`
                : '未配置'
            }}
          </template>
        </DescriptionsItem>
        <DescriptionsItem label="创建时间">
          {{ Times.formatUnix(roleDetail.created_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="授权概览">
          {{ permissionRows.length }} 项权限 / {{ apiRows.length }} 个 API
        </DescriptionsItem>
        <DescriptionsItem :span="{ xs: 1, sm: 2, lg: 3 }" label="备注">
          {{ displayValue(roleDetail.remark) }}
        </DescriptionsItem>
      </Descriptions>

      <section class="detail-section">
        <PermissionGrid :table-title="`授权权限（${permissionRows.length}）`">
          <template #permissionType="{ row }">
            <Tag :color="permissionTypeColor(row.perm_type)">
              {{ permissionTypeLabel(row.perm_type) }}
            </Tag>
          </template>
          <template #permissionCode="{ row }">
            <code>{{ displayValue(row.auth_code) }}</code>
          </template>
          <template #permissionPath="{ row }">
            <code>{{ displayValue(row.path) }}</code>
          </template>
          <template #permissionStatus="{ row }">
            <Tag
              :color="
                row.enabled === undefined
                  ? 'error'
                  : row.enabled
                    ? 'success'
                    : 'default'
              "
            >
              {{
                row.enabled === undefined
                  ? '缺失'
                  : row.enabled
                    ? '启用'
                    : '禁用'
              }}
            </Tag>
          </template>
        </PermissionGrid>
      </section>

      <section class="detail-section">
        <ApiGrid :table-title="`可访问 API（${apiRows.length}）`">
          <template #apiMethod="{ row }">
            <Tag :color="methodColor(row.api_method)">
              {{ row.api_method }}
            </Tag>
          </template>
          <template #apiPath="{ row }">
            <code>{{ row.api_path }}</code>
          </template>
          <template #apiName="{ row }">
            {{ displayValue(row.api_name) }}
          </template>
          <template #apiAccessMode="{ row }">
            <Tag :color="accessModeColor(row.access_mode)">
              {{ accessModeLabel(row.access_mode) }}
            </Tag>
          </template>
          <template #apiOperationType="{ row }">
            {{ operationTypeLabel(row.operation_type) }}
          </template>
          <template #apiPermissions="{ row }">
            <Space :size="[4, 4]" wrap>
              <Tag v-for="title in row.permission_titles" :key="title">
                {{ title }}
              </Tag>
            </Space>
          </template>
          <template #apiStatus="{ row }">
            <Tag :color="row.enabled ? 'success' : 'default'">
              {{ row.enabled ? '启用' : '禁用' }}
            </Tag>
          </template>
        </ApiGrid>
      </section>
    </template>
  </Drawer>
</template>

<style scoped>
.detail-section {
  margin-top: 20px;
}

code {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
