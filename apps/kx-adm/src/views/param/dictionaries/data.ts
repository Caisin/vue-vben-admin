import type { EditableDicData } from './dictionary-data-edit';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { DicCode } from '#/api';

const stateOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '字典编码' },
    { component: 'Input', fieldName: 'name_prefix', label: '字典名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useCodeColumns(
  onEnabledChange: (enabled: boolean, row: DicCode) => Promise<boolean>,
): VxeTableGridColumns<DicCode> {
  return [
    {
      field: 'code',
      sortable: true,
      fixed: 'left',
      slots: { default: 'codeCell' },
      title: '字典编码',
      width: 170,
    },
    {
      field: 'dic_name',
      sortable: true,
      minWidth: 260,
      slots: { default: 'codeNameCell' },
      title: '字典名称',
    },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: 'CellSwitch',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 80,
    },
  ];
}

export function useDataColumns(
  onEnabledChange: (enabled: boolean, row: EditableDicData) => Promise<boolean>,
): VxeTableGridColumns<EditableDicData> {
  return [
    {
      field: 'drag',
      slots: { default: 'drag' },
      title: '',
      width: 40,
    },
    {
      field: 'label',
      fixed: 'left',
      slots: { default: 'label' },
      title: '文本',
      width: 180,
    },
    {
      field: 'value',
      minWidth: 220,
      slots: { default: 'value' },
      title: '值 JSON',
    },
    {
      field: 'is_def',
      slots: { default: 'is_def' },
      title: '默认',
      width: 64,
    },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: 'CellSwitch',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      fixed: 'right',
      title: '状态',
      width: 90,
    },
  ];
}
