import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { DataSourceView, DataSourceWrite } from '#/api/system';

const typeOptions = [
  { label: 'PostgreSQL', value: 'postgres' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'Databend', value: 'databend' },
];

export function writeValues(
  row?: DataSourceWrite | Partial<DataSourceView>,
): DataSourceWrite {
  return {
    ds_code: row?.ds_code ?? '',
    name: row?.name ?? '',
    db_type:
      row?.db_type === 'postgresql' ? 'postgres' : (row?.db_type ?? 'postgres'),
    db_host: row?.db_host ?? '',
    port: row?.port ?? 0,
    db_name: row?.db_name ?? '',
    user_name: row?.user_name ?? '',
    credential_code: row?.credential_code ?? '',
    cur_schema: row?.cur_schema ?? '',
    time_zone: row?.time_zone ?? '',
    state: row?.state ?? true,
    remark: row?.remark ?? '',
  };
}

export function useSearchSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'keyword', label: '编码 / 名称 / 主机' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '启用', value: true },
          { label: '停用', value: false },
        ],
      },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useFormSchema(editing: boolean): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { disabled: editing },
      fieldName: 'ds_code',
      label: '数据源编码',
      rules: 'required',
    },
    { component: 'Input', fieldName: 'name', label: '名称', rules: 'required' },
    {
      component: 'Select',
      componentProps: { options: typeOptions },
      fieldName: 'db_type',
      label: '数据库类型',
      rules: 'required',
    },
    { component: 'Input', fieldName: 'db_host', label: '主机 / SQLite 路径' },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        min: 0,
        max: 65_535,
        placeholder: '0 使用默认端口；Databend 默认 8000，Cloud 通常 443',
      },
      fieldName: 'port',
      label: '端口',
    },
    { component: 'Input', fieldName: 'db_name', label: '数据库名' },
    { component: 'Input', fieldName: 'user_name', label: '用户名' },
    {
      component: 'CredentialSelect',
      componentProps: {
        kind: 'password',
        profile: 'generic',
        createKind: 'password',
        placeholder: '选择数据库密码凭证',
      },
      fieldName: 'credential_code',
      label: '密码凭证',
    },
    { component: 'Input', fieldName: 'cur_schema', label: 'Schema' },
    { component: 'Input', fieldName: 'time_zone', label: '时区' },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'state',
      label: '启用',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { minRows: 3, maxRows: 6 } },
      formItemClass: 'md:col-span-2',
      fieldName: 'remark',
      label: '备注',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<DataSourceView> {
  return [
    { field: 'ds_code', fixed: 'left', title: '编码', width: 160 },
    { field: 'name', minWidth: 180, title: '名称' },
    { field: 'db_type', title: '类型', width: 120 },
    { field: 'db_host', minWidth: 180, title: '主机' },
    { field: 'db_name', minWidth: 150, title: '数据库' },
    { field: 'user_name', title: '用户名', width: 130 },
    {
      field: 'credential_configured',
      title: '密码凭证',
      width: 110,
      slots: { default: 'credential_configured' },
    },
    { field: 'state', title: '状态', width: 90, slots: { default: 'state' } },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}
