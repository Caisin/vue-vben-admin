<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { PayItem, PayItemType } from '#/api/asset/pay';
import type { PayItemFormValues } from '#/views/asset/catalog-form';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { PayApi } from '#/api/asset/pay';
import { decodePayItem, encodePayItem } from '#/views/asset/catalog-form';

import { payItemTypeOptions, payPlatformOptions } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<PayItem>();

function hasItemType(type: unknown, values: PayItemType[]) {
  return values.includes(String(type || 'normal') as PayItemType);
}

const schema: VbenFormSchema<PayItemFormValues>[] = [
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'template_id',
    label: '模板 ID',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'code',
    label: '商品编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    label: '商品标题',
    rules: 'required',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: payItemTypeOptions,
      optionType: 'button',
    },
    defaultValue: 'normal',
    fieldName: 'item_type',
    formItemClass: 'md:col-span-2',
    help: '决定结算后发放余额、VIP、章节或整本解锁；隐藏的权益字段提交时会自动清空，避免跨类型残留。',
    label: '业务类型',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: payPlatformOptions },
    fieldName: 'platform',
    label: '平台',
    rules: 'selectRequired',
  },
  {
    component: 'Switch',
    defaultValue: false,
    fieldName: 'is_sub',
    help: '订阅商品必须配置扣款周期；Provider SKU 的订阅类型会被强制与商品保持一致。',
    label: '订阅',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 1 },
    dependencies: {
      show: (values) => Boolean(values.is_sub),
      triggerFields: ['is_sub'],
    },
    fieldName: 'cycle_day',
    help: '订阅扣款周期天数；非订阅商品提交时固定为 0。',
    label: '周期天数',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'amount_minor',
    label: '最小货币单位价格',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'currency',
    label: '币种',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'back_amount_minor',
    help: 'Facebook/归因回传金额，0 表示使用订单价格。',
    label: '回传金额',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', max: 10_000, min: 0 },
    fieldName: 'back_percent',
    help: '单位为万分比，10000 表示 100%，5000 表示 50%。',
    label: '回传比例',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 1 },
    dependencies: {
      show: (values) => hasItemType(values.item_type, ['res_item']),
      triggerFields: ['item_type'],
    },
    fieldName: 'unlock_episode_count',
    help: '按章节解锁商品一次购买可解锁的章节数量。',
    label: '解锁章节数',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'sort_no',
    label: '排序',
  },
  {
    component: 'Switch',
    defaultValue: true,
    fieldName: 'enabled',
    label: '启用',
  },
  {
    arrayProps: {
      addButtonText: '添加余额发放项',
      createRow: () => ({
        asset_item_id: undefined,
        quantity: undefined,
        valid_seconds: undefined,
      }),
      emptyText: '尚未配置余额资产发放',
    },
    children: [
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', min: 1 },
        fieldName: 'asset_item_id',
        label: '资产科目 ID',
        rules: 'required',
      },
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', min: 1 },
        fieldName: 'quantity',
        label: '发放数量',
        rules: 'required',
      },
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', min: 1 },
        fieldName: 'valid_seconds',
        help: '留空时使用资产科目的默认有效期。',
        label: '有效秒数',
      },
    ],
    defaultValue: [],
    dependencies: {
      show: (values) => hasItemType(values.item_type, ['normal']),
      triggerFields: ['item_type'],
    },
    fieldName: 'balance_grants',
    formItemClass: 'col-span-full',
    help: '普通商品至少配置一项；同一商品内资产科目 ID 不得重复。',
    label: '余额资产发放',
    rules: 'required',
    type: 'array',
  },
  {
    arrayProps: {
      addButtonText: '添加会员发放项',
      createRow: () => ({
        duration_seconds: undefined,
        membership_plan_id: undefined,
      }),
      emptyText: '尚未配置会员计划发放',
    },
    children: [
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', min: 1 },
        fieldName: 'membership_plan_id',
        label: '会员计划 ID',
        rules: 'required',
      },
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', min: 1 },
        fieldName: 'duration_seconds',
        label: '发放秒数',
        rules: 'required',
      },
    ],
    defaultValue: [],
    dependencies: {
      show: (values) => hasItemType(values.item_type, ['vip']),
      triggerFields: ['item_type'],
    },
    fieldName: 'membership_grants',
    formItemClass: 'col-span-full',
    help: 'VIP 商品至少配置一项；同一会员类型最多发放一个计划。',
    label: '会员计划发放',
    rules: 'required',
    type: 'array',
  },
  {
    component: 'Switch',
    defaultValue: false,
    fieldName: 'ext_info.is_back',
    help: '标记为旧业务挽回商品；该语义独立于 Facebook 分次回传规则。',
    label: '挽回项',
  },
  {
    arrayProps: {
      addButtonText: '添加回传规则',
      createRow: () => ({ back_percent: 10_000, seq_num: undefined }),
      emptyText: '未配置 Facebook 分次回传规则',
    },
    children: [
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', min: 1 },
        fieldName: 'seq_num',
        label: '购买序号',
        rules: 'required',
      },
      {
        component: 'InputNumber',
        componentProps: { class: 'w-full', max: 10_000, min: 0 },
        fieldName: 'back_percent',
        label: '回传万分比',
        rules: 'required',
      },
    ],
    defaultValue: [],
    fieldName: 'ext_info.fb_back',
    formItemClass: 'col-span-full',
    help: '按购买序号从大到小匹配；10000 表示 100%，5000 表示 50%。',
    label: 'Facebook 分次回传',
    type: 'array',
  },
  {
    component: 'JsonEditor',
    componentProps: {
      maxHeight: '420px',
      minHeight: '200px',
      valueMode: 'text',
    },
    fieldName: 'lang_info',
    formItemClass: 'col-span-full',
    help: '旧业务多语言展示信息，结构不固定时完整保留。',
    label: '多语言 JSON',
  },
  {
    component: 'JsonEditor',
    componentProps: {
      maxHeight: '420px',
      minHeight: '200px',
      valueMode: 'text',
    },
    fieldName: 'display_config',
    formItemClass: 'col-span-full',
    help: '旧管理端展示配置，例如角标、布局、资源解锁展示等动态字段。',
    label: '展示配置 JSON',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 3 } },
    fieldName: 'summary',
    formItemClass: 'md:col-span-2',
    label: '旧业务描述',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 3 } },
    fieldName: 'intro',
    formItemClass: 'md:col-span-2',
    label: '商品说明',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 3 } },
    fieldName: 'remark',
    formItemClass: 'md:col-span-2',
    label: '管理备注',
  },
];

const [Form, formApi] = useVbenForm<PayItemFormValues>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<PayItem>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = encodePayItem(await formApi.getValues());
      await (formData.value?.id
        ? PayApi.updateItem(formData.value.id, values)
        : PayApi.createItem(values));
      message.success('保存成功');
      drawerApi.close();
      emit('success');
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error(error.message || 'JSON 字段格式不正确');
        return;
      }
      throw error;
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    formData.value = data?.id ? data : undefined;
    await formApi.reset();
    if (formData.value) {
      const detail = await PayApi.item(formData.value.id);
      await formApi.setValues(
        decodePayItem({
          ...detail.item,
          balance_grants: detail.balance_grants,
          membership_grants: detail.membership_grants,
        }),
      );
    } else {
      await formApi.setValues(
        decodePayItem({
          amount_minor: 0,
          back_amount_minor: 0,
          back_percent: 10_000,
          code: '',
          currency: 'USD',
          cycle_day: 0,
          display_config: {},
          enabled: true,
          ext_info: { fb_back: [], is_back: false },
          intro: '',
          is_sub: false,
          item_type: 'normal',
          lang_info: {},
          platform: 'any',
          remark: '',
          sort_no: 0,
          summary: '',
          template_id: 0,
          title: '',
          unlock_episode_count: 0,
        }),
      );
    }
  },
});

const drawerTitle = computed(() =>
  formData.value?.id ? '编辑支付商品' : '新建支付商品',
);
</script>

<template>
  <Drawer class="w-full max-w-260" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
