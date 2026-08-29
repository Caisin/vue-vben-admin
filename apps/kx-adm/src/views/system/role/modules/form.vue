<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { ApiPermissionApi } from '#/api/system/api-permission';
import { SystemMenuApi } from '#/api/system/menu';
import { SystemRoleApi } from '#/api/system/role';
import { PermissionGrantTrees } from '#/components/permission-grant';
import { $t } from '#/locales';

import { homePageOptions, homePageOptionValues } from '../../home-page-options';
import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemRole>();
const permissionMenus = ref<SystemMenu[]>([]);
const apiPermissions = ref<ApiPermission[]>([]);
const selectedPermissionIds = ref<string[]>([]);
const selectedApiIds = ref<string[]>([]);

function resolveHomeOptions(values: Readonly<SystemRole>) {
  return homePageOptions(permissionMenus.value, values.permissions ?? []);
}

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(resolveHomeOptions),
  showDefaultActions: false,
});

const loadingGrants = ref(false);

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer<SystemRole>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    const validHomeIds = homePageOptionValues(
      resolveHomeOptions(values as SystemRole),
    );
    const payload = {
      ...values,
      apiIds: selectedApiIds.value,
      homePermId:
        values.homePermId && validHomeIds.has(String(values.homePermId))
          ? String(values.homePermId)
          : null,
      permissions: selectedPermissionIds.value,
    };
    drawerApi.lock();
    (id.value
      ? SystemRoleApi.update(id.value, payload)
      : SystemRoleApi.create(payload)
    )
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();

      if (data?.id) {
        const detail = await SystemRoleApi.detail(data.id);
        formData.value = detail;
        id.value = detail.id;
        selectedApiIds.value = [...(detail.apiIds ?? [])];
        selectedPermissionIds.value = [...(detail.permissions ?? [])];
      } else {
        formData.value = undefined;
        id.value = undefined;
        selectedApiIds.value = [];
        selectedPermissionIds.value = [];
      }

      await loadPermissionGrants();
      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (formData.value) {
        formApi.setValues(formData.value);
      }
      await formApi.setFieldValue('permissions', selectedPermissionIds.value);
    }
  },
});

async function loadPermissionGrants() {
  loadingGrants.value = true;
  try {
    const [menus, apis] = await Promise.all([
      SystemMenuApi.list(),
      ApiPermissionApi.allGrantOptions(),
    ]);
    permissionMenus.value = menus;
    apiPermissions.value = apis;
  } finally {
    loadingGrants.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('system.role.name'))
    : $t('common.create', $t('system.role.name'));
});

async function updatePermissionIds(ids: string[]) {
  selectedPermissionIds.value = ids;
  await formApi.setFieldValue('permissions', ids);
}
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions>
        <PermissionGrantTrees
          :api-ids="selectedApiIds"
          :apis="apiPermissions"
          :loading="loadingGrants"
          :menus="permissionMenus"
          :permission-ids="selectedPermissionIds"
          @update:api-ids="selectedApiIds = $event"
          @update:permission-ids="updatePermissionIds"
        />
      </template>
    </Form>
  </Drawer>
</template>
