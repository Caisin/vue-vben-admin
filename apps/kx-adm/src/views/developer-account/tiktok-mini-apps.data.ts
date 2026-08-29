import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  TikTokMiniApp,
  TikTokMiniAppWhitelist,
} from '#/api/developer-account';

export function miniAppSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: '小程序名称或 client key' },
      fieldName: 'keyword',
      label: '小程序',
    },
  ];
}

export function miniAppColumns(): VxeTableGridColumns<TikTokMiniApp> {
  return [
    { field: 'name', minWidth: 180, title: '小程序名称' },
    { field: 'client_key', minWidth: 220, title: 'Client Key（主键）' },
    {
      align: 'center',
      field: 'whitelist_count',
      slots: { default: 'whitelistCount' },
      title: '加白账号',
      width: 110,
    },
    { field: 'remark', minWidth: 180, title: '备注' },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 150,
    },
  ];
}

export function whitelistSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: '账号、小程序、集团或国家' },
      fieldName: 'keyword',
      label: '关键字',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '例如：完成' },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function whitelistColumns(): VxeTableGridColumns<TikTokMiniAppWhitelist> {
  return [
    { field: 'customer_group', minWidth: 210, title: '客户集团名' },
    { field: 'user_id', minWidth: 190, title: '达人账号 User ID' },
    { field: 'country', minWidth: 110, title: '达人国家' },
    {
      field: 'username',
      formatter: ({ cellValue }) => `@${cellValue}`,
      minWidth: 150,
      title: '账号名',
    },
    { field: 'mini_app_name', minWidth: 160, title: '需加白的 Minis' },
    { field: 'client_key', minWidth: 220, title: 'Client Key' },
    {
      field: 'submitted',
      formatter: ({ cellValue }) => (cellValue ? '是' : '否'),
      title: '是否提交',
      width: 100,
    },
    { field: 'status', minWidth: 100, title: '状态' },
  ];
}
