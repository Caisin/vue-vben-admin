import { requestClient } from '#/api/request';

export interface TimezoneOption {
  label: string;
  value: string;
}

export interface UserTimezone {
  created_at: number | string;
  tz: string;
  uid: number | string;
  updated_at: number | string;
}

export const TimezoneApi = {
  global: () =>
    requestClient.get<null | string | undefined>('/auth/user/tz/global'),
  get: () => requestClient.get<null | string | undefined>('/auth/user/tz'),
  set: (timezone: string) =>
    requestClient.post<UserTimezone>('/auth/user/tz', { timezone }),
  setGlobal: (timezone: string) =>
    requestClient.post<UserTimezone>('/auth/user/tz/global', { timezone }),
  options: () => Promise.resolve<TimezoneOption[]>([]),
};

/** 获取系统支持的时区列表。后端当前未提供枚举接口，保留空列表兼容初始化流程。 */
export const getTimezoneOptionsApi = TimezoneApi.options;
/** 获取当前用户时区。 */
export const getTimezoneApi = TimezoneApi.get;
/** 设置当前用户时区。 */
export const setTimezoneApi = TimezoneApi.set;
