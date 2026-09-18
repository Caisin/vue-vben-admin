import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';
import type { DeepPartial } from '@vben/types';

/** 窄屏取消固定列，保留字段、插槽和选择列；不修改桌面配置。 */
export function mobileGridColumns<T = any>(
  columns: DeepPartial<VxeTableGridOptions<T>>['columns'],
): DeepPartial<VxeTableGridOptions<T>>['columns'] {
  return columns?.map((column) =>
    column
      ? {
          ...column,
          fixed: undefined,
          children: column.children
            ? mobileGridColumns<T>(column.children)
            : undefined,
        }
      : column,
  );
}
