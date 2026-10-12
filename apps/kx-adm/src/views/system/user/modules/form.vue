<script lang="ts" setup>
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';
import type { SystemUser } from '#/api/system/user';

import { computed, nextTick, ref, shallowRef } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { loadPermissionCatalog } from '#/api/system/permission-catalog';
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

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const delegatedRoleMode = computed(
  () =>
    hasAccessByCodes([
      formData.value?.id ? 'users:delegate-update' : 'users:delegate-create',
    ]) &&
    !hasAccessByCodes([formData.value?.id ? 'users:update' : 'users:create']),
);
const canAssignAllRoles = computed(() => userStore.userRoles.includes('admin'));

const formData = ref<SystemUser>();
const permissionMenus = shallowRef<SystemMenu[]>([]);
const apiPermissions = shallowRef<ApiPermission[]>([]);
const roles = ref<SystemRole[]>([]);
const selectedPermissionIds = ref<string[]>([]);
const immutableRoleIds = ref<string[]>([]);

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
const loadingRoles = ref(false);

const id = ref();
const editingSelf = computed(
  () =>
    id.value !== undefined &&
    String(id.value) === String(userStore.userInfo?.userId),
);
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
      let homePermId = formData.value?.homePermId ?? null;
      if (!delegatedRoleMode.value) {
        homePermId =
          values.homePermId && validHomeIds.has(String(values.homePermId))
            ? String(values.homePermId)
            : null;
      }
      const payload = {
        ...values,
        apiIds: [],
        deptId: values.deptId || 0,
        homePermId,
        permissions: selectedPermissionIds.value,
        roles: [
          ...new Set([
            ...immutableRoleIds.value,
            ...normalizeRoleIds(values.roles),
          ]),
        ],
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
        selectedPermissionIds.value = [...(data.permissions ?? [])];
        immutableRoleIds.value = [];
      } else {
        formData.value = undefined;
        id.value = undefined;
        selectedPermissionIds.value = [];
        immutableRoleIds.value = [];
      }

      await Promise.all([
        loadRoles(),
        delegatedRoleMode.value ? Promise.resolve() : loadPermissionGrants(),
      ]);
      if (data && !canAssignAllRoles.value) {
        const assignableRoleIds = new Set(roles.value.map((role) => role.id));
        immutableRoleIds.value = normalizeRoleIds(data.roles).filter(
          (roleId) => !assignableRoleIds.has(roleId),
        );
      }
      await formApi.updateSchema([
        {
          componentProps: { disabled: editingSelf.value },
          fieldName: 'roles',
        },
        { fieldName: 'permissions', hide: delegatedRoleMode.value },
        {
          componentProps: { disabled: editingSelf.value },
          fieldName: 'homePermId',
          hide: delegatedRoleMode.value,
        },
      ]);
      await formApi.updateSchema([
        {
          componentProps: {
            allowClear: true,
            disabled: false,
            placeholder: '留空则由服务端生成 12 位随机密码',
          },
          fieldName: 'password',
          hide: Boolean(data?.id),
        },
      ]);
      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
      await formApi.setFieldValue('password', '');
      await formApi.setFieldValue('permissions', selectedPermissionIds.value);
    }
  },
});

async function loadRoles() {
  loadingRoles.value = true;
  try {
    const fetchedRoles = await SystemRoleApi.assignable();
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
    ? $t('common.edit', $t('system.user.name'))
    : $t('common.create', $t('system.user.name'));
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
          v-if="!delegatedRoleMode"
          :apis="apiPermissions"
          :loading="loadingGrants"
          refreshable
          @refresh="loadPermissionGrants(true)"
          :menus="permissionMenus"
          :permission-ids="selectedPermissionIds"
          :readonly="editingSelf"
          @update:permission-ids="updatePermissionIds"
        />
      </template>
    </Form>
  </Drawer>
</template>
