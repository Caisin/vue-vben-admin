import { requestClient } from '#/api/request';

export interface MsgS2ConfigView {
  device_command_topic: string;
  device_credential_key_configured: boolean;
  device_response_topic: string;
  enabled: boolean;
  mqtt_client_id: string;
  mqtt_host: string;
  mqtt_message_key_configured: boolean;
  mqtt_password_configured: boolean;
  mqtt_port: number;
  mqtt_username: string;
  offline_after_secs: number;
  phone_account_credential_key_configured: boolean;
  refresh_interval_secs: number;
  restart_required: boolean;
  sms_receipt_timeout_secs: number;
  sms_receipt_topics: string[];
  sms_send_interval_secs: number;
  topic_prefix: string;
}

export interface MsgS2ConfigWrite {
  clear_mqtt_message_key: boolean;
  clear_mqtt_password: boolean;
  device_command_topic: string;
  device_response_topic: string;
  enabled: boolean;
  mqtt_client_id: string;
  mqtt_host: string;
  mqtt_message_key: string;
  mqtt_password: string;
  mqtt_port: number;
  mqtt_username: string;
  offline_after_secs: number;
  refresh_interval_secs: number;
  sms_receipt_timeout_secs: number;
  sms_receipt_topics: string[];
  sms_send_interval_secs: number;
  topic_prefix: string;
}

export interface MsgVoiceConfigView {
  access_key_configured: boolean;
  enabled: boolean;
  max_upload_bytes: number;
  record_upload_url: string;
  storage_code: string;
}

export interface MsgVoiceConfigWrite {
  access_key: string;
  clear_access_key: boolean;
  enabled: boolean;
  max_upload_bytes: number;
  record_upload_url: string;
  storage_code: string;
}

export interface MsgRuntimeState {
  enabled: boolean;
  healthy: boolean;
  reason: string;
  running: boolean;
}

export interface MsgHealthStatus {
  data_source: string;
  data_source_healthy: boolean;
  runtime: MsgRuntimeState;
  s2_enabled: boolean;
  voice_enabled: boolean;
}

export const MsgConfigApi = {
  s2: () => requestClient.get<MsgS2ConfigView>('/msg/config/s2'),
  saveS2: (data: MsgS2ConfigWrite) =>
    requestClient.put<MsgS2ConfigView>('/msg/config/s2', data),
  runtime: () => requestClient.get<MsgHealthStatus>('/msg/config/s2/runtime'),
  startRuntime: () =>
    requestClient.post<MsgHealthStatus>('/msg/config/s2/runtime/start'),
  stopRuntime: () =>
    requestClient.post<MsgHealthStatus>('/msg/config/s2/runtime/stop'),
  voice: () => requestClient.get<MsgVoiceConfigView>('/msg/config/voice'),
  saveVoice: (data: MsgVoiceConfigWrite) =>
    requestClient.put<MsgVoiceConfigView>('/msg/config/voice', data),
};
