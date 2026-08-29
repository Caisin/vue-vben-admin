import type { ComponentRecordType } from '@vben/types';

export const credentialPageMap: ComponentRecordType = import.meta.glob(
  '../views/credential/**/*.vue',
);
