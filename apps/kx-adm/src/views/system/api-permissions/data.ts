import type { VbenFormSchema } from '#/adapter/form';
import type {
  OnActionClickParams,
  VxeTableGridColumns,
} from '#/adapter/vxe-table';
import type {
  ApiAccessMode,
  ApiClientScope,
  ApiOperationType,
  ApiPermission,
} from '#/api/system/api-permission';

export const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(
  (value) => ({ label: value, value }),
);

export const boolOptions = [
  { label: '是', value: true },
  { label: '否', value: false },
];

export const accessModeOptions: Array<{
  label: string;
  value: ApiAccessMode;
}> = [
  { label: '跟随菜单', value: 'menu' },
  { label: '登录可访问', value: 'login' },
  { label: '公开访问', value: 'public' },
  { label: '自定义权限', value: 'custom' },
];

export const clientScopeOptions: Array<{
  label: string;
  value: ApiClientScope;
}> = [
  { label: '后台', value: 'backend' },
  { label: '移动端', value: 'mobile' },
  { label: '公开', value: 'public' },
];

export const operationOptions: Array<{
  label: string;
  value: ApiOperationType;
}> = [
  { label: '列表', value: 'list' },
  { label: '详情', value: 'detail' },
  { label: '新建', value: 'create' },
  { label: '修改', value: 'modify' },
  { label: '删除', value: 'delete' },
  { label: '动作', value: 'action' },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'api_code_prefix', label: 'API 编码' },
    { component: 'Input', fieldName: 'api_path_prefix', label: 'API 路径' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: methodOptions },
      fieldName: 'api_method',
      label: '方法',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: accessModeOptions },
      fieldName: 'access_mode',
      label: '访问策略',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: operationOptions },
      fieldName: 'operation_type',
      label: '操作类型',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: boolOptions },
      fieldName: 'enabled',
      label: '启用状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: boolOptions },
      fieldName: 'security_exempt',
      label: '免加密',
    },
  ];
}

export function useColumns(
  onEnabledChange: (enabled: boolean, row: ApiPermission) => Promise<boolean>,
  onActionClick: (params: OnActionClickParams<ApiPermission>) => void,
): VxeTableGridColumns<ApiPermission> {
  return [
    { type: 'checkbox', width: 46 },
    {
      field: 'api_method',
      sortable: true,
      fixed: 'left',
      slots: { default: 'method' },
      title: '方法',
      width: 90,
    },
    {
      field: 'api_code',
      sortable: true,
      minWidth: 220,
      title: 'API 编码',
    },
    {
      field: 'api_path',
      sortable: true,
      minWidth: 280,
      slots: { default: 'path' },
      title: 'API 路径',
    },
    {
      field: 'access_mode',
      slots: { default: 'accessMode' },
      title: '访问策略',
      width: 120,
    },
    {
      field: 'client_scope',
      slots: { default: 'clientScope' },
      title: '端类型',
      width: 90,
    },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: 'CellSwitch',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 90,
    },
    {
      field: 'operation_type',
      slots: { default: 'operationType' },
      title: '操作类型',
      width: 100,
    },
    {
      field: 'menu_perm_id',
      sortable: true,
      minWidth: 160,
      slots: { default: 'ownerMenu' },
      title: '所属菜单',
    },
    {
      align: 'center',
      field: 'security_exempt',
      sortable: true,
      slots: { default: 'securityExempt' },
      title: '参数加密',
      width: 90,
    },
    {
      align: 'center',
      field: 'audit_enabled',
      slots: { default: 'auditEnabled' },
      title: '操作审计',
      width: 90,
    },
    {
      align: 'center',
      field: 'audit_debug',
      slots: { default: 'auditDebug' },
      title: '调试链路',
      width: 90,
    },
    {
      align: 'center',
      field: 'permission_count',
      slots: { default: 'permissionCount' },
      title: '自定义权限',
      width: 120,
    },
    {
      field: 'api_name',
      minWidth: 160,
      slots: { default: 'name' },
      title: '名称',
    },
    {
      field: 'created_at',
      sortable: true,
      slots: { default: 'createdAt' },
      title: '创建时间',
      width: 170,
    },
    {
      align: 'right',
      cellRender: {
        attrs: { nameField: 'api_code', onClick: onActionClick },
        name: 'CellOperation',
        options: [
          {
            auth: 'api_permissions:edit',
            code: 'edit',
            text: '策略',
          },
          {
            auth: 'api_permissions:assign',
            code: 'assign',
            text: '高级',
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 140,
    },
  ];
}
