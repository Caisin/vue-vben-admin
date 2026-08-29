import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MallCategory } from '#/api/mall';

import { Times } from '#/times';

import { mallStatusOptions, mallStatusSelectOptions } from '../shared';

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'keyword', label: '类目名称/编码' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: mallStatusSelectOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<MallCategory>,
): VxeTableGridColumns<MallCategory> {
  return [
    {
      field: 'name',
      fixed: 'left',
      minWidth: 220,
      slots: { default: 'nameCell' },
      title: '类目名称',
      treeNode: true,
    },
    { field: 'code', minWidth: 150, title: '类目编码' },
    {
      cellRender: { name: 'CellTag', options: mallStatusOptions },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'sort_order', sortable: true, title: '排序', width: 90 },
    { field: 'icon_file_id', title: '图标文件 ID', width: 130 },
    {
      field: 'updated_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.updated_at),
      title: '更新时间',
      width: 180,
    },
    {
      align: 'right',
      cellRender: {
        attrs: { nameField: 'name', onClick: onActionClick },
        name: 'CellOperation',
        options: [
          { auth: 'mall:category:write', code: 'append', text: '新增下级' },
          { auth: 'mall:category:write', code: 'edit', text: '编辑' },
          {
            auth: 'mall:category:write',
            code: 'delete',
            danger: true,
            text: '删除',
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 190,
    },
  ];
}
