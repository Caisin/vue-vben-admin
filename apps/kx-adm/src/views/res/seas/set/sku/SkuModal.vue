<script lang="ts" setup>
import { computed, reactive, watch } from 'vue';

import {
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  TextArea,
} from 'antdv-next';

const props = defineProps<{
  mode: 'base' | 'normal' | 'vip';
  open: boolean;
  record?: Record<string, any>;
}>();

const emit = defineEmits<{
  submit: [value: Record<string, any>];
  'update:open': [value: boolean];
}>();

const stateOptions = [
  { label: '正常', value: 1 },
  { label: '停用', value: 0 },
];
const itemTypeOptions = [
  { label: '普通充值', value: 'normal' },
  { label: 'VIP', value: 'vip' },
];
const subOptions = [
  { label: '否', value: 0 },
  { label: '是', value: 1 },
];

const form = reactive<Record<string, any>>({});
const title = computed(() => {
  if (props.mode === 'normal') return '普通充值模板';
  if (props.mode === 'vip') return 'VIP 模板';
  return form.id ? '编辑 SKU' : '新增 SKU';
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const record = props.record ?? {};
    const info = record.product_info ?? {};
    Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
    Object.assign(form, {
      amount: undefined,
      coin: 0,
      coupon: 0,
      id: record.id,
      is_sub: record.subscription || info.is_sub ? 1 : 0,
      item_type: info.item_type ?? (props.mode === 'vip' ? 'vip' : 'normal'),
      pay_item_id: record.pay_item_id ?? info.pay_item_id,
      product_id: record.product_id ?? '',
      product_name: record.product_name ?? '',
      remark: info.remark ?? '',
      state: record.enabled === false ? 0 : 1,
      summary: info.summary ?? '',
      vip_days: 0,
      ...info,
    });
    if (props.mode === 'normal') form.item_type = 'normal';
    if (props.mode === 'vip') form.item_type = 'vip';
  },
);

function positiveNumber(value: unknown) {
  return Number(value || 0) > 0;
}

function submit() {
  if (!positiveNumber(form.pay_item_id)) {
    message.warning('请输入已存在的支付商品ID');
    return;
  }
  if (
    !String(form.product_id ?? '').trim() ||
    !String(form.product_name ?? '').trim()
  ) {
    message.warning('请输入 SKU ID 和 SKU 名称');
    return;
  }
  if (!['normal', 'vip'].includes(String(form.item_type))) {
    message.warning('请选择充值类型');
    return;
  }
  if (props.mode !== 'base') {
    if (!positiveNumber(form.amount)) {
      message.warning('充值金额必须大于 0');
      return;
    }
    if (!String(form.summary ?? '').trim()) {
      message.warning('请输入支付描述');
      return;
    }
  }

  emit('submit', {
    id: form.id,
    pay_item_id: Number(form.pay_item_id),
    product_id: String(form.product_id).trim(),
    product_name: String(form.product_name).trim(),
    state: Number(form.state),
    subscription: Number(form.is_sub || 0) === 1,
    product_info: {
      amount: Number(form.amount || 0),
      coin: Number(form.coin || 0),
      coupon: Number(form.coupon || 0),
      is_sub: Number(form.is_sub || 0),
      item_type: form.item_type,
      remark: form.remark ?? '',
      summary: form.summary ?? '',
      vip_days: Number(form.vip_days || 0),
    },
  });
}
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    width="680px"
    :destroy-on-close="true"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <Space class="w-full" :size="16" wrap>
        <FormItem label="支付商品ID" required>
          <InputNumber
            v-model:value="form.pay_item_id"
            :min="1"
            class="w-[180px]"
          />
        </FormItem>
        <FormItem label="SKU ID" required>
          <Input
            v-model:value="form.product_id"
            :disabled="!!form.id"
            class="w-[260px]"
          />
        </FormItem>
        <FormItem label="SKU 名称" required>
          <Input v-model:value="form.product_name" class="w-[260px]" />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="form.state"
            class="w-[120px]"
            :options="stateOptions"
          />
        </FormItem>
        <FormItem label="充值类型" required>
          <Select
            v-model:value="form.item_type"
            :disabled="mode !== 'base'"
            class="w-[160px]"
            :options="itemTypeOptions"
          />
        </FormItem>
        <FormItem label="是否订阅">
          <Select
            v-model:value="form.is_sub"
            class="w-[120px]"
            :options="subOptions"
          />
        </FormItem>
      </Space>

      <template v-if="mode !== 'base'">
        <Space class="w-full" :size="16" wrap>
          <FormItem label="充值金额(美分)" required>
            <InputNumber
              v-model:value="form.amount"
              :min="1"
              :precision="0"
              class="w-[180px]"
            />
          </FormItem>
          <FormItem v-if="mode === 'normal'" label="金币">
            <InputNumber
              v-model:value="form.coin"
              :min="0"
              :precision="0"
              class="w-[160px]"
            />
          </FormItem>
          <FormItem v-if="mode === 'normal'" label="赠币">
            <InputNumber
              v-model:value="form.coupon"
              :min="0"
              :precision="0"
              class="w-[160px]"
            />
          </FormItem>
          <FormItem v-if="mode === 'vip'" label="VIP 天数">
            <InputNumber
              v-model:value="form.vip_days"
              :min="0"
              :precision="0"
              class="w-[160px]"
            />
          </FormItem>
        </Space>
        <FormItem label="支付描述" required>
          <Input v-model:value="form.summary" />
        </FormItem>
      </template>

      <FormItem label="备注">
        <TextArea v-model:value="form.remark" :rows="3" />
      </FormItem>
    </Form>
  </Modal>
</template>
