<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';
import type { SystemUser } from '#/api/system/user';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { ApiPermissionApi } from '#/api/system/api-permission';
import { SystemMenuApi } from '#/api/system/menu';
import { PermissionGrantTrees } from '#/components/permission-grant';
import { $t } from '#/locales';

import { useDescriptionItems } from '../data';

const detailData = ref<SystemUser>();
const permissionMenus = ref<SystemMenu[]>([]);
const apiPermissions = ref<ApiPermission[]>([]);
const grantsLoading = ref(false);

const items = computed(() => useDescriptionItems(detailData.value));

const [Drawer, drawerApi] = useVbenDrawer<SystemUser>({
  async onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData();
      grantsLoading.value = true;
      try {
        [permissionMenus.value, apiPermissions.value] = await Promise.all([
          SystemMenuApi.list(),
          ApiPermissionApi.allGrantOptions(),
        ]);
      } finally {
        grantsLoading.value = false;
      }
    }
  },
});
</script>
<template>
  <Drawer :footer="false" :title="$t('common.detail')" :size="960">
    <VbenDescriptions bordered :column="1" :items="items" />
    <section class="mt-5">
      <h3 class="mb-3 text-base font-semibold">最终有效权限</h3>
      <PermissionGrantTrees
        :api-ids="detailData?.effectiveApiIds ?? detailData?.apiIds ?? []"
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
