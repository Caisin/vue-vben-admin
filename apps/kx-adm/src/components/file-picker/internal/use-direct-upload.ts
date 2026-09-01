import type { UploadProps } from 'antdv-next';

import type { Ref } from 'vue';

import type { FileId } from '../types';

import type { FileUploadView } from '#/api/storage';
import type {
  PresignedUploadCompleteWrite,
  PresignedUploadPrepareView,
  PresignedUploadPrepareWrite,
} from '#/api/storage/file';

import { computed, ref } from 'vue';

import { message, notification } from 'antdv-next';

import { StorageFileApi } from '#/api/storage';

import { acceptsBrowserFile } from '../file-type';
import { md5File } from './md5';
import {
  objectStorageErrorMessage,
  objectStorageNetworkErrorMessage,
  uploadErrorMessage,
} from './upload-error';

interface DirectUploadOptions {
  accept: () => string | string[] | undefined;
  active_group_id: Ref<FileId | undefined>;
  active_storage_code: Ref<string | undefined>;
  addUploaded: (files: FileUploadView[]) => Promise<void>;
  presignComplete?: (
    data: PresignedUploadCompleteWrite,
  ) => Promise<FileUploadView>;
  presignUpload?: (
    data: PresignedUploadPrepareWrite,
  ) => Promise<PresignedUploadPrepareView>;
  reload: () => Promise<void>;
}

function relativePathOf(file: File) {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  );
}

function uploadFileName(file: File) {
  const relativePath = relativePathOf(file);
  return (
    relativePath.split(/[\\/]/).findLast((segment) => segment.length > 0) ||
    file.name
  );
}

function uploadFileExt(file: File) {
  const fileName = uploadFileName(file);
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function putPresignedObject(
  presigned: {
    headers: Record<string, string>;
    method: string;
    upload_url: string;
  },
  file: File,
  onProgress: (percent: number) => void,
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(presigned.method || 'PUT', presigned.upload_url, true);
    for (const [name, value] of Object.entries(presigned.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable)
        onProgress((event.loaded / event.total) * 100);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag') ?? undefined);
      } else {
        reject(
          new Error(
            xhr.status === 0
              ? objectStorageNetworkErrorMessage(presigned.upload_url)
              : objectStorageErrorMessage(
                  xhr.status,
                  xhr.statusText,
                  xhr.responseText,
                ),
          ),
        );
      }
    });
    xhr.addEventListener('error', () =>
      reject(new Error(objectStorageNetworkErrorMessage(presigned.upload_url))),
    );
    xhr.addEventListener('abort', () =>
      reject(new Error('直传对象存储已取消')),
    );
    xhr.send(file);
  });
}

export function useDirectUpload(options: DirectUploadOptions) {
  const visible = ref(false);
  const total = ref(0);
  const done = ref(0);
  const running = ref(0);
  const current_percent = ref(0);
  const current_name = ref('');

  const percent = computed(() => {
    const safeTotal = Math.max(total.value, 1);
    const current = Math.min(Math.max(current_percent.value, 0), 100);
    return Math.min(
      100,
      Math.floor(((done.value + current / 100) / safeTotal) * 100),
    );
  });

  function handleFolderChange(info: { fileList?: unknown[] }) {
    if (Array.isArray(info.fileList))
      total.value = Math.max(total.value, info.fileList.length);
  }

  function begin(file: File) {
    visible.value = true;
    running.value += 1;
    total.value = Math.max(total.value, done.value + running.value);
    current_name.value = relativePathOf(file);
    current_percent.value = 0;
  }

  function finish() {
    done.value += 1;
    running.value = Math.max(0, running.value - 1);
    current_percent.value = 0;
    if (running.value === 0 && done.value >= total.value) {
      window.setTimeout(() => {
        visible.value = false;
        total.value = 0;
        done.value = 0;
        current_percent.value = 0;
        current_name.value = '';
      }, 800);
    }
  }

  async function uploadWithPresignedUrl(
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<FileUploadView> {
    const storageCode = options.active_storage_code.value;
    if (!storageCode) throw new Error('请选择 storage');
    const fileName = uploadFileName(file);
    const fileExt = uploadFileExt(file);
    const groupId = options.active_group_id.value;
    onProgress(1);
    const md5Hash = await md5File(file);
    onProgress(5);
    const prepare =
      options.presignUpload ??
      ((data: PresignedUploadPrepareWrite) =>
        StorageFileApi.presignUpload(storageCode, data));
    const complete =
      options.presignComplete ??
      ((data: PresignedUploadCompleteWrite) =>
        StorageFileApi.presignComplete(storageCode, data));
    const presigned = await prepare({
      file_ext: fileExt,
      file_name: fileName,
      group_id: groupId,
      md5_hash: md5Hash,
      size: file.size,
    });
    if (!presigned.upload_required) {
      if (!presigned.file) throw new Error('直传秒传响应缺少文件信息');
      onProgress(100);
      return presigned.file;
    }
    const etag = await putPresignedObject(presigned, file, (value) =>
      onProgress(5 + value * 0.9),
    );
    return await complete({
      etag,
      file_ext: fileExt,
      file_name: fileName,
      group_id: groupId,
      key: presigned.key,
      md5_hash: md5Hash,
      size: file.size,
    });
  }

  async function uploadFile(file: File, onProgress: (percent: number) => void) {
    if (!acceptsBrowserFile(file, options.accept())) {
      throw new Error('文件类型不符合当前选择限制');
    }
    begin(file);
    try {
      const result = await uploadWithPresignedUrl(file, onProgress);
      await options.addUploaded([result]);
      finish();
      message.success('本地直传成功');
      await options.reload();
      return result;
    } catch (error) {
      finish();
      throw error;
    }
  }

  const request: NonNullable<UploadProps['customRequest']> = async (
    requestOptions,
  ) => {
    if (typeof requestOptions.file === 'string') {
      requestOptions.onError?.(new Error('请选择文件'));
      return;
    }
    try {
      const result = await uploadFile(requestOptions.file as File, (value) => {
        current_percent.value = Math.min(Math.max(value, 0), 100);
        requestOptions.onProgress?.({ percent: value });
      });
      requestOptions.onSuccess?.(result);
    } catch (error) {
      const detail = uploadErrorMessage(error);
      const normalized = error instanceof Error ? error : new Error(detail);
      notification.error({
        description: `${detail}；不支持直传的 storage 请切换服务端上传`,
        duration: 0,
        title: `本地直传失败：${relativePathOf(requestOptions.file as File)}`,
      });
      requestOptions.onError?.(normalized);
    }
  };

  async function uploadFiles(files: File[]) {
    for (const file of files) {
      await uploadFile(file, (value) => {
        current_percent.value = Math.min(Math.max(value, 0), 100);
      });
    }
  }

  return {
    current_name,
    done,
    handleFolderChange,
    percent,
    request,
    total,
    uploadFiles,
    visible,
  };
}
