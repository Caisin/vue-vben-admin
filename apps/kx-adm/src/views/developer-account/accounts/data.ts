import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { DeveloperAccountListItem } from '#/api/developer-account';

export const platformOptions = [
  { label: 'Apple Developer', value: 'apple' },
  { label: 'Google Developer', value: 'google' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: '账户、主体、公司、APP、设备或认证人' },
      fieldName: 'keyword',
      label: '全文关键字',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: platformOptions },
      fieldName: 'platform',
      label: '平台',
    },
    {
      component: 'DicSelect',
      componentProps: {
        allowClear: true,
        autoSelect: false,
        code: 'developer_account_status',
      },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'DicSelect',
      componentProps: {
        allowClear: true,
        autoSelect: false,
        code: 'developer_account_small_business_status',
      },
      fieldName: 'small_business_status',
      label: '小企业状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<DeveloperAccountListItem> {
  return [
    {
      field: 'account',
      fixed: 'left',
      minWidth: 210,
      slots: { default: 'account' },
      title: '开发者账户',
    },
    {
      field: 'subject_id',
      minWidth: 200,
      slots: { default: 'subject' },
      title: '关联主体',
    },
    {
      field: 'certifier_name',
      minWidth: 120,
      slots: { default: 'certifierName' },
      title: '认证人',
    },
    {
      field: 'certifier_phone',
      minWidth: 140,
      slots: { default: 'certifierPhone' },
      title: '认证电话',
    },
    {
      field: 'registered_at',
      minWidth: 180,
      slots: { default: 'registeredAt' },
      title: '注册时间',
    },
    {
      field: 'renewal_due_at',
      minWidth: 180,
      slots: { default: 'renewalDueAt' },
      title: '续费时间',
    },
    {
      field: 'device_count',
      minWidth: 90,
      slots: { default: 'deviceCount' },
      title: '设备',
    },
    {
      field: 'app_count',
      minWidth: 90,
      slots: { default: 'appCount' },
      title: 'APP',
    },
    {
      field: 'access_scope',
      minWidth: 110,
      slots: { default: 'accessScope' },
      title: '授权范围',
    },
    {
      field: 'small_business_status',
      minWidth: 130,
      slots: { default: 'smallBusinessStatus' },
      title: '小企业状态',
    },
    {
      field: 'status',
      minWidth: 120,
      slots: { default: 'status' },
      title: '状态',
    },
  ];
}
