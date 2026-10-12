<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';

import { computed, nextTick, ref, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { loadPermissionCatalog } from '#/api/system/permission-catalog';
import { SystemRoleApi } from '#/api/system/role';
import { PermissionGrantTrees } from '#/components/permission-grant';
import { $t } from '#/locales';

import { homePageOptions, homePageOptionValues } from '../../home-page-options';
import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemRole>();
const permissionMenus = shallowRef<SystemMenu[]>([]);
const apiPermissions = shallowRef<ApiPermission[]>([]);
const selectedPermissionIds = ref<string[]>([]);

function resolveHomeOptions(values: Readonly<SystemRole>) {
  return homePageOptions(permissionMenus.value, values.permissions ?? []);
}

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(resolveHomeOptions).map((field) => ({
    ...field,
    ...(field.fieldName === 'permissions'
      ? {
          hideLabel: true,
          formItemClass:
            'min-w-0 items-start xl:col-start-2 xl:row-start-1 xl:row-span-8',
        }
      : { formItemClass: 'min-w-0 xl:col-start-1' }),
  })),
  wrapperClass:
    'grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(28rem,36rem)_minmax(0,1fr)]',
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
      apiIds: [],
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

      const [detail] = await Promise.all([
        data?.id ? SystemRoleApi.detail(data.id) : Promise.resolve(undefined),
        loadPermissionGrants(),
      ]);
      if (detail) {
        formData.value = detail;
        id.value = detail.id;
        selectedPermissionIds.value = [...(detail.permissions ?? [])];
      } else {
        formData.value = undefined;
        id.value = undefined;
        selectedPermissionIds.value = [];
      }

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (formData.value) {
        formApi.setValues(formData.value);
      }
      await formApi.setFieldValue('permissions', selectedPermissionIds.value);
    }
  },
});

async function loadPermissionGrants(refresh = false) {
  loadingGrants.value = true;
  try {
    const { menus, apis } = await loadPermissionCatalog(refresh);
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
  <Drawer class="w-screen max-w-none" :title="getDrawerTitle">
    <Form>
      <template #permissions>
        <PermissionGrantTrees
          :apis="apiPermissions"
          :loading="loadingGrants"
          refreshable
          @refresh="loadPermissionGrants(true)"
          :menus="permissionMenus"
          :permission-ids="selectedPermissionIds"
          @update:permission-ids="updatePermissionIds"
        />
      </template>
    </Form>
  </Drawer>
</template>
