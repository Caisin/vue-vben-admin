import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { UploadFile, UploadFileKind } from '#/api/storage';

export const uploadModeOptions = [
  { label: '本地直传', value: 'direct' },
  { label: '服务端上传', value: 'serve' },
];

export const fileKindOptions: Array<{
  label: string;
  value: 'all' | UploadFileKind;
}> = [
  { label: '全部类型', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '其它文件', value: 'file' },
];

export const filePickerColumns: VxeTableGridColumns<UploadFile> = [
  { field: 'file_name', slots: { default: 'fileName' }, title: '文件名' },
  {
    field: 'storage_code',
    title: 'Storage',
    width: 130,
  },
  {
    field: 'size',
    slots: { default: 'size' },
    title: '大小',
    width: 110,
  },
  { field: 'actions', slots: { default: 'actions' }, title: '', width: 48 },
];

export function formatFileSize(value: number | string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
}
