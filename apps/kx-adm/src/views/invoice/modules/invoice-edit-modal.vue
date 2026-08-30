<script lang="ts" setup>
import type {
  InvoiceItemView,
  InvoiceLineItemView,
  InvoiceUpdateWrite,
} from '#/api/invoice';

import { computed, ref, watch } from 'vue';

import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Table,
  TextArea,
} from 'antdv-next';
import dayjs from 'dayjs';

import { InvoiceApi } from '#/api/invoice';

import { emptyLineItem } from '../data';

const props = defineProps<{
  invoice?: InvoiceItemView;
  open: boolean;
}>();

const emit = defineEmits<{
  saved: [value: InvoiceItemView];
  'update:open': [value: boolean];
}>();

const saving = ref(false);
const form = ref<InvoiceUpdateWrite>(blankForm());

const title = computed(() =>
  props.invoice
    ? `维护发票 ${props.invoice.invoice_no || props.invoice.invoice_id}`
    : '维护发票',
);

watch(
  () => [props.open, props.invoice] as const,
  ([open]) => {
    if (!open) return;
    form.value = props.invoice ? fromInvoice(props.invoice) : blankForm();
  },
  { immediate: true },
);

function close() {
  emit('update:open', false);
}

async function save() {
  if (!props.invoice) return;
  if (!form.value.invoice_no.trim()) {
    message.warning('发票号不能为空');
    return;
  }
  saving.value = true;
  try {
    const saved = await InvoiceApi.update(props.invoice.invoice_id, {
      ...form.value,
      amount_no_tax: cleanMoney(form.value.amount_no_tax),
      amount_tax: cleanMoney(form.value.amount_tax),
      line_items: form.value.line_items.map((item) => ({
        ...item,
        amount: cleanMoney(item.amount),
        amount_tax: cleanMoney(item.amount_tax),
        project_name: item.project_name.trim(),
        quantity: item.quantity?.trim() || '',
        specification: item.specification.trim(),
        tax_amount: cleanMoney(item.tax_amount),
        tax_rate: item.tax_rate.trim(),
        unit: item.unit.trim(),
        unit_price: item.unit_price?.trim() || '',
      })),
      tax_amount: cleanMoney(form.value.tax_amount),
    });
    message.success('发票已保存');
    emit('saved', saved);
    close();
  } finally {
    saving.value = false;
  }
}

function addLineItem() {
  form.value.line_items.push(emptyLineItem());
}

function removeLineItem(index: number) {
  form.value.line_items.splice(index, 1);
}

function onDateChange(_value: unknown, dateString: string | string[]) {
  form.value.invoice_date = Array.isArray(dateString)
    ? dateString[0] || ''
    : dateString;
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function valueToString(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function cleanMoney(value: unknown) {
  const text = valueToString(value).trim();
  return text || '0';
}

function setFormMoney(
  field: 'amount_no_tax' | 'amount_tax' | 'tax_amount',
  value: unknown,
) {
  form.value[field] = cleanMoney(value);
}

function setLineValue(
  record: InvoiceLineItemView,
  field: keyof Pick<
    InvoiceLineItemView,
    'amount' | 'amount_tax' | 'quantity' | 'tax_amount' | 'unit_price'
  >,
  value: unknown,
) {
  record[field] =
    field === 'quantity' || field === 'unit_price'
      ? valueToString(value)
      : cleanMoney(value);
}

function blankForm(): InvoiceUpdateWrite {
  return {
    amount_no_tax: '0',
    amount_tax: '0',
    amount_uppercase: '',
    buyer_credit_code: '',
    buyer_name: '',
    invoice_clerk: '',
    invoice_date: '',
    invoice_no: '',
    invoice_type: '',
    line_items: [],
    seller_credit_code: '',
    seller_name: '',
    tax_amount: '0',
    tax_rate: '',
  };
}

function fromInvoice(invoice: InvoiceItemView): InvoiceUpdateWrite {
  return {
    amount_no_tax: invoice.amount_no_tax,
    amount_tax: invoice.amount_tax,
    amount_uppercase: invoice.amount_uppercase,
    buyer_credit_code: invoice.buyer_credit_code,
    buyer_name: invoice.buyer_name,
    invoice_clerk: invoice.invoice_clerk,
    invoice_date: invoice.invoice_date,
    invoice_no: invoice.invoice_no,
    invoice_type: invoice.invoice_type,
    line_items: invoice.line_items.map((item) => ({ ...item })),
    seller_credit_code: invoice.seller_credit_code,
    seller_name: invoice.seller_name,
    tax_amount: invoice.tax_amount,
    tax_rate: invoice.tax_rate,
  };
}
</script>

<template>
  <Modal
    :confirm-loading="saving"
    :open="open"
    :title="title"
    width="960px"
    @cancel="close"
    @ok="save"
  >
    <Form layout="vertical" class="invoice-edit-form">
      <section>
        <h3>发票识别信息</h3>
        <div class="invoice-form-grid">
          <FormItem label="发票号" required>
            <Input v-model:value="form.invoice_no" />
          </FormItem>
          <FormItem label="发票类型">
            <Input v-model:value="form.invoice_type" />
          </FormItem>
          <FormItem label="开票日期">
            <DatePicker
              class="w-full"
              :value="form.invoice_date ? dayjs(form.invoice_date) : undefined"
              value-format="YYYY-MM-DD"
              @change="onDateChange"
            />
          </FormItem>
          <FormItem label="开票员">
            <Input v-model:value="form.invoice_clerk" />
          </FormItem>
        </div>
      </section>

      <section>
        <h3>购销方与金额</h3>
        <div class="invoice-form-grid">
          <FormItem label="销售方">
            <Input v-model:value="form.seller_name" />
          </FormItem>
          <FormItem label="销售方税号">
            <Input v-model:value="form.seller_credit_code" />
          </FormItem>
          <FormItem label="购买方">
            <Input v-model:value="form.buyer_name" />
          </FormItem>
          <FormItem label="购买方税号">
            <Input v-model:value="form.buyer_credit_code" />
          </FormItem>
          <FormItem label="价税合计">
            <InputNumber
              class="w-full"
              :min="0"
              :precision="2"
              :value="toNumber(form.amount_tax)"
              @change="(value) => setFormMoney('amount_tax', value)"
            />
          </FormItem>
          <FormItem label="不含税金额">
            <InputNumber
              class="w-full"
              :min="0"
              :precision="2"
              :value="toNumber(form.amount_no_tax)"
              @change="(value) => setFormMoney('amount_no_tax', value)"
            />
          </FormItem>
          <FormItem label="税额">
            <InputNumber
              class="w-full"
              :min="0"
              :precision="2"
              :value="toNumber(form.tax_amount)"
              @change="(value) => setFormMoney('tax_amount', value)"
            />
          </FormItem>
          <FormItem label="税率">
            <Input v-model:value="form.tax_rate" />
          </FormItem>
          <FormItem label="大写金额" class="wide">
            <TextArea
              v-model:value="form.amount_uppercase"
              :auto-size="{ minRows: 1, maxRows: 2 }"
            />
          </FormItem>
        </div>
      </section>

      <section>
        <div class="section-title">
          <h3>明细行</h3>
          <Button size="small" @click="addLineItem">新增明细</Button>
        </div>
        <Table
          :columns="[
            { dataIndex: 'project_name', title: '项目', width: 180 },
            { dataIndex: 'specification', title: '规格', width: 140 },
            { dataIndex: 'unit', title: '单位', width: 90 },
            { dataIndex: 'quantity', title: '数量', width: 110 },
            { dataIndex: 'unit_price', title: '单价', width: 110 },
            { dataIndex: 'amount', title: '金额', width: 120 },
            { dataIndex: 'tax_amount', title: '税额', width: 120 },
            { dataIndex: 'amount_tax', title: '价税合计', width: 120 },
            { dataIndex: 'tax_rate', title: '税率', width: 90 },
            { dataIndex: 'is_discount', title: '折扣', width: 90 },
            { dataIndex: 'operation', title: '操作', width: 80 },
          ]"
          :data-source="form.line_items"
          :pagination="false"
          row-key="project_name"
          :scroll="{ x: 1280 }"
          size="small"
        >
          <template #bodyCell="{ column, index, record }">
            <Input
              v-if="column.dataIndex === 'project_name'"
              v-model:value="(record as InvoiceLineItemView).project_name"
              placeholder="项目名称"
            />
            <Input
              v-else-if="column.dataIndex === 'specification'"
              v-model:value="(record as InvoiceLineItemView).specification"
              placeholder="规格"
            />
            <Input
              v-else-if="column.dataIndex === 'unit'"
              v-model:value="(record as InvoiceLineItemView).unit"
              placeholder="单位"
            />
            <InputNumber
              v-else-if="column.dataIndex === 'quantity'"
              class="line-number"
              :min="0"
              :value="toNumber((record as InvoiceLineItemView).quantity)"
              @change="
                (value) =>
                  setLineValue(record as InvoiceLineItemView, 'quantity', value)
              "
            />
            <InputNumber
              v-else-if="column.dataIndex === 'unit_price'"
              class="line-number"
              :min="0"
              :precision="2"
              :value="toNumber((record as InvoiceLineItemView).unit_price)"
              @change="
                (value) =>
                  setLineValue(
                    record as InvoiceLineItemView,
                    'unit_price',
                    value,
                  )
              "
            />
            <InputNumber
              v-else-if="column.dataIndex === 'amount'"
              class="line-number"
              :min="0"
              :precision="2"
              :value="toNumber((record as InvoiceLineItemView).amount)"
              @change="
                (value) =>
                  setLineValue(record as InvoiceLineItemView, 'amount', value)
              "
            />
            <InputNumber
              v-else-if="column.dataIndex === 'tax_amount'"
              class="line-number"
              :min="0"
              :precision="2"
              :value="toNumber((record as InvoiceLineItemView).tax_amount)"
              @change="
                (value) =>
                  setLineValue(
                    record as InvoiceLineItemView,
                    'tax_amount',
                    value,
                  )
              "
            />
            <InputNumber
              v-else-if="column.dataIndex === 'amount_tax'"
              class="line-number"
              :min="0"
              :precision="2"
              :value="toNumber((record as InvoiceLineItemView).amount_tax)"
              @change="
                (value) =>
                  setLineValue(
                    record as InvoiceLineItemView,
                    'amount_tax',
                    value,
                  )
              "
            />
            <Input
              v-else-if="column.dataIndex === 'tax_rate'"
              v-model:value="(record as InvoiceLineItemView).tax_rate"
              class="line-tax-rate"
              placeholder="税率"
            />
            <Checkbox
              v-else-if="column.dataIndex === 'is_discount'"
              v-model:checked="(record as InvoiceLineItemView).is_discount"
            />
            <Button
              v-else
              danger
              size="small"
              type="link"
              @click="removeLineItem(index)"
            >
              删除
            </Button>
          </template>
        </Table>
      </section>
    </Form>
  </Modal>
</template>

<style scoped>
.invoice-edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.invoice-edit-form h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.invoice-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.wide {
  grid-column: 1 / -1;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.line-tax-rate {
  width: 90px;
}

.line-number {
  width: 100%;
}
</style>
