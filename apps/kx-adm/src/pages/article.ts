import type { ComponentRecordType } from '@vben/types';

export const articlePageMap: ComponentRecordType = import.meta.glob(
  '../views/article/**/*.vue',
);
