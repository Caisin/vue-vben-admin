import type { ComponentRecordType } from '@vben/types';

export const storagePageMap: ComponentRecordType = import.meta.glob(
  '../views/storage/**/*.vue',
);
