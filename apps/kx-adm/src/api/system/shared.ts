import type { Page, PageQuery } from '#/api/request';

export type StatusValue = 0 | 1;

export interface LegacyPageQuery extends PageQuery {
  createTime?: unknown;
  deptId?: number | string;
  deptIds?: Array<number | string>;
  endTime?: number | string;
  id?: number | string;
  keyword?: string;
  name?: string;
  pageSize?: number;
  remark?: string;
  startTime?: number | string;
  status?: StatusValue;
  tel?: string;
}

export interface LegacyPage<T> {
  items: T[];
  total: number;
}

export function statusFromEnabled(enabled?: boolean): StatusValue {
  return enabled === false ? 0 : 1;
}

export function enabledFromStatus(status?: StatusValue): boolean {
  return status !== 0;
}

export function pageParams(
  params: LegacyPageQuery = {},
): Record<string, unknown> {
  return {
    ...(params.page === undefined ? {} : { page: params.page }),
    ...(params.pageSize === undefined ? {} : { size: params.pageSize }),
    ...(params.size === undefined ? {} : { size: params.size }),
    ...(params.sort === undefined ? {} : { sort: params.sort }),
    ...(params.descending === undefined
      ? {}
      : { descending: params.descending }),
    ...(params.status === undefined
      ? {}
      : { enabled: enabledFromStatus(params.status) }),
  };
}

export function toLegacyPage<T>(page: Page<T>): LegacyPage<T> {
  return { items: page.items, total: page.total };
}
