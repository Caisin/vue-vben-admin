import type { ComponentRecordType } from '@vben/types';

export const mallPageMap: ComponentRecordType = import.meta.glob(
  '../views/mall/**/*.vue',
);
