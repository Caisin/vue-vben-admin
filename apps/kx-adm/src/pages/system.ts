import type { ComponentRecordType } from '@vben/types';

export const systemPageMap: ComponentRecordType = import.meta.glob(
  '../views/system/**/*.vue',
);
