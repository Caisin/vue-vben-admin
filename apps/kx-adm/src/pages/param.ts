import type { ComponentRecordType } from '@vben/types';

export const paramPageMap: ComponentRecordType = import.meta.glob(
  '../views/param/**/*.vue',
);
