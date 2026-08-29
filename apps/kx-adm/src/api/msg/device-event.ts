import type {
  DeviceEvent,
  DeviceEventDetail,
  DeviceEventFilterOptions,
  ListParams,
  PageResult,
} from './types';

import { requestClient } from '#/api/request';

export const DeviceEventApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<DeviceEvent>>('/msg/device-events', {
      params,
    }),
  filterOptions: () =>
    requestClient.get<DeviceEventFilterOptions>(
      '/msg/device-events/filter-options',
    ),
  detail: (eventId: number) =>
    requestClient.get<DeviceEventDetail>(`/msg/device-events/${eventId}`),
};
