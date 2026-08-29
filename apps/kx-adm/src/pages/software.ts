import type { ComponentRecordType } from '@vben/types';

export const softwarePageMap: ComponentRecordType = import.meta.glob(
  '../views/software/**/*.vue',
);
