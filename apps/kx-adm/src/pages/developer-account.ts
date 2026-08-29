import type { ComponentRecordType } from '@vben/types';

export const developerAccountPageMap: ComponentRecordType = import.meta.glob(
  '../views/developer-account/**/*.vue',
);
