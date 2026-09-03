import type {
  DeviceSlot,
  ListParams,
  PageResult,
  SimCard,
  SimCardFilterOptions,
  SimCardView,
  SimLocationHistory,
  SmsMessage,
} from './types';

import type { TaskRun } from '#/api/task';

import { plaintextRequestClient, requestClient } from '#/api/request';

export interface BatchSmsRequest {
  content: string;
  requested_by?: string;
  sender_carrier?: string;
  sender_iccids?: string[];
  target_number: string;
}

export interface SendSmsRequest {
  content: string;
  idempotency_key: string;
  target_number: string;
}

export interface DiscoverPhoneNumberRequest {
  overwrite_known?: boolean;
  receiver_phone_number: string;
  requested_by?: string;
}

export interface BatchDiscoverPhoneNumbersRequest {
  only_unknown?: boolean;
  receiver_phone_number: string;
  requested_by?: string;
  target_iccids?: string[];
}

export interface UpdateDeviceCardRequest {
  call: string;
  lock_carrier: string;
  note: string;
  number: string;
}

export interface UpdateSimBalanceRequest {
  balance: string;
  balance_currency: string;
}

export interface UpdateSimExpiryRequest {
  expires_at: number;
}

export interface UpdateSimProfileRequest {
  apple_developer_registered?: boolean;
  lifecycle_state?: string;
  management_note: string;
  ownership: string;
  phone_number?: string;
  real_name: string;
}

export interface SimRealNameImportItem {
  error_message: string;
  iccid: string;
  id: number;
  phone_number: string;
  raw_phone_number: string;
  real_name: string;
  ownership: string;
  row_number: number;
  status: string;
}

export interface SimRealNameImport {
  created_at: number;
  created_by: number;
  failed_count: number;
  file_name: string;
  finished_at?: null | number;
  id: number;
  items: SimRealNameImportItem[];
  skipped_count: number;
  status: string;
  succeeded_count: number;
  task_run_id?: null | number;
  total_count: number;
  updated_at: number;
}

export const SimCardApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<SimCardView>>('/msg/sim-cards', { params }),
  filterOptions: () =>
    requestClient.get<SimCardFilterOptions>('/msg/sim-cards/filter-options'),
  lookup: (q: string) =>
    requestClient.get<SimCard[]>('/msg/sim-cards/lookup', {
      params: { q },
    }),
  createRealNameImport: (file: File) =>
    plaintextRequestClient.upload<SimRealNameImport>(
      '/msg/sim-cards/real-name-imports',
      { file },
    ),
  realNameImportTemplate: () =>
    plaintextRequestClient.download<Blob>(
      '/msg/sim-cards/real-name-imports/template',
    ),
  realNameImportDetail: (id: number | string) =>
    requestClient.get<SimRealNameImport>(
      `/msg/sim-cards/real-name-imports/${id}`,
    ),
  realNameImportResult: (id: number | string) =>
    plaintextRequestClient.download<Blob>(
      `/msg/sim-cards/real-name-imports/${id}/result`,
    ),
  repairPhoneNumbers: () =>
    requestClient.post<{ status: string }>(
      '/msg/sim-cards/actions/repair-phone-numbers',
    ),
  refreshBalances: () =>
    requestClient.post<TaskRun>('/msg/sim-cards/actions/refresh-balances'),
  refreshBalance: (iccid: string) =>
    requestClient.post<{ job_key: string; status: string }>(
      `/msg/sim-cards/${iccid}/actions/refresh-balance`,
    ),
  discoverPhoneNumber: (iccid: string, data: DiscoverPhoneNumberRequest) =>
    requestClient.post<{ job_key: string; status: string }>(
      `/msg/sim-cards/${iccid}/actions/discover-phone-number`,
      data,
    ),
  discoverPhoneNumbers: (data: BatchDiscoverPhoneNumbersRequest) =>
    requestClient.post<{ status: string }>(
      '/msg/sim-cards/actions/discover-phone-numbers',
      data,
    ),
  updateBalance: (iccid: string, data: UpdateSimBalanceRequest) =>
    requestClient.put<SimCard>(`/msg/sim-cards/${iccid}/balance`, data),
  updateExpiry: (iccid: string, data: UpdateSimExpiryRequest) =>
    requestClient.put<SimCard>(`/msg/sim-cards/${iccid}/expires-at`, data),
  updateProfile: (iccid: string, data: UpdateSimProfileRequest) =>
    requestClient.put<SimCard>(`/msg/sim-cards/${iccid}/profile`, data),
  location: (iccid: string) =>
    requestClient.get<DeviceSlot | null>(`/msg/sim-cards/${iccid}/location`),
  locationHistory: (iccid: string) =>
    requestClient.get<SimLocationHistory[]>(
      `/msg/sim-cards/${iccid}/location-history`,
    ),
  messages: (iccid: string) =>
    requestClient.get<SmsMessage[]>(`/msg/sim-cards/${iccid}/messages`),
  sendSms: (iccid: string, data: SendSmsRequest) =>
    requestClient.post<{ job_key: string; status: string }>(
      `/msg/sim-cards/${iccid}/sms`,
      data,
    ),
  sendSmsBatch: (data: BatchSmsRequest) =>
    requestClient.post<{ status: string }>(
      '/msg/sim-cards/actions/send-sms',
      data,
    ),
  updateDevice: (iccid: string, data: UpdateDeviceCardRequest) =>
    requestClient.post<{ status: string }>(
      `/msg/sim-cards/${iccid}/actions/update-device`,
      data,
    ),
};
