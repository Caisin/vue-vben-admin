<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';
import type { SystemUser } from '#/api/system/user';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { ApiPermissionApi } from '#/api/system/api-permission';
import { SystemMenuApi } from '#/api/system/menu';
import { SystemRoleApi } from '#/api/system/role';
import { SystemUserApi } from '#/api/system/user';
import { PermissionGrantTrees } from '#/components/permission-grant';
import { $t } from '#/locales';
import { requestErrorMessage } from '#/request-errors';

import {
  homePageOptions,
  homePageOptionValues,
  userEffectivePermissionIds,
} from '../../home-page-options';
import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemUser>();
const permissionMenus = ref<SystemMenu[]>([]);
const apiPermissions = ref<ApiPermission[]>([]);
const roles = ref<SystemRole[]>([]);
const selectedPermissionIds = ref<string[]>([]);
const selectedApiIds = ref<string[]>([]);

function resolveHomeOptions(values: Readonly<SystemUser>) {
  const effectiveIds = userEffectivePermissionIds(
    values.permissions ?? [],
    normalizeRoleIds(values.roles),
    roles.value,
  );
  return homePageOptions(permissionMenus.value, effectiveIds);
}

function normalizeRoleIds(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map(String);
  return value ? [String(value)] : [];
}

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(resolveHomeOptions),
  showDefaultActions: false,
});

const loadingGrants = ref(false);
const loadingRoles = ref(false);

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer<SystemUser>({
  async onConfirm() {
    try {
      const { valid } = await formApi.validate();
      if (!valid) {
        message.warning('请检查用户必填信息');
        return;
      }
      const values = await formApi.getValues();
      const validHomeIds = homePageOptionValues(
        resolveHomeOptions(values as SystemUser),
      );
      const payload = {
        ...values,
        apiIds: selectedApiIds.value,
        deptId: values.deptId || 0,
        homePermId:
          values.homePermId && validHomeIds.has(String(values.homePermId))
            ? String(values.homePermId)
            : null,
        permissions: selectedPermissionIds.value,
        roles: normalizeRoleIds(values.roles),
      };
      drawerApi.lock();
      const saved = await (id.value
        ? SystemUserApi.update(id.value, payload)
        : SystemUserApi.create(payload));
      message.success(id.value ? '用户信息已保存' : '用户已创建');
      drawerApi.close();
      emits('success', saved);
    } catch (error) {
      drawerApi.unlock();
      message.error(
        requestErrorMessage(error, '保存用户失败，请检查表单后重试'),
      );
    }
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();

      if (data) {
        formData.value = data;
        id.value = data.id;
        selectedApiIds.value = [...(data.apiIds ?? [])];
        selectedPermissionIds.value = [...(data.permissions ?? [])];
      } else {
        formData.value = undefined;
        id.value = undefined;
        selectedApiIds.value = [];
        selectedPermissionIds.value = [];
      }

      await Promise.all([loadRoles(), loadPermissionGrants()]);
      await formApi.updateSchema([
        {
          componentProps: {
            allowClear: true,
            disabled: Boolean(data?.id),
            placeholder: data?.id
              ? '请从用户操作菜单重置密码'
              : '留空则由服务端生成 12 位随机密码',
          },
          fieldName: 'password',
        },
      ]);
      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
      await formApi.setFieldValue('permissions', selectedPermissionIds.value);
    }
  },
});

async function loadRoles() {
  loadingRoles.value = true;
  try {
    const fetchedRoles = await SystemRoleApi.all();
    roles.value = fetchedRoles;
    await formApi.updateSchema([
      {
        componentProps: {
          loading: loadingRoles.value,
          treeData: roles.value.map((role) => ({
            label: `${role.name}（${role.id}${role.status === 0 ? '，停用' : ''}）`,
            value: role.id,
          })),
        },
        fieldName: 'roles',
      },
    ]);
  } finally {
    loadingRoles.value = false;
    await formApi.updateSchema([
      { componentProps: { loading: false }, fieldName: 'roles' },
    ]);
  }
}

async function loadPermissionGrants() {
  loadingGrants.value = true;
  try {
    const [menus, apis] = await Promise.all([
      SystemMenuApi.list(),
      ApiPermissionApi.unboundOptions(),
    ]);
    permissionMenus.value = menus;
    apiPermissions.value = apis;
  } finally {
    loadingGrants.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('system.user.name'))
    : $t('common.create', $t('system.user.name'));
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
