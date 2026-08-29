import type { ComponentRecordType } from '@vben/types';

export const assetPageMap: ComponentRecordType = import.meta.glob(
  '../views/asset/**/*.vue',
);
