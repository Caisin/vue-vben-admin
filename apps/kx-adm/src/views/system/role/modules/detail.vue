<script lang="ts" setup>
import type { SystemRole } from '#/api';
import type { AdminRoleDetail } from '#/api/auth/admin';
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';

import { ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Descriptions, DescriptionsItem, Tag } from 'antdv-next';

import { AdminRoleApi } from '#/api/auth/admin';
import { loadPermissionCatalog } from '#/api/system/permission-catalog';
import { PermissionGrantTrees } from '#/components/permission-grant';
import { Times } from '#/times';

const detail = ref<AdminRoleDetail>();
const menus = shallowRef<SystemMenu[]>([]);
const apis = shallowRef<ApiPermission[]>([]);
const loading = ref(false);
const [Drawer, drawerApi] = useVbenDrawer<SystemRole>({
  async onOpenChange(open) {
    if (!open) return;
    const row = drawerApi.getData();
    if (!row) return;
    detail.value = undefined;
    loading.value = true;
    try {
      const [currentDetail, catalog] = await Promise.all([
        AdminRoleApi.detail(row.id),
        loadPermissionCatalog(),
      ]);
      detail.value = currentDetail;
      menus.value = catalog.menus;
      apis.value = catalog.apis;
    } finally {
      loading.value = false;
    }
  },
});
</script>
<template>
  <Drawer
    class="w-screen max-w-none"
    :footer="false"
    :loading="loading"
    :title="detail ? `角色详情：${detail.role_name}` : '角色详情'"
  >
    <template v-if="detail">
      <Descriptions :column="2" bordered size="small" class="mb-5">
        <DescriptionsItem label="角色编码">
          {{ detail.role_id }}
        </DescriptionsItem>
        <DescriptionsItem label="角色名称">
          {{ detail.role_name }}
        </DescriptionsItem>
        <DescriptionsItem label="状态">
          <Tag :color="detail.enabled ? 'success' : 'default'">
            {{ detail.enabled ? '启用' : '停用（授权不生效）' }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="排序">{{ detail.order_no }}</DescriptionsItem>
        <DescriptionsItem label="登录默认页面">
          {{
            detail.permission_details.find(
              (item) => String(item.id) === String(detail?.home_perm_id),
            )?.title ||
            (detail.home_perm_id ? `权限 #${detail.home_perm_id}` : '未配置')
          }}
        </DescriptionsItem>
        <DescriptionsItem label="创建时间">
          {{ Times.formatUnix(detail.created_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="备注" :span="2">
          {{ detail.remark || '—' }}
        </DescriptionsItem>
      </Descriptions>
      <PermissionGrantTrees
        :menus="menus"
        :apis="apis"
        :permission-ids="detail.permission_ids.map(String)"
        readonly
      />
    </template>
  </Drawer>
</template>
