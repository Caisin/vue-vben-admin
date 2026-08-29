<script lang="ts" setup>
import { reactive, ref, watch } from 'vue';

import {
  Button,
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
  open: boolean;
  record?: Record<string, any>;
}>();

const emit = defineEmits<{
  submit: [value: Record<string, any>];
  'update:open': [value: boolean];
}>();

type MoneyRule = {
  amount?: number;
  back_amount?: number;
  back_percent?: number;
  key: number;
};

const yesNoOptions = [
  { label: '否', value: 0 },
  { label: '是', value: 1 },
];
const form = reactive<Record<string, any>>({});
const rules = ref<MoneyRule[]>([]);
let nextKey = 1;

function centsToDollars(value: unknown) {
  return Math.round(Number(value || 0)) / 100;
}

function dollarsToCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function parseMoneyMap(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

function resetRules(moneyMap: any) {
  const parsed = parseMoneyMap(moneyMap);
  const entries = Object.entries(parsed);
  nextKey = 1;
  rules.value =
    entries.length > 0
      ? entries.map(([amount, cfg]) => ({
          amount: centsToDollars(amount),
          back_amount: centsToDollars((cfg as any)?.back_amount),
          back_percent: Number((cfg as any)?.back_percent ?? 0),
          key: nextKey++,
        }))
      : [{ back_percent: 0, key: nextKey++ }];
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const record = props.record ?? {};
    Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
    Object.assign(form, {
      dimension: record.dimension ?? 'link',
      id: record.id,
      is_def: record.is_def ?? 0,
      name: record.name ?? '',
      percent: record.percent ?? 0,
      remark: record.remark ?? '',
      uid: record.uid,
    });
    resetRules(record.money_map);
  },
);

function addRule() {
  rules.value.push({ back_percent: 0, key: nextKey++ });
}

function removeRule(key: number) {
  if (rules.value.length === 1) {
    rules.value = [{ back_percent: 0, key: nextKey++ }];
    return;
  }
  rules.value = rules.value.filter((item) => item.key !== key);
}

function submit() {
  if (!String(form.name ?? '').trim()) {
    message.warning('请输入回传模板名称');
    return;
  }
  if (Number(form.percent || 0) < 0 || Number(form.percent || 0) > 100) {
    message.warning('回传比例必须在 0-100 之间');
    return;
  }

  const moneyMap: Record<
    string,
    { back_amount: number; back_percent: number }
  > = {};
  for (const rule of rules.value) {
    const amount = dollarsToCents(rule.amount);
    const backAmount = dollarsToCents(rule.back_amount);
    const backPercent = Number(rule.back_percent || 0);
    if (!amount && !backAmount && !backPercent) continue;
    if (amount <= 0) {
      message.warning('充值金额必须大于 0');
      return;
    }
    if (backAmount < 0 || backPercent < 0 || backPercent > 100) {
      message.warning('回传金额或比例不合法');
      return;
    }
    if (moneyMap[amount]) {
      message.warning('充值金额不能重复');
      return;
    }
    moneyMap[amount] = { back_amount: backAmount, back_percent: backPercent };
  }

  emit('submit', {
    dimension: form.dimension || 'link',
    id: form.id,
    is_def: Number(form.is_def || 0),
    money_map: moneyMap,
    name: String(form.name).trim(),
    percent: Number(form.percent || 0),
    remark: form.remark ?? '',
    uid: form.uid,
  });
}
</script>

<template>
  <Modal
    :open="open"
    :title="form.id ? '编辑回传模板' : '新增回传模板'"
    width="760px"
    :destroy-on-close="true"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <Space class="w-full" :size="16" wrap>
        <FormItem label="回传模板名称" required>
          <Input
            v-model:value="form.name"
            :disabled="!!form.id"
            class="w-[220px]"
          />
        </FormItem>
        <FormItem label="回传比例" required>
          <InputNumber
            v-model:value="form.percent"
            :min="0"
            :max="100"
            :precision="0"
            addon-after="%"
            class="w-[160px]"
          />
        </FormItem>
        <FormItem label="是否默认">
          <Select
            v-model:value="form.is_def"
            class="w-[120px]"
            :options="yesNoOptions"
          />
        </FormItem>
        <FormItem label="维度">
          <Input v-model:value="form.dimension" class="w-[140px]" />
        </FormItem>
      </Space>
      <FormItem label="备注">
        <TextArea v-model:value="form.remark" :rows="2" />
      </FormItem>

      <div class="mb-2 font-medium">回传配置</div>
      <Space
        v-for="rule in rules"
        :key="rule.key"
        class="mb-2 w-full"
        :size="8"
        align="baseline"
        wrap
      >
        <FormItem label="充值金额(美元)">
          <InputNumber
            v-model:value="rule.amount"
            :min="0"
            :precision="2"
            addon-after="$"
            class="w-[160px]"
          />
        </FormItem>
        <span class="font-bold text-red-500">=&gt;</span>
        <FormItem label="回传金额(美元)">
          <InputNumber
            v-model:value="rule.back_amount"
            :min="0"
            :precision="2"
            addon-after="$"
            class="w-[160px]"
          />
        </FormItem>
        <span class="font-bold text-red-500">=&gt;</span>
        <FormItem label="回传比例(%)">
          <InputNumber
            v-model:value="rule.back_percent"
            :min="0"
            :max="100"
            :precision="0"
            addon-after="%"
            class="w-[150px]"
          />
        </FormItem>
        <Button danger @click="removeRule(rule.key)">-</Button>
      </Space>
      <Button type="dashed" block @click="addRule">新增阶梯</Button>
    </Form>
  </Modal>
</template>
