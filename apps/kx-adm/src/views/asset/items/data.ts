import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AssetItem } from '#/api/asset/asset';

import { enabledSelectOptions } from '#/views/_shared/crud-page';

export const assetKindOptions = [
  { label: '积分（虚拟币）', value: 'coin' },
  { label: '优惠券', value: 'coupon' },
  { label: '信用额度', value: 'credit' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '资产编码' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: enabledSelectOptions,
      },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useColumns(
  onEnabledChange?: (
    enabled: boolean,
    row: AssetItem,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<AssetItem> {
  return [
    {
      field: 'code',
      sortable: true,
      fixed: 'left',
      title: '资产编码',
      width: 160,
    },
    {
      field: 'name',
      minWidth: 190,
      slots: { default: 'nameCell' },
      title: '资产名称',
    },
    {
      cellRender: { name: 'CellTag', options: assetKindOptions },
      field: 'kind',
      title: '类型',
      width: 110,
    },
    {
      field: 'spend_priority',
      sortable: true,
      title: '扣减优先级',
      width: 120,
    },
    { field: 'default_valid_seconds', title: '默认有效秒数', width: 140 },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: onEnabledChange ? 'CellSwitch' : 'CellTag',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 90,
    },
    { field: 'intro', minWidth: 220, title: '说明' },
  ];
}
