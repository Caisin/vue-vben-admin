import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { FileGroup } from '#/api/storage/group';

import { Times } from '#/times';

export function useColumns(
  onActionClick: OnActionClickFn<FileGroup>,
): VxeTableGridColumns<FileGroup> {
  return [
    { field: 'id', sortable: true, title: 'ID', width: 90 },
    {
      field: 'group_code',
      sortable: true,
      fixed: 'left',
      title: '分组编码',
      width: 190,
    },
    {
      field: 'group_name',
      minWidth: 220,
      slots: { default: 'nameCell' },
      title: '分组名称',
    },
    { field: 'order_no', sortable: true, title: '排序', width: 100 },
    {
      field: 'create_time',
      formatter: ({ row }) => Times.formatUnix(row.create_time),
      sortable: true,
      title: '创建时间',
      width: 180,
    },
    {
      align: 'right',
      cellRender: {
        attrs: { nameField: 'group_name', onClick: onActionClick },
        name: 'CellOperation',
        options: ['delete'],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 100,
    },
  ];
}
