import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  InvoiceExportCreateWrite,
  InvoiceExportScope,
  InvoiceItemView,
  InvoiceLineItemView,
  InvoiceListQuery,
  InvoiceReferenceKey,
} from '#/api/invoice';

import dayjs from 'dayjs';

import { Times } from '#/times';

export interface InvoiceSearchValues {
  amount_tax?: number | string;
  buyer_name?: string;
  invoice_date_range?: [dayjs.Dayjs, dayjs.Dayjs];
  invoice_no?: string;
  invoice_type?: string;
  keyword?: string;
  seller_name?: string;
  submitted_to_finance?: boolean;
  uid?: number | string;
  uploaded_range?: [dayjs.Dayjs, dayjs.Dayjs];
}

export const invoiceSortFields = [
  'uid',
  'submitted_to_finance',
  'uploaded_at',
] as const;

export const submittedOptions = [
  { label: '已提交财务', value: true },
  { label: '未提交财务', value: false },
];

const invoiceTypeLabels: Record<string, string> = {
  flight: '航空运输电子客票',
  nontax: '非税票据',
  ticket: '运输票据',
  train: '铁路电子客票',
  'vat-general': '增值税普通发票',
  'vat-special': '增值税专用发票',
};

export function invoiceTypeLabel(value?: string) {
  if (!value || value === 'unknown') return '未识别类型';
  return invoiceTypeLabels[value] ?? value;
}

export function useFormSchema(canAdmin = false): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '发票号、购销方或税号',
      },
      fieldName: 'keyword',
      label: '关键字',
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'invoice_no',
      label: '发票号',
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        min: 0,
        precision: 2,
        stringMode: true,
      },
      fieldName: 'amount_tax',
      label: '价税合计',
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'seller_name',
      label: '销售方',
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'buyer_name',
      label: '购买方',
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'invoice_type',
      label: '发票类型',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: submittedOptions,
      },
      fieldName: 'submitted_to_finance',
      label: '财务状态',
    },
    {
      component: 'RangePicker',
      componentProps: { valueFormat: undefined },
      fieldName: 'invoice_date_range',
      label: '开票日期',
    },
    {
      component: 'RangePicker',
      componentProps: { showTime: true },
      fieldName: 'uploaded_range',
      label: '上传时间',
    },
  ];
  if (canAdmin) {
    schema.splice(6, 0, {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1, precision: 0 },
      fieldName: 'uid',
      label: '用户 UID',
    });
  }
  return schema;
}

export function useColumns(
  canAdmin = false,
  canExport = true,
): VxeTableGridColumns<InvoiceItemView> {
  const columns: VxeTableGridColumns<InvoiceItemView> = [
    {
      field: 'invoice_no',
      fixed: 'left',
      minWidth: 170,
      slots: { default: 'invoiceNo' },
      title: '发票号',
    },
    {
      field: 'amount_tax',
      minWidth: 120,
      title: '价税合计',
    },
    {
      field: 'seller_name',
      minWidth: 180,
      title: '销售方',
    },
    {
      field: 'buyer_name',
      minWidth: 180,
      title: '购买方',
    },
    {
      field: 'invoice_date',
      minWidth: 120,
      title: '开票日期',
    },
    {
      field: 'submitted_to_finance',
      slots: { default: 'financeState' },
      sortable: true,
      title: '财务',
      width: 110,
    },
    {
      field: 'duplicate_user_count',
      slots: { default: 'duplicate' },
      title: '重复',
      width: 120,
    },
    {
      field: 'original_file_name',
      minWidth: 180,
      title: '来源文件',
    },
    {
      field: 'uploaded_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.uploaded_at),
      minWidth: 180,
      sortable: true,
      title: '上传时间',
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 180,
    },
  ];
  if (canExport) {
    columns.unshift({ fixed: 'left', type: 'checkbox', width: 44 });
  }
  if (canAdmin) {
    columns.splice(-3, 0, {
      field: 'uid',
      minWidth: 110,
      sortable: true,
      title: '用户 UID',
    });
  }
  return columns;
}

export function cleanInvoiceQuery(
  values: Partial<InvoiceSearchValues>,
): InvoiceListQuery {
  return {
    amount_tax: cleanString(values.amount_tax),
    buyer_name: cleanString(values.buyer_name),
    invoice_date_range: dateRange(values.invoice_date_range),
    invoice_no: cleanString(values.invoice_no),
    invoice_type: cleanString(values.invoice_type),
    keyword: cleanString(values.keyword),
    seller_name: cleanString(values.seller_name),
    submitted_to_finance:
      typeof values.submitted_to_finance === 'boolean'
        ? values.submitted_to_finance
        : undefined,
    uid: values.uid || undefined,
    uploaded_range: unixRange(values.uploaded_range),
  };
}

export function invoiceReference(row: InvoiceItemView): InvoiceReferenceKey {
  return { invoice_id: row.invoice_id, uid: row.uid };
}

export function createExportPayload(options: {
  filter: InvoiceListQuery;
  markSubmitted: boolean;
  scope: InvoiceExportScope;
  selectedRows: InvoiceItemView[];
}): InvoiceExportCreateWrite {
  return {
    filter: options.scope === 'filtered' ? options.filter : {},
    mark_submitted_to_finance: options.markSubmitted,
    scope: options.scope,
    selected:
      options.scope === 'selected'
        ? options.selectedRows.map(invoiceReference)
        : [],
  };
}

export function uploadRiskText(row: {
  other_user_count: number | string;
  same_user_duplicate: boolean;
  used_by_other_users: boolean;
}) {
  const risks: string[] = [];
  if (row.same_user_duplicate) risks.push('同用户重复');
  if (row.used_by_other_users) {
    risks.push(`跨用户重复 ${row.other_user_count} 人`);
  }
  return risks.length > 0 ? risks.join('、') : '未发现重复';
}

export function emptyLineItem(): InvoiceLineItemView {
  return {
    amount: '0',
    amount_tax: '0',
    is_discount: false,
    project_name: '',
    quantity: '',
    specification: '',
    tax_amount: '0',
    tax_rate: '',
    unit: '',
    unit_price: '',
  };
}

function cleanString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function dateRange(value: unknown): [string, string] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [start, end] = value;
  if (!dayjs.isDayjs(start) || !dayjs.isDayjs(end)) return undefined;
  return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')];
}

function unixRange(value: unknown): [number, number] | undefined {
  const range = Times.toUnixRange(value);
  if (!range) return undefined;
  const [start, end] = range.split(',').map(Number);
  if (start === undefined || end === undefined) return undefined;
  return [start, end];
}
