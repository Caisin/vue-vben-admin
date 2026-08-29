import { setTimezoneHandler } from '@vben/stores';

import {
  getTimezoneApi,
  getTimezoneOptionsApi,
  setTimezoneApi,
} from '#/api/core';

/**
 * 初始化时区处理，通过API保存时区设置
 */
export function initTimezone() {
  setTimezoneHandler({
    getTimezone() {
      return getTimezoneApi();
    },
    async setTimezone(timezone: string) {
      await setTimezoneApi(timezone);
    },
    getTimezoneOptions() {
      return getTimezoneOptionsApi();
    },
  });
}
