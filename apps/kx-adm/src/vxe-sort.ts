interface VxeSortItem {
  field?: string;
  order?: string;
  property?: string;
}

interface VxeProxySortParams {
  sort?: VxeSortItem;
  sorts?: VxeSortItem[];
}

export interface BackendSortParams {
  descending?: boolean;
  sort?: string;
}

function normalizeOrder(order?: string) {
  if (!order) return undefined;
  const normalized = order.toLowerCase();
  if (normalized === 'desc' || normalized === 'descending') return 'desc';
  if (normalized === 'asc' || normalized === 'ascending') return 'asc';
  return undefined;
}

export function vxeSortParams(
  params: VxeProxySortParams,
  allowedFields: readonly string[],
): BackendSortParams {
  const activeSort = [params.sort, ...(params.sorts ?? [])].find((item) =>
    normalizeOrder(item?.order),
  );
  const field = activeSort?.field ?? activeSort?.property;
  const order = normalizeOrder(activeSort?.order);

  if (!field || !order || !allowedFields.includes(field)) {
    return {};
  }

  return { descending: order === 'desc', sort: field };
}

export function vxeSortArray(
  params: VxeProxySortParams,
  allowedFields: readonly string[],
): string[] | undefined {
  const sort = vxeSortParams(params, allowedFields);
  if (!sort.sort) return undefined;
  return [`${sort.descending ? '-' : ''}${sort.sort}`];
}

function compareSortValues(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
  });
}

export function vxeSortLocalRows<T extends object>(
  rows: T[],
  params: VxeProxySortParams,
  allowedFields: readonly string[],
): T[] {
  const sort = vxeSortParams(params, allowedFields);
  if (!sort.sort) return rows;
  const direction = sort.descending ? -1 : 1;
  const sortField = sort.sort;
  return rows.toSorted((left, right) => {
    const leftRow = left as Record<string, unknown>;
    const rightRow = right as Record<string, unknown>;
    return (
      compareSortValues(leftRow[sortField], rightRow[sortField]) * direction
    );
  });
}
