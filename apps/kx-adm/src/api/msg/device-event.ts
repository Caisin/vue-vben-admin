import type {
  DeviceEvent,
  DeviceEventDetail,
  DeviceEventFilterOptions,
  ListParams,
  PageResult,
} from './types';

import type { TaskRun } from '#/api/task/run';

import { requestClient } from '#/api/request';

export interface EventCleanupRequest {
  all_time: boolean;
  start_at: null | number;
  end_at: null | number;
  normal_queries_only: boolean;
}

export const DeviceEventApi = {
  cleanup: (data: EventCleanupRequest) =>
    requestClient.post<TaskRun>('/msg/device-events/cleanup', data),
  cleanupStatus: (id: number | string) =>
    requestClient.get<TaskRun>(`/msg/device-events/cleanup/${id}`),
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
