import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { UploadFile } from '#/api';

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name_prefix', label: '文件名' },
    { component: 'Input', fieldName: 'storage_code', label: '存储配置' },
    { component: 'Input', fieldName: 'md5_hash', label: 'MD5' },
  ];
}

export function useColumns(): VxeTableGridColumns<UploadFile> {
  return [
    {
      field: 'file_id',
      sortable: true,
      fixed: 'left',
      title: '文件 ID',
      width: 100,
    },
    {
      field: 'file_name',
      sortable: true,
      minWidth: 260,
      slots: { default: 'fileNameCell' },
      title: '文件名',
    },
    { field: 'file_ext', title: '扩展名', width: 90 },
    { field: 'storage_code', title: '存储配置', width: 150 },
    { field: 'storage_type', title: '类型', width: 100 },
    {
      field: 'size',
      slots: { default: 'sizeCell' },
      sortable: true,
      title: '大小',
      width: 120,
    },
    {
      field: 'md5_hash',
      minWidth: 260,
      slots: { default: 'md5Cell' },
      title: 'MD5',
    },
  ];
}
