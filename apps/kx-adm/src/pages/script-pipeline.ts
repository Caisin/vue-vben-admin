import type { ComponentRecordType } from '@vben/types';
export const scriptPipelinePageMap: ComponentRecordType = import.meta.glob(
  '../views/script-pipeline/**/*.vue',
);
