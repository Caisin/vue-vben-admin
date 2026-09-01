import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { FileShareView } from '#/api/storage';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '输入文件名关键词' },
      fieldName: 'keyword',
      label: '文件名',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '有效', value: 'active' },
          { label: '已过期', value: 'expired' },
        ],
      },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<FileShareView> {
  return [
    {
      field: 'file_name',
      fixed: 'left',
      minWidth: 300,
      slots: { default: 'fileNameCell' },
      sortable: true,
      title: '分享内容',
    },
    {
      field: 'expired',
      slots: { default: 'statusCell' },
      title: '状态',
      width: 100,
    },
    {
      field: 'view_count',
      minWidth: 310,
      slots: { default: 'usageCell' },
      sortable: true,
      title: '访问 / 下载',
    },
    {
      field: 'expires_at',
      minWidth: 340,
      slots: { default: 'expiryCell' },
      sortable: true,
      title: '过期时间',
    },
    {
      field: 'share_url',
      minWidth: 290,
      slots: { default: 'shareUrlCell' },
      title: '分享链接',
    },
    {
      field: 'total_size',
      slots: { default: 'sizeCell' },
      title: '大小',
      width: 110,
    },
    { field: 'sharer', title: '分享人', width: 130 },
    {
      field: 'created_at',
      slots: { default: 'createdAtCell' },
      sortable: true,
      title: '创建时间',
      width: 180,
    },
  ];
}
