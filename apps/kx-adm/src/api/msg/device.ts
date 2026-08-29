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

export class DeviceLocateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceLocateError';
  }
}

export interface DeviceHttpAccess {
  api_token: string;
  base_url: string;
  device_code: string;
}

export interface DeviceHttpCommandResponse {
  [key: string]: unknown;
  message?: string;
}

function deviceCommandUrl(baseUrl: string) {
  const value = baseUrl.trim();
  if (!value)
    throw new DeviceLocateError('设备 HTTP 地址为空，请先刷新设备信息');
  try {
    const normalized = value.endsWith('/') ? value : `${value}/`;
    const url = new URL('api/cmd', normalized);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new DeviceLocateError('设备 HTTP 地址必须使用 http 或 https');
    }
    return url.href;
  } catch (error) {
    if (error instanceof DeviceLocateError) throw error;
    throw new DeviceLocateError('设备 HTTP 地址无效，请先刷新设备信息');
  }
}

async function parseDeviceCommandResponse(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    throw new DeviceLocateError(
      text.trim() || `设备 HTTP 命令失败：${response.status}`,
    );
  }
  if (!text.trim()) return {} satisfies DeviceHttpCommandResponse;
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as DeviceHttpCommandResponse;
    }
  } catch {
    // 部分固件可能返回纯文本成功信息，保留为 message 展示。
  }
  return { message: text.trim() } satisfies DeviceHttpCommandResponse;
}

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
    requestClient.post<{ operation_id: number; status: string }>(
      `/msg/devices/${deviceCode}/actions/${command}`,
    ),
  updateConfig: (
    deviceCode: string,
    _kind: DeviceConfigKind,
    payload: unknown,
  ) =>
    requestClient.post<{ operation_id: number; status: string }>(
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
    requestClient.post<{ operation_id: number; status: string }>(
      `/msg/devices/${deviceCode}/actions/locate`,
    ),
  httpAccess: (deviceCode: string) =>
    requestClient.get<DeviceHttpAccess>(
      `/msg/devices/${deviceCode}/http-access`,
    ),
  locateByHttp: async (deviceCode: string) => {
    const data = await DeviceApi.httpAccess(deviceCode);
    return fetch(deviceCommandUrl(data.base_url), {
      body: '定位设备',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${data.api_token}`,
        'Content-Type': 'text/plain',
      },
      method: 'POST',
    })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new DeviceLocateError(`浏览器直连设备失败：${message}`);
      })
      .then(parseDeviceCommandResponse);
  },
};
