import type { VbenFormSchema } from '#/adapter/form';
import type { MallSettings } from '#/api/mall';

export function useSettingsSchema(): VbenFormSchema<MallSettings>[] {
  return [
    {
      component: 'Input',
      fieldName: 'mall_name',
      label: '商城名称',
      rules: 'required',
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用商城',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0, max: 365 },
      fieldName: 'after_sale_days',
      help: '用户可申请售后的天数窗口；过短会影响售后处理，过长会延迟交易结算。',
      label: '售后天数',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1, max: 365 },
      fieldName: 'auto_complete_days',
      help: '发货或自提后自动完成的等待天数。',
      label: '自动完成天数',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1, max: 1440 },
      fieldName: 'pickup_token_minutes',
      help: '自提核销码有效分钟数，过期后需重新生成。',
      label: '自提凭证分钟',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'low_stock_threshold',
      help: '库存小于等于该阈值时标记低库存，用于运营提醒。',
      label: '低库存阈值',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
      fieldName: 'notice',
      formItemClass: 'md:col-span-2',
      label: '商城公告',
    },
  ];
}
