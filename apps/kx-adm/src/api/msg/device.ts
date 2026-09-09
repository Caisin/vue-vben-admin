import type {
  Device,
  DeviceEvent,
  DeviceEventDetail,
  DeviceFilterOptions,
  DeviceOperation,
  DeviceOperationDetail,
  DeviceOtaBatchRequest,
  DeviceSlotView,
  DeviceVoiceForwardConfigSyncRequest,
  ListParams,
  PageResult,
} from './types';

import { requestClient } from '#/api/request';

export type DeviceCommand =
  | 'refresh-card-status'
  | 'refresh-forward-config'
  | 'refresh-info'
  | 'refresh-mqtt-config'
  | 'refresh-system-config'
  | 'restart';

export type DeviceConfigKind =
  | 'forward_config'
  | 'mqtt_config'
  | 'system_config';

function eventToOperation(event: DeviceEvent): DeviceOperation {
  return {
    command: event.event_kind,
    created_at: event.received_at,
    device_code: event.device_code,
    error_message: event.error_message,
    finished_at: event.processed_at,
    id: event.id,
    status: event.process_status,
  };
}

export const DeviceApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<Device>>('/msg/devices', { params }),
  filterOptions: () =>
    requestClient.get<DeviceFilterOptions>('/msg/devices/filter-options'),
  detail: (deviceCode: string) =>
    requestClient.get<Device>(`/msg/devices/${deviceCode}`),
  slots: (deviceCode: string) =>
    requestClient.get<DeviceSlotView[]>(`/msg/devices/${deviceCode}/slots`),
  operations: async (deviceCode: string, params: ListParams = {}) => {
    const result = await requestClient.get<PageResult<DeviceEvent>>(
      '/msg/device-events',
      { params: { ...params, device_code: deviceCode } },
    );
    return {
      ...result,
      items: result.items.map((event) => eventToOperation(event)),
    } satisfies PageResult<DeviceOperation>;
  },
  operationDetail: async (_deviceCode: string, operationId: number) => {
    const event = await requestClient.get<DeviceEventDetail>(
      `/msg/device-events/${operationId}`,
    );
    return {
      ...eventToOperation(event),
      mqtt_payload: event.payload_json,
      mqtt_topic: event.mqtt_topic,
    } satisfies DeviceOperationDetail;
  },
  sendCommand: (deviceCode: string, command: DeviceCommand) =>
    requestClient.post<{ operation_id: null | number; status: string }>(
      `/msg/devices/${deviceCode}/actions/${command}`,
    ),
  updateConfig: (
    deviceCode: string,
    _kind: DeviceConfigKind,
    payload: unknown,
  ) =>
    requestClient.post<{ operation_id: null | number; status: string }>(
      `/msg/devices/${deviceCode}/actions/update-config`,
      payload,
    ),
  refreshAll: () =>
    requestClient.post<{ status: string }>('/msg/devices/actions/refresh'),
  refreshInfo: () =>
    requestClient.post<{ status: string }>('/msg/devices/actions/refresh-info'),
  refreshCardStatus: () =>
    requestClient.post<{ status: string }>(
      '/msg/devices/actions/refresh-card-status',
    ),
  refreshSystemConfigAll: () =>
    requestClient.post<{ status: string }>(
      '/msg/devices/actions/refresh-system-config',
    ),
  batchOta: (data: DeviceOtaBatchRequest) =>
    requestClient.post<{ status: string }>('/msg/devices/actions/ota', data),
  syncVoiceForwardConfig: (data?: DeviceVoiceForwardConfigSyncRequest) =>
    requestClient.post<{ status: string }>(
      '/msg/devices/actions/sync-voice-forward-config',
      data ?? { online_only: true },
    ),
  refreshSystemConfig: (deviceCode: string) =>
    requestClient.post<{ status: string }>(
      `/msg/devices/${deviceCode}/actions/refresh-system-config`,
    ),
  sync: (deviceCode: string) =>
    requestClient.post<{ status: string }>(
      `/msg/devices/${deviceCode}/actions/refresh-card-status`,
    ),
  locate: (deviceCode: string) =>
    requestClient.post<{ operation_id: null | number; status: string }>(
      `/msg/devices/${deviceCode}/actions/locate`,
    ),
};
