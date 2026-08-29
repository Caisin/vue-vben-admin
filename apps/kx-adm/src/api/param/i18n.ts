import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface KxI18n {
  created_at: number | string;
  data: JsonValue;
  enabled: boolean;
  locale: string;
  name: string;
}

export interface KxKeyI18n {
  created_at: number | string;
  key: string;
  lang: string;
  val: string;
}

export interface I18nSave {
  data: JsonValue;
  enabled?: boolean;
  locale: string;
  name?: string;
}

export interface KeyI18nWrite {
  key: string;
  lang: string;
  value: string;
}

export interface KeyI18nPageQuery extends PageQuery {
  key_prefix?: string;
  lang?: string;
}

export const I18nApi = {
  save: (data: I18nSave) => requestClient.post<KxI18n>('/param/i18n', data),
  item: (locale: string) =>
    requestClient.get<KxI18n>(`/param/i18n/item/${encodeURIComponent(locale)}`),
  locale: (locale: string) =>
    requestClient.get<JsonValue>(`/param/i18n/${encodeURIComponent(locale)}`),
  canUse: (key: string) =>
    requestClient.get<boolean>(`/param/i18n/can_use/${key}`),
  queryKeys: (value: string) =>
    requestClient.get<JsonValue[]>(`/param/i18n/qry_key/${value}`),
  queryValues: (key: string) =>
    requestClient.get<JsonValue[]>(`/param/i18n/qry_val/${key}`),
};

export const KeyI18nApi = {
  list: (params?: KeyI18nPageQuery) =>
    requestClient.get<Page<KxKeyI18n>>('/param/key_i18n', { params }),
  data: () => requestClient.get<JsonValue>('/param/key_i18n/i18n_data'),
  save: (data: KeyI18nWrite) =>
    requestClient.post<KxKeyI18n>('/param/key_i18n', data),
};
