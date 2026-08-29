import type { ComponentRecordType } from '@vben/types';

export const corePageMap: ComponentRecordType = import.meta.glob(
  '../views/_core/**/*.vue',
);
