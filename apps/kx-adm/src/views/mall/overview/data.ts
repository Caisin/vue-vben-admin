import type { MallDashboardView } from '#/api/mall';

export function dashboardCards(data?: MallDashboardView) {
  return [
    { label: '类目数', value: data?.category_count ?? 0 },
    { label: '商品数', value: data?.product_count ?? 0 },
    { label: '已发布商品', value: data?.published_product_count ?? 0 },
    { label: 'SKU 数', value: data?.sku_count ?? 0 },
    { label: '低库存', danger: true, value: data?.low_stock_count ?? 0 },
  ];
}
