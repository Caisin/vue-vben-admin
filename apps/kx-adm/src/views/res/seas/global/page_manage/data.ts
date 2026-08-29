import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '页面编码或名称' },
      fieldName: 'keyword',
      label: '关键字',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'page_code',
      fixed: 'left',
      slots: { default: 'pageCode' },
      title: '页面编码',
      width: 180,
    },
    { field: 'page_name', minWidth: 220, title: '页面名称' },
    { field: 'remark', minWidth: 220, title: '备注' },
    {
      field: 'created_at',
      slots: { default: 'createdAt' },
      title: '创建时间',
      width: 180,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 260,
    },
  ];
}
