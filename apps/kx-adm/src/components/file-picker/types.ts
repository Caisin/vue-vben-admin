import type { StorageFileReference } from './file-ref';

import type { Page } from '#/api/request';
import type {
  FileAccessView,
  FileUploadView,
  PresignedUploadCompleteWrite,
  PresignedUploadPrepareView,
  PresignedUploadPrepareWrite,
  RenameFileWrite,
  UploadFile,
  UploadFilePageQuery,
} from '#/api/storage';

export type FileId = number | string;

export interface FilePickerProps {
  accept?: string | string[];
  adapter?: FilePickerAdapter;
  group_id?: FileId;
  initial_file_ids?: FileId[];
  max_count?: number;
  multiple?: boolean;
  storage_code?: string;
  storage_locked?: boolean;
}

export interface FilePickerAdapter {
  convertRemote?: (url: string) => Promise<FileUploadView>;
  detail?: (id: FileId) => Promise<UploadFile>;
  list: (params?: UploadFilePageQuery) => Promise<Page<UploadFile>>;
  presignComplete?: (
    data: PresignedUploadCompleteWrite,
  ) => Promise<FileUploadView>;
  presignUpload?: (
    data: PresignedUploadPrepareWrite,
  ) => Promise<PresignedUploadPrepareView>;
  rename?: (id: FileId, data: RenameFileWrite) => Promise<UploadFile>;
  storageOptions?: () => Promise<
    Array<{ label: string; storage_type?: string; value: string }>
  >;
  upload: (file: File) => Promise<FileUploadView[]>;
  urls?: (ids: FileId[]) => Promise<FileAccessView[]>;
}

export interface SelectedStorageFile extends StorageFileReference {
  file: UploadFile;
  preview_url?: string;
}

export interface FilePickerExpose {
  close: () => void;
  open: () => void;
}
