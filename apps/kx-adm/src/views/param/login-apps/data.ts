import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { DingtalkAppConfig, WechatAppConfig } from '#/api';

const stateOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

const boolTagOptions = [
  { color: 'success', label: '是', value: true },
  { color: 'default', label: '否', value: false },
];

export function useDingtalkFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'app_key_prefix', label: 'AppKey' },
    { component: 'Input', fieldName: 'app_name_prefix', label: '应用名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useWechatFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'app_id_prefix', label: 'AppID' },
    { component: 'Input', fieldName: 'app_name_prefix', label: '应用名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useDingtalkColumns(
  onEnabledChange: (
    enabled: boolean,
    row: DingtalkAppConfig,
  ) => Promise<boolean>,
): VxeTableGridColumns<DingtalkAppConfig> {
  return [
    {
      field: 'app_key',
      sortable: true,
      fixed: 'left',
      title: 'AppKey',
      width: 190,
    },
    {
      field: 'app_name',
      sortable: true,
      minWidth: 260,
      slots: { default: 'dingtalkNameCell' },
      title: '应用名称',
    },
    {
      cellRender: { name: 'CellTag', options: boolTagOptions },
      field: 'is_def',
      sortable: true,
      title: '默认',
      width: 90,
    },
    {
      cellRender: { name: 'CellTag', options: boolTagOptions },
      field: 'credentials_configured',
      title: '凭据已配置',
      width: 120,
    },
    {
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
    { field: 'remark', minWidth: 220, title: '备注' },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 80,
    },
  ];
}

export function useWechatColumns(
  onEnabledChange: (enabled: boolean, row: WechatAppConfig) => Promise<boolean>,
): VxeTableGridColumns<WechatAppConfig> {
  return [
    {
      field: 'app_id',
      sortable: true,
      fixed: 'left',
      title: 'AppID',
      width: 190,
    },
    {
      field: 'app_name',
      sortable: true,
      minWidth: 260,
      slots: { default: 'wechatNameCell' },
      title: '应用名称',
    },
    { field: 'app_key', minWidth: 170, title: '业务应用键' },
    { field: 'company', minWidth: 170, title: '公司名称' },
    {
      cellRender: { name: 'CellTag', options: boolTagOptions },
      field: 'credentials_configured',
      title: '凭据已配置',
      width: 120,
    },
    {
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
  ];
}
