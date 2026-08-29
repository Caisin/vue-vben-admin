<script lang="ts" setup>
import { reactive, ref, watch } from 'vue';

import {
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from 'antdv-next';
const props = defineProps<{
  itemType?: string;
  open: boolean;
  record?: Record<string, any>;
}>();
const emit = defineEmits<{
  submit: [value: any];
  'update:open': [value: boolean];
}>();
const form = reactive<Record<string, any>>({});
const saving = ref(false);
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
    Object.assign(form, {
      item_type: props.itemType ?? 'normal',
      coin_item: 1,
      coupon_item: 2,
      vip_item: 3,
      is_sub: 0,
      ext_info: {},
      ...JSON.parse(JSON.stringify(props.record ?? {})),
    });
    if (!form.ext_info || typeof form.ext_info !== 'object') form.ext_info = {};
  },
);
function submit() {
  saving.value = true;
  try {
    emit('submit', { ...form });
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="
      itemType === 'vip'
        ? 'VIP 模板项'
        : itemType === 'money'
          ? '章节解锁模板项'
          : '普通模板项'
    "
    width="760px"
    :confirm-loading="saving"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem label="标题" required>
        <Input v-model:value="form.title" />
      </FormItem>
      <Space wrap>
        <FormItem label="iOS SKU">
          <Input v-model:value="form.ios_sku" class="w-[220px]" />
        </FormItem>
        <FormItem label="Google SKU">
          <Input v-model:value="form.google_sku" class="w-[220px]" />
        </FormItem>
        <FormItem label="商品类型">
          <Select
            v-model:value="form.item_type"
            class="w-[160px]"
            :options="[
              { label: '普通', value: 'normal' },
              { label: 'VIP', value: 'vip' },
              { label: '章节', value: 'res_item' },
              { label: '整部', value: 'res_all' },
            ]"
          />
        </FormItem>
      </Space>
      <Space wrap>
        <FormItem label="充值金额(美分)" required>
          <InputNumber v-model:value="form.amount" :min="0" class="w-[160px]" />
        </FormItem>
        <FormItem label="金币">
          <InputNumber v-model:value="form.coin" :min="0" class="w-[140px]" />
        </FormItem>
        <FormItem label="赠币">
          <InputNumber v-model:value="form.coupon" :min="0" class="w-[140px]" />
        </FormItem>
        <FormItem label="赠币有效天数">
          <InputNumber
            v-model:value="form.coupon_days"
            :min="0"
            class="w-[140px]"
          />
        </FormItem>
        <FormItem label="VIP 天数">
          <InputNumber
            v-model:value="form.vip_days"
            :min="0"
            class="w-[140px]"
          />
        </FormItem>
      </Space>
      <Space wrap>
        <FormItem label="回传价格">
          <InputNumber
            v-model:value="form.back_amount"
            :min="0"
            class="w-[160px]"
          />
        </FormItem>
        <FormItem label="回传百分比">
          <InputNumber v-model:value="form.back_percent" class="w-[160px]" />
        </FormItem>
        <FormItem label="是否订阅">
          <Select
            v-model:value="form.is_sub"
            class="w-[120px]"
            :options="[
              { label: '否', value: 0 },
              { label: '是', value: 1 },
            ]"
          />
        </FormItem>
      </Space>
      <FormItem label="支付描述">
        <Input v-model:value="form.summary" />
      </FormItem>
      <FormItem label="描述1">
        <Input v-model:value="form.ext_info.desc1" />
      </FormItem>
      <FormItem label="描述2">
        <Input v-model:value="form.ext_info.desc2" />
      </FormItem>
      <FormItem label="备注"><Input v-model:value="form.remark" /></FormItem>
    </Form>
  </Modal>
</template>
