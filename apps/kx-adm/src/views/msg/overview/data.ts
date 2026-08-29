import type { VbenFormSchema } from '#/adapter/form';

export interface OverviewSearchValues {
  expires_within_days: number;
  low_balance_threshold: string;
}

export function useFormSchema(): VbenFormSchema<OverviewSearchValues>[] {
  return [
    {
      component: 'Input',
      defaultValue: '10',
      fieldName: 'low_balance_threshold',
      label: '低余额阈值',
    },
    {
      component: 'InputNumber',
      componentProps: { min: 0, precision: 0 },
      defaultValue: 30,
      fieldName: 'expires_within_days',
      label: '有效期预警天数',
    },
  ];
}
