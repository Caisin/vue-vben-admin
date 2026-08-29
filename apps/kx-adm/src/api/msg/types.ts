export interface OverviewMetric {
  code: string;
  level: 'default' | 'error' | 'success' | 'warning' | string;
  target_path: string;
  target_query: Record<string, boolean | number | string>;
  title: string;
  value: number;
}

export interface MsgOverviewView {
  devices: OverviewMetric[];
  events: OverviewMetric[];
  expires_within_days: number;
  low_balance_threshold: string;
  sim_cards: OverviewMetric[];
  sms: OverviewMetric[];
}

export interface Paging {
  page: number;
  size: number;
}

export interface PageResult<T> {
  items: T[];
  paging: Paging;
  total: number;
  total_pages: number;
}

export interface Device {
  base_url: string;
  credential_ready: boolean;
  device_code: string;
  device_system_time: string;
  hardware_version: string;
  last_seen_at: number;
  mac: string;
  name: string;
  online_changed_at: number;
  online_state: string;
  reported_status: string;
  slot_1_phone_number: string;
  slot_2_phone_number: string;
  software_version: string;
  sta_ip: string;
  uid: string;
  updated_at: number;
  wifi: string;
}

export interface DeviceFilterOptions {
  online_states: string[];
  software_versions: string[];
}

export interface DeviceOtaBatchRequest {
  device_codes?: string[];
  firmware_path: string;
  online_only?: boolean;
  target_version?: string;
}

export interface DeviceVoiceForwardConfigSyncRequest {
  device_codes?: string[];
  online_only?: boolean;
  tts_txt?: string;
}

export interface CallRecord {
  call_state: string;
  dedupe_key: string;
  device_code: string;
  local_number: string;
  note: string;
  peer_number: string;
  received_at: number;
  sim_iccid: string;
  slot_code: string;
  slot_key: string;
  upstream_time: string;
  voice_file_id: number | string;
  voice_media_id: string;
}

export interface DeviceOtaDeviceResult {
  current_version: string;
  device_code: string;
  message: string;
  operation_id: null | number;
  status: string;
}

export interface DeviceOtaBatchResult {
  failed: number;
  firmware_path: string;
  items: DeviceOtaDeviceResult[];
  skipped: number;
  target_version: string;
  total: number;
  upgraded: number;
}

export interface DeviceCommandBatchItem {
  device_code: string;
  message: string;
  operation_id: null | number;
  status: string;
}

export interface DeviceCommandBatchAccepted {
  failed: number;
  items: DeviceCommandBatchItem[];
  published: number;
  total: number;
}

export interface SoftwareVersionFilterOption {
  device_count: number;
  label: string;
  value: string;
}

export interface DeviceSlot {
  call_state: string;
  carrier: string;
  current_sim_iccid: string;
  device_code: string;
  imei: string;
  last_seen_at: number;
  lock_carrier: string;
  phone_number: string;
  reported_status: string;
  rsrp: string;
  slot_code: string;
  slot_key: string;
}

export interface DeviceSlotView extends DeviceSlot {
  balance: string;
  balance_currency: string;
  expires_at: number;
}

export interface DeviceOperation {
  command: string;
  created_at: number;
  device_code: string;
  error_message: string;
  finished_at: number;
  id: number;
  status: string;
}

export interface DeviceOperationDetail extends DeviceOperation {
  mqtt_payload: unknown;
  mqtt_topic: string;
}

export interface DeviceEventFilterOptions {
  event_kinds: Array<{ label: string; value: string }>;
  process_statuses: Array<{ label: string; value: string }>;
}

export interface DeviceEvent {
  device_code: string;
  error_message: string;
  event_kind: string;
  id: number;
  process_status: string;
  processed_at: number;
  received_at: number;
}

export interface DeviceEventDetail extends DeviceEvent {
  mqtt_topic: string;
  payload_json: unknown;
}

export interface SimCard {
  account_source: string;
  account_updated_at: number;
  apple_developer_registered: boolean;
  balance: string;
  balance_currency: string;
  carrier: string;
  created_at: number;
  expires_at: number;
  first_seen_at: number;
  iccid: string;
  imsi: string;
  last_seen_at: number;
  lifecycle_state: string;
  management_note: string;
  note: string;
  phone_number: string;
  real_name: string;
  updated_at: number;
}

export interface SimCardView extends SimCard {
  account_count: number;
  device_code: null | string;
  device_name: null | string;
  is_roaming: boolean | null;
  online_state: 'offline' | 'online' | 'unknown';
  phone_region: PhoneRegion;
  slot_code: null | string;
  slot_key: null | string;
}

export type PhoneRegion = 'hong_kong' | 'mainland_china' | 'other' | 'unknown';

export interface PhoneRegionOption {
  label: string;
  value: PhoneRegion;
}

export interface SimCardFilterOptions {
  carriers: string[];
  devices: Array<{ label: string; value: string }>;
  lifecycle_states: Array<{ label: string; value: string }>;
  phone_regions: PhoneRegionOption[];
  real_names: string[];
  slot_codes: string[];
  software_versions: SoftwareVersionFilterOption[];
}

export interface DeviceLocation {
  device_code: string;
  name: string;
  online_state: string;
}

export interface SimLocation {
  device: DeviceLocation | null;
  sim_card: SimCard;
  slot: DeviceSlot | null;
}

export interface SimLocationHistory {
  device_code: string;
  first_seen_at: number;
  id: number;
  last_seen_at: number;
  removed_at: number;
  sim_iccid: string;
  slot_key: string;
  source_event_id: number;
}

export interface SmsMessage {
  content: string;
  dedupe_key: string;
  device_code: string;
  direction: string;
  local_number: string;
  message_type: string;
  received_at: number;
  remote_number: string;
  sim_iccid: string;
  slot_key: string;
  sms_job_key: string;
  upstream_time: string;
}

export interface SmsReprocessResult {
  balances_updated: number;
  failed: number;
  phone_numbers_updated: number;
  scanned: number;
  skipped: number;
}

export interface SmsJob {
  attempt_count: number;
  content: string;
  created_at: number;
  device_code: string;
  finished_at: number;
  idempotency_key: string;
  last_error_code: string;
  last_error_message: string;
  mqtt_payload?: string;
  mqtt_topic?: string;
  requested_by: string;
  sim_iccid: string;
  slot_key: string;
  started_at: number;
  status: string;
  target_number: string;
  upstream_message: string;
}

export interface StorageConfig {
  access_key_id_configured: boolean;
  bucket: string;
  created_at: number;
  enable_virtual_host_style: boolean;
  endpoint: string;
  in_use: boolean;
  name: string;
  region: string;
  root: string;
  scheme: 'fs' | 's3';
  secret_access_key_configured: boolean;
  status: 'disabled' | 'enabled';
  storage_key: string;
  updated_at: number;
}

export type PhoneAccountType = string;
export type PhoneAccountStatus = 'active' | 'disabled';

export interface PhoneAccountFilterOptions {
  platforms: string[];
  purposes: string[];
  statuses: Array<{ label: string; value: PhoneAccountStatus }>;
  types: Array<{ label: string; value: PhoneAccountType }>;
}

export interface PhoneAccount {
  account_key: string;
  account_name: string;
  account_type: PhoneAccountType;
  created_at: number;
  login_url: string;
  note: string;
  password_set: boolean;
  phone_number: string;
  platform: string;
  purpose: string;
  status: PhoneAccountStatus;
  updated_at: number;
}

export interface PhoneGroup {
  created_at: number;
  enabled: boolean;
  grp_code: string;
  grp_name: string;
  id: number;
  order_no: number;
  remark: string;
  sim_count: number;
  updated_at: number;
  user_count: number;
}

export interface ListParams {
  [key: string]: boolean | number | string | string[] | undefined;
  page?: number;
  size?: number;
}
