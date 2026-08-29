import type { RequestResponse } from '@vben/request';

import type { CallRecord, PageResult } from './types';

import { requestClient } from '#/api/request';

export interface CallListQuery {
  call_state?: string;
  device_code?: string;
  local_number_prefix?: string;
  page?: number;
  peer_number_prefix?: string;
  received_between?: [number, number];
  sim_iccid?: string;
  size?: number;
  sort?: string;
}

export interface CallRecordingDownload {
  blob: Blob;
  file_name?: string;
}

function contentDispositionFileName(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const utf8Name = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  const plainName = /filename="([^"]+)"/i.exec(value)?.[1];
  const encodedName = utf8Name || plainName;
  if (!encodedName) return undefined;
  try {
    return decodeURIComponent(encodedName).split(/[\\/]/).pop();
  } catch {
    return encodedName.split(/[\\/]/).pop();
  }
}

export const CallApi = {
  list: (params: CallListQuery = {}) =>
    requestClient.get<PageResult<CallRecord>>('/msg/calls', { params }),
  downloadRecording: async (
    dedupeKey: string,
  ): Promise<CallRecordingDownload> => {
    const response = await requestClient.download<RequestResponse<Blob>>(
      `/msg/calls/${encodeURIComponent(dedupeKey)}/recording`,
      { responseReturn: 'raw' },
    );
    return {
      blob: response.data,
      file_name: contentDispositionFileName(
        response.headers['content-disposition'],
      ),
    };
  },
};
