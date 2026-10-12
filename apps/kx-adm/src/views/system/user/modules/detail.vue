<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';
import type { SystemUser } from '#/api/system/user';

import { computed, ref, shallowRef } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { loadPermissionCatalog } from '#/api/system/permission-catalog';
import { PermissionGrantTrees } from '#/components/permission-grant';
import { $t } from '#/locales';

import { useDescriptionItems } from '../data';

const detailData = ref<SystemUser>();
const permissionMenus = shallowRef<SystemMenu[]>([]);
const apiPermissions = shallowRef<ApiPermission[]>([]);
const grantsLoading = ref(false);

const items = computed(() => useDescriptionItems(detailData.value));

const [Drawer, drawerApi] = useVbenDrawer<SystemUser>({
  async onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData();
      grantsLoading.value = true;
      try {
        const catalog = await loadPermissionCatalog();
        permissionMenus.value = catalog.menus;
        apiPermissions.value = catalog.apis;
      } finally {
        grantsLoading.value = false;
      }
    }
  },
});
</script>
<template>
  <Drawer
    class="w-screen max-w-none"
    :footer="false"
    :title="$t('common.detail')"
  >
    <VbenDescriptions bordered :column="1" :items="items" />
    <section class="mt-5">
      <h3 class="mb-3 text-base font-semibold">最终有效权限</h3>
      <PermissionGrantTrees
        :apis="apiPermissions"
        :loading="grantsLoading"
        :menus="permissionMenus"
        :permission-ids="
          detailData?.effectivePermissionIds ?? detailData?.permissions ?? []
        "
        readonly
      />
    </section>
  </Drawer>
</template>
