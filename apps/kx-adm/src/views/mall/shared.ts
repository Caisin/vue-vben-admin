import type { MallCategory, MallProductStatus } from '#/api/mall';

export const mallStatusOptions: Array<{
  color: string;
  label: string;
  value: MallProductStatus;
}> = [
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'success', label: '已发布', value: 'published' },
  { color: 'warning', label: '已下架', value: 'off_shelf' },
];

export const mallStatusSelectOptions = mallStatusOptions.map(
  ({ label, value }) => ({
    label,
    value,
  }),
);

export const fulfillmentTypeOptions = [
  { label: '实物配送', value: 'physical_delivery' },
  { label: '到店自提', value: 'pickup' },
  { label: '虚拟发放', value: 'virtual' },
];

export function statusLabel(value?: MallProductStatus) {
  return (
    mallStatusOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}

export function toNumberValue(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function buildCategoryTree(items: MallCategory[]): MallCategory[] {
  const nodes = new Map<string, MallCategory>();
  for (const item of items) {
    nodes.set(String(item.id), { ...item, children: [] });
  }
  const roots: MallCategory[] = [];
  for (const item of nodes.values()) {
    const parent =
      item.parent_id === null || item.parent_id === undefined
        ? undefined
        : nodes.get(String(item.parent_id));
    if (parent) parent.children?.push(item);
    else roots.push(item);
  }
  return roots;
}
