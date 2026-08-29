import type { ComponentRecordType } from '@vben/types';

export const notifyPageMap: ComponentRecordType = import.meta.glob(
  '../views/notify/**/*.vue',
);
