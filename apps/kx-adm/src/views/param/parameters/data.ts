import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { KxParam } from '#/api/param/param';

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '参数编码前缀' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '启用', value: true },
          { label: '停用', value: false },
        ],
      },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useColumns(
  onEnabledChange: (enabled: boolean, row: KxParam) => Promise<boolean>,
): VxeTableGridColumns<KxParam> {
  return [
    {
      field: 'param_code',
      sortable: true,
      fixed: 'left',
      minWidth: 220,
      slots: { default: 'code' },
      title: '参数编码',
    },
    {
      field: 'param_value',
      minWidth: 360,
      slots: { default: 'value' },
      title: '参数值',
    },
    {
      align: 'center',
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: 'CellSwitch',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      sortable: true,
      title: '状态',
      width: 90,
    },
    {
      align: 'center',
      field: 'confidential',
      slots: { default: 'confidential' },
      title: '敏感',
      width: 90,
    },
    { field: 'remark', minWidth: 220, title: '备注' },
    {
      align: 'right',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}
