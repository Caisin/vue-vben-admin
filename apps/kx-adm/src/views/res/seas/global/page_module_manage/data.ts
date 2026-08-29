import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export function useGroupColumns(): VxeTableGridColumns {
  return [
    {
      field: 'group_code',
      fixed: 'left',
      slots: { default: 'groupCode' },
      title: '模块编码',
      width: 160,
    },
    { field: 'title', minWidth: 200, title: '标题' },
    { field: 'show_type', title: '展示类型', width: 130 },
    { field: 'sort_no', title: '排序', width: 90 },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 90,
    },
    { field: 'description', minWidth: 220, title: '描述' },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}

export function useItemColumns(): VxeTableGridColumns {
  return [
    { field: 'sort', slots: { default: 'sort' }, title: '排序', width: 110 },
    { field: 'cover', slots: { default: 'cover' }, title: '封面', width: 90 },
    { field: 'res_id', title: '资源 ID', width: 100 },
    { field: 'title', minWidth: 180, title: '标题' },
    {
      field: 'state',
      slots: { default: 'itemState' },
      title: '状态',
      width: 90,
    },
    {
      align: 'right',
      field: 'operation',
      slots: { default: 'itemOperation' },
      title: '操作',
      width: 80,
    },
  ];
}
