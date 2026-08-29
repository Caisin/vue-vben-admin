import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { StorageConfigView } from '#/api/storage/config';

interface SelectOption {
  label: string;
  value: string;
}

export function useFormSchema(
  getStorageTypeOptions: () => SelectOption[],
): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '配置编码' },
    { component: 'Input', fieldName: 'name_prefix', label: '配置名称' },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        class: 'w-full',
        options: getStorageTypeOptions(),
      }),
      fieldName: 'storage_type',
      label: '存储类型',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<StorageConfigView> {
  return [
    {
      field: 'code',
      sortable: true,
      fixed: 'left',
      title: '配置编码',
      width: 160,
    },
    {
      field: 'storage_name',
      minWidth: 190,
      slots: { default: 'nameCell' },
      title: '配置名称',
    },
    {
      field: 'storage_type',
      slots: { default: 'typeCell' },
      title: '存储类型',
      width: 150,
    },
    { field: 'root', minWidth: 180, title: '根目录' },
    { field: 'bucket', minWidth: 160, title: 'Bucket' },
    { field: 'region', title: 'Region', width: 130 },
    { field: 'endpoint', minWidth: 220, title: 'Endpoint' },
    {
      field: 'is_public',
      slots: { default: 'publicCell' },
      title: '公开',
      width: 90,
    },
    {
      field: 'credential_code',
      slots: { default: 'credentialCell' },
      title: '凭据',
      width: 190,
    },
    { field: 'order_no', sortable: true, title: '排序', width: 90 },
  ];
}
