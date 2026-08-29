import type {
  ListParams,
  PageResult,
  SmsMessage,
  SmsReprocessResult,
} from './types';

import { requestClient } from '#/api/request';

export interface SmsReprocessSelectedRequest {
  dedupe_keys: string[];
}

export const SmsMessageApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<SmsMessage>>('/msg/sms-messages', {
      params,
    }),
  reprocessBusinessData: () =>
    requestClient.post<{ status: string }>(
      '/msg/sms-messages/actions/reprocess-business-data',
    ),
  reprocessOne: (dedupeKey: string) =>
    requestClient.post<SmsReprocessResult>(
      `/msg/sms-messages/${encodeURIComponent(dedupeKey)}/actions/reprocess-business-data`,
    ),
  reprocessSelected: (data: SmsReprocessSelectedRequest) =>
    requestClient.post<{ status: string }>(
      '/msg/sms-messages/actions/reprocess-business-data-selected',
      data,
    ),
};
