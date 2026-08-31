import type { InvoiceItemView } from '#/api/invoice';

import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import {
  cleanInvoiceQuery,
  createExportPayload,
  invoiceTypeLabel,
  uploadRiskText,
  useColumns,
  useFormSchema,
} from '../../data';

function invoice(partial: Partial<InvoiceItemView>): InvoiceItemView {
  return {
    amount_no_tax: '90',
    amount_tax: '100',
    amount_uppercase: '壹佰元整',
    buyer_credit_code: '',
    buyer_name: '购买方',
    duplicate_user_count: 0,
    invoice_clerk: '',
    invoice_date: '2026-08-31',
    invoice_id: 1,
    invoice_no: 'INV-1',
    invoice_type: '电子发票',
    line_items: [],
    original_file_name: 'a.pdf',
    parse_source: 'pdf',
    seller_credit_code: '',
    seller_name: '销售方',
    source_page_index: 0,
    submitted_at: null,
    submitted_to_finance: false,
    tax_amount: '10',
    tax_rate: '10%',
    uid: 7,
    upload_id: 9,
    uploaded_at: 1_788_110_000,
    ...partial,
  };
}

describe('发票管理页面数据工具', () => {
  it('查询表单按后端契约清理空值并编码日期范围', () => {
    const query = cleanInvoiceQuery({
      amount_tax: '113.00',
      buyer_name: ' 买方 ',
      invoice_date_range: [dayjs('2026-08-01'), dayjs('2026-08-31')],
      keyword: '  发票 ',
      original_file_name: ' 百寻.ofd ',
      seller_name: '',
      submitted_to_finance: false,
      uploaded_range: [
        dayjs('2026-08-30 10:00:00'),
        dayjs('2026-08-30 11:00:00'),
      ],
    });

    expect(query).toMatchObject({
      amount_tax: '113.00',
      buyer_name: '买方',
      invoice_date_range: ['2026-08-01', '2026-08-31'],
      keyword: '发票',
      original_file_name: '百寻.ofd',
      seller_name: undefined,
      submitted_to_finance: false,
    });
    expect(Number(query.uploaded_range?.[1])).toBeGreaterThan(
      Number(query.uploaded_range?.[0] ?? 0),
    );
  });

  it('导出 payload 区分所选记录和当前筛选', () => {
    const row = invoice({ invoice_id: '12', uid: '34' });

    expect(
      createExportPayload({
        filter: { keyword: '税' },
        markSubmitted: true,
        scope: 'selected',
        selectedRows: [row],
      }),
    ).toEqual({
      filter: {},
      mark_submitted_to_finance: true,
      scope: 'selected',
      selected: [{ invoice_id: '12', uid: '34' }],
    });

    expect(
      createExportPayload({
        filter: { keyword: '税' },
        markSubmitted: false,
        scope: 'filtered',
        selectedRows: [row],
      }),
    ).toEqual({
      filter: { keyword: '税' },
      mark_submitted_to_finance: false,
      scope: 'filtered',
      selected: [],
    });
  });

  it('首屏提供上传、重复、财务和导出所需字段', () => {
    expect(useFormSchema().map((item) => item.fieldName)).toContain('keyword');
    expect(useFormSchema().map((item) => item.fieldName)).toContain(
      'amount_tax',
    );
    expect(useFormSchema().map((item) => item.fieldName)).not.toContain('uid');
    expect(useFormSchema(true).map((item) => item.fieldName)).toContain('uid');
    expect(useFormSchema().map((item) => item.fieldName)).toContain(
      'submitted_to_finance',
    );
    const columns = useColumns() ?? [];
    expect(columns.map((item) => item?.field)).toEqual(
      expect.arrayContaining([
        'invoice_no',
        'invoice_type',
        'amount_tax',
        'seller_name',
        'buyer_name',
        'submitted_to_finance',
        'duplicate_user_count',
        'operation',
      ]),
    );
    expect(columns.map((item) => item?.field)).not.toContain('uid');
    expect((useColumns(true) ?? []).map((item) => item?.field)).toContain(
      'uid',
    );
    expect(columns.find((item) => item?.field === 'invoice_no')?.width).toBe(
      220,
    );
    expect(
      (useColumns(false, false) ?? []).some(
        (item) => item?.type === 'checkbox',
      ),
    ).toBe(false);
  });

  it('上传结果明确提示同用户和跨用户重复', () => {
    expect(
      uploadRiskText({
        other_user_count: 2,
        same_user_duplicate: true,
        used_by_other_users: true,
      }),
    ).toBe('同用户重复、跨用户重复 2 人');
    expect(
      uploadRiskText({
        other_user_count: 0,
        same_user_duplicate: false,
        used_by_other_users: false,
      }),
    ).toBe('未发现重复');
  });

  it('票种编码转换为用户可读名称', () => {
    expect(invoiceTypeLabel('vat-general')).toBe('增值税普通发票');
    expect(invoiceTypeLabel('vat-special')).toBe('增值税专用发票');
    expect(invoiceTypeLabel('unknown')).toBe('未识别类型');
  });

  it('购销方和票种使用当前可见数据下拉选项', () => {
    const schema = useFormSchema(false, {
      buyer_names: ['测试购买方'],
      invoice_types: ['vat-general'],
      seller_names: ['测试销售方'],
    });
    const seller = schema.find((item) => item.fieldName === 'seller_name');
    const buyer = schema.find((item) => item.fieldName === 'buyer_name');
    const type = schema.find((item) => item.fieldName === 'invoice_type');
    expect(seller?.component).toBe('Select');
    expect(buyer?.component).toBe('Select');
    expect(type?.component).toBe('Select');
    expect(seller?.componentProps).toMatchObject({
      options: [{ label: '测试销售方', value: '测试销售方' }],
      showSearch: true,
    });
    expect(type?.componentProps).toMatchObject({
      options: [{ label: '增值税普通发票', value: 'vat-general' }],
    });
  });
});
