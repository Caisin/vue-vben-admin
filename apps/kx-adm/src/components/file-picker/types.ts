import type { StorageFileReference } from './file-ref';

import type { Page } from '#/api/request';
import type {
  FileUploadView,
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
}

export interface FilePickerAdapter {
  convertRemote?: (url: string) => Promise<FileUploadView>;
  detail?: (id: FileId) => Promise<UploadFile>;
  list: (params?: UploadFilePageQuery) => Promise<Page<UploadFile>>;
  storageOptions?: () => Promise<Array<{ label: string; value: string }>>;
  upload: (file: File) => Promise<FileUploadView[]>;
}

export interface SelectedStorageFile extends StorageFileReference {
  file: UploadFile;
  preview_url?: string;
}

export interface FilePickerExpose {
  close: () => void;
  open: () => void;
}
