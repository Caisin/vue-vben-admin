import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
export interface DeliveryUploadJob {
  id: string;
  scope: number;
  version: number;
  kind: string;
  seq: number;
  status: string;
  concurrency: number;
  revision: number;
  files: {
    name: string;
    relative_path?: string;
    size: number;
    bytes: number;
    status: string;
    error: string;
    file_id: null | number;
  }[];
}
export const nativeDelivery = {
  pick: (
    scope: number,
    version: number,
    kind: string,
    seq: number,
    multiple = true,
    directory = false,
  ) =>
    invoke<DeliveryUploadJob | null>('delivery_upload_pick', {
      scope,
      version,
      kind,
      seq,
      multiple,
      directory,
    }),
  update: (
    id: string,
    expectedRevision: number,
    indices: number[],
    concurrency: number,
  ) =>
    invoke<DeliveryUploadJob>('delivery_upload_update', {
      id,
      expectedRevision,
      indices,
      concurrency,
    }),
  run: (id: string, expectedRevision: number) =>
    invoke<DeliveryUploadJob>('delivery_upload_run', { id, expectedRevision }),
  jobs: () => invoke<DeliveryUploadJob[]>('delivery_upload_jobs'),
  pause: () => invoke('delivery_upload_pause'),
  listen: (fn: (job: DeliveryUploadJob) => void) =>
    listen<DeliveryUploadJob>('delivery-upload-updated', ({ payload }) =>
      fn(payload),
    ),
};
