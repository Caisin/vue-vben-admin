import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { DeveloperAccountAccessGroup } from '#/api/developer-account';

export const enabledOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '分组名称或编码' },
      fieldName: 'keyword',
      label: '全文关键字',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: enabledOptions },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<DeveloperAccountAccessGroup> {
  return [
    {
      field: 'grp_name',
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'groupName' },
      title: '分组名称',
    },
    { field: 'grp_code', minWidth: 180, title: '分组编码' },
    {
      field: 'account_count',
      slots: { default: 'accountCount' },
      title: '账户',
      width: 110,
    },
    {
      field: 'user_count',
      slots: { default: 'userCount' },
      title: '授权用户',
      width: 120,
    },
    {
      field: 'enabled',
      slots: { default: 'enabled' },
      title: '状态',
      width: 90,
    },
    { field: 'order_no', title: '排序', width: 90 },
    { field: 'remark', minWidth: 220, title: '备注' },
    {
      field: 'remove',
      fixed: 'right',
      slots: { default: 'remove' },
      title: '',
      width: 56,
    },
  ];
}
