import type { ComponentRecordType } from '@vben/types';

export const taskPageMap: ComponentRecordType = import.meta.glob(
  '../views/system/tasks/**/*.vue',
);
