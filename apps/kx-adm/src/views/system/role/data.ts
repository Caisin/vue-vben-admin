import type { HomePageOption } from '../home-page-options';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemRole } from '#/api';
import type { PermissionType } from '#/api/auth/admin';
import type {
  ApiAccessMode,
  ApiOperationType,
  ApiPermission,
} from '#/api/system/api-permission';

import { $t } from '#/locales';
import { Times } from '#/times';

export interface RolePermissionDetail {
  api_count: number;
  auth_code: string;
  enabled?: boolean;
  id: number | string;
  missing: boolean;
  order_no: number;
  path: string;
  perm_type?: PermissionType;
  title: string;
}

export interface RoleApiPermissionDetail extends ApiPermission {
  permission_titles: string[];
}

const permissionTypeLabels: Record<PermissionType, string> = {
  button: '按钮',
  catalog: '目录',
  embedded: '内嵌',
  link: '外链',
  menu: '菜单',
};

const accessModeLabels: Record<ApiAccessMode, string> = {
  custom: '自定义权限',
  login: '登录可访问',
  menu: '跟随菜单',
  public: '公开访问',
};

const operationTypeLabels: Record<ApiOperationType, string> = {
  action: '动作',
  create: '新建',
  delete: '删除',
  detail: '详情',
  list: '列表',
  modify: '修改',
};

export function permissionTypeLabel(value?: PermissionType) {
  return value ? permissionTypeLabels[value] : '元数据缺失';
}

export function permissionTypeColor(value?: PermissionType) {
  if (!value) return 'error';
  const colors: Record<PermissionType, string> = {
    button: 'warning',
    catalog: 'default',
    embedded: 'purple',
    link: 'cyan',
    menu: 'success',
  };
  return colors[value];
}

export function accessModeLabel(value: ApiAccessMode) {
  return accessModeLabels[value];
}

export function accessModeColor(value: ApiAccessMode) {
  const colors: Record<ApiAccessMode, string> = {
    custom: 'warning',
    login: 'default',
    menu: 'processing',
    public: 'success',
  };
  return colors[value];
}

export function operationTypeLabel(value: ApiOperationType) {
  return operationTypeLabels[value];
}

export function methodColor(method: string) {
  const colors: Record<string, string> = {
    DELETE: 'error',
    GET: 'processing',
    PATCH: 'warning',
    POST: 'success',
    PUT: 'warning',
  };
  return colors[method] ?? 'default';
}

export function useFormSchema(
  resolveHomeOptions: (values: Readonly<SystemRole>) => HomePageOption[],
): VbenFormSchema<SystemRole>[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'Input',
      fieldName: 'permissions',
      formItemClass: 'items-start',
      label: '权限授权',
      modelPropName: 'modelValue',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        placeholder: '未配置时不提供角色默认页',
        showSearch: true,
      },
      dependencies: {
        resolve: ({ values }) => ({
          componentProps: {
            allowClear: true,
            class: 'w-full',
            optionFilterProp: 'label',
            options: resolveHomeOptions(values),
            placeholder: '未配置时不提供角色默认页',
            showSearch: true,
          },
        }),
        triggerFields: ['permissions'],
      },
      fieldName: 'homePermId',
      label: '登录默认页面',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
    },
    { component: 'Input', fieldName: 'id', label: $t('system.role.id') },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.role.createTime'),
    },
  ];
}

export function useColumns<T = SystemRole>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns {
  return [
    {
      field: 'name',
      title: $t('system.role.roleName'),
      width: 200,
    },
    {
      field: 'id',
      title: $t('system.role.id'),
      width: 200,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.role.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('system.role.remark'),
    },
    {
      field: 'createTime',
      formatter: ({ row }) => Times.formatUnix(row.createTime),
      title: $t('system.role.createTime'),
      width: 200,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.role.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.role.operation'),
      width: 130,
    },
  ];
}

export function usePermissionDetailColumns(): VxeTableGridColumns<RolePermissionDetail> {
  return [
    {
      field: 'title',
      fixed: 'left',
      minWidth: 180,
      title: '权限名称',
    },
    {
      field: 'perm_type',
      slots: { default: 'permissionType' },
      title: '类型',
      width: 100,
    },
    {
      field: 'auth_code',
      minWidth: 180,
      slots: { default: 'permissionCode' },
      title: '权限码',
    },
    {
      field: 'path',
      minWidth: 180,
      slots: { default: 'permissionPath' },
      title: '路由',
    },
    {
      align: 'center',
      field: 'api_count',
      title: '关联 API',
      width: 100,
    },
    {
      align: 'center',
      field: 'enabled',
      slots: { default: 'permissionStatus' },
      title: '状态',
      width: 90,
    },
  ];
}

export function useApiDetailColumns(): VxeTableGridColumns<RoleApiPermissionDetail> {
  return [
    {
      field: 'api_method',
      fixed: 'left',
      slots: { default: 'apiMethod' },
      title: '方法',
      width: 90,
    },
    {
      field: 'api_path',
      minWidth: 260,
      slots: { default: 'apiPath' },
      title: 'API 路径',
    },
    {
      field: 'api_name',
      minWidth: 160,
      slots: { default: 'apiName' },
      title: '名称',
    },
    {
      field: 'access_mode',
      slots: { default: 'apiAccessMode' },
      title: '访问策略',
      width: 120,
    },
    {
      field: 'operation_type',
      slots: { default: 'apiOperationType' },
      title: '操作类型',
      width: 100,
    },
    {
      field: 'permission_titles',
      minWidth: 220,
      slots: { default: 'apiPermissions' },
      title: '本角色来源权限',
    },
    {
      align: 'center',
      field: 'enabled',
      slots: { default: 'apiStatus' },
      title: '状态',
      width: 90,
    },
  ];
}
