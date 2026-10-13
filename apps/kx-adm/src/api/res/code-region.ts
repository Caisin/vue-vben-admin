export const distributionRegionOptions = [
  { label: '未标注', value: 'unspecified' },
  { label: '国内', value: 'domestic' },
  { label: '海外', value: 'overseas' },
];
export function distributionRegionLabel(region?: string) {
  return (
    distributionRegionOptions.find((item) => item.value === region)?.label ??
    '未标注'
  );
}
