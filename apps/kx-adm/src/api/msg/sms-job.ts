import type { ListParams, PageResult, SmsJob } from './types';

import { requestClient } from '#/api/request';

export const SmsJobApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<SmsJob>>('/msg/sms-jobs', { params }),
  detail: (jobKey: string) =>
    requestClient.get<SmsJob>(`/msg/sms-jobs/${jobKey}`),
  retry: (jobKey: string) =>
    requestClient.post<SmsJob>(`/msg/sms-jobs/${jobKey}/actions/retry`),
};
