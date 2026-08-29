import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PhoneGroup } from '#/api/msg';

const enabledOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'grp_code_prefix', label: '分组编码' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: enabledOptions },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useColumns(
  onEnabledChange?: (
    enabled: boolean,
    row: PhoneGroup,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PhoneGroup> {
  return [
    {
      field: 'grp_name',
      sortable: true,
      fixed: 'left',
      slots: { default: 'groupName' },
      title: '分组名称',
      width: 180,
    },
    { field: 'grp_code', sortable: true, title: '分组编码', width: 180 },
    {
      field: 'sim_count',
      slots: { default: 'simCount' },
      title: '号码数',
      width: 100,
    },
    {
      field: 'user_count',
      slots: { default: 'userCount' },
      title: '授权用户',
      width: 110,
    },
    {
      cellRender: {
        attrs: {
          auth: 'phone_groups:manage',
          beforeChange: onEnabledChange,
        },
        name: onEnabledChange ? 'CellSwitch' : 'CellTag',
        options: enabledOptions,
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 90,
    },
    { field: 'order_no', sortable: true, title: '排序', width: 80 },
    { field: 'remark', minWidth: 220, title: '备注' },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 170,
    },
  ];
}
