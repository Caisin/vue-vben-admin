import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AssetBalanceView } from '#/api';

export interface BalanceRow extends AssetBalanceView {
  row_key: string;
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'acct_id',
      label: '资金账户 ID',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<BalanceRow> {
  return [
    {
      field: 'asset_item.code',
      fixed: 'left',
      title: '资产编码',
      width: 160,
    },
    { field: 'asset_item.name', title: '资产名称', width: 180 },
    { field: 'asset_item.kind', title: '类型', width: 110 },
    { field: 'total_amount', title: '可用余额', width: 130 },
    { field: 'lots.length', title: '有效批次', width: 110 },
    {
      field: 'asset_item.default_valid_seconds',
      title: '默认有效秒数',
      width: 150,
    },
  ];
}
