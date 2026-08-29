import { describe, expect, it } from 'vitest';

import {
  buildPayloadFromFormValues,
  initialPayloadFormValues,
  payloadFieldsFromExecutor,
  suggestedBizKey,
  validatePayloadFormValues,
} from './schedule-payload';

const orgSyncExecutor = {
  payload_schema: {
    properties: {
      provider: { enum: ['dingtalk', 'feishu'], type: 'string' },
      source_id: { description: '第三方组织数据源标识', type: 'string' },
    },
    required: ['provider', 'source_id'],
    type: 'object',
  },
};

describe('task schedule payload form helpers', () => {
  it('builds org sync payload from typed fields instead of raw JSON', () => {
    const fields = payloadFieldsFromExecutor(orgSyncExecutor);
    const values = initialPayloadFormValues(fields, {});

    expect(fields.map((field) => field.name)).toEqual([
      'provider',
      'source_id',
    ]);
    expect(values.provider).toBe('dingtalk');

    values.source_id = ' corp-main ';
    const payload = buildPayloadFromFormValues(fields, values);

    expect(payload).toEqual({ provider: 'dingtalk', source_id: 'corp-main' });
    expect(suggestedBizKey('auth.org_sync.dingtalk', payload)).toBe(
      'auth.org_sync.dingtalk:corp-main',
    );
  });

  it('rejects missing required schema fields before submit', () => {
    const fields = payloadFieldsFromExecutor(orgSyncExecutor);
    const values = initialPayloadFormValues(fields, {});

    expect(validatePayloadFormValues(fields, values)).toBe('请填写 组织数据源');
  });

  it('stringifies object and array textarea values for editing', () => {
    const fields = payloadFieldsFromExecutor({
      payload_schema: {
        properties: {
          content: { title: '内容对象', type: 'object' },
          contents: { title: '内容列表', type: 'array' },
        },
        type: 'object',
      },
    });

    const values = initialPayloadFormValues(fields, {
      content: { title: 'Hello' },
      contents: [{ id: 1 }, { id: 2 }],
    });

    expect(values.content).toBe(JSON.stringify({ title: 'Hello' }, null, 2));
    expect(values.contents).toBe(
      JSON.stringify([{ id: 1 }, { id: 2 }], null, 2),
    );
    expect(buildPayloadFromFormValues(fields, values)).toEqual({
      content: { title: 'Hello' },
      contents: [{ id: 1 }, { id: 2 }],
    });
  });

  it('drops stale hidden fields when task type changes', () => {
    const fields = payloadFieldsFromExecutor({
      payload_schema: {
        properties: {
          batch_size: { maximum: 500, minimum: 1, type: 'integer' },
        },
        type: 'object',
      },
    });

    const payload = buildPayloadFromFormValues(fields, {
      batch_size: 100,
      provider: 'dingtalk',
      source_id: 'corp-main',
    });

    expect(payload).toEqual({ batch_size: 100 });
  });

  it('uses generated help_msg before legacy description', () => {
    const fields = payloadFieldsFromExecutor({
      payload_schema: {
        properties: {
          batch_size: {
            description: '旧说明',
            help_msg: '单轮扫描最多领取的待发送消息数量',
            type: 'integer',
          },
        },
        type: 'object',
      },
    });

    expect(fields[0]?.help).toBe('单轮扫描最多领取的待发送消息数量');
  });

  it('uses backend x_options labels and renders async option fields as selects', () => {
    const fields = payloadFieldsFromExecutor({
      payload_schema: {
        properties: {
          source_id: {
            title: '组织数据源',
            type: 'string',
            x_options: [
              {
                help_msg: '来源类型：dingtalk',
                label: '企业通讯录（默认） / corp-main',
                value: 'corp-main',
              },
            ],
            x_options_source: true,
          },
        },
        required: ['source_id'],
        type: 'object',
      },
    });

    expect(fields[0]?.component).toBe('select');
    expect(fields[0]?.options).toEqual([
      {
        disabled: undefined,
        help_msg: '来源类型：dingtalk',
        label: '企业通讯录（默认） / corp-main',
        value: 'corp-main',
      },
    ]);
    expect(initialPayloadFormValues(fields, {})).toEqual({
      source_id: 'corp-main',
    });
  });

  it('resets stale select values when refreshed schema no longer exposes them', () => {
    const fields = payloadFieldsFromExecutor({
      payload_schema: {
        properties: {
          source_id: {
            title: '组织数据源',
            type: 'string',
            x_options: [
              { label: '飞书默认 / feishu-main', value: 'feishu-main' },
            ],
            x_options_source: true,
          },
        },
        required: ['source_id'],
        type: 'object',
      },
    });

    expect(
      initialPayloadFormValues(fields, { source_id: 'dingtalk-main' }),
    ).toEqual({ source_id: 'feishu-main' });
  });

  it('suggests business keys for built-in task templates after payload editing', () => {
    expect(suggestedBizKey('asset_pay_order_refund', { order_id: 9 })).toBe(
      'order:9',
    );
    expect(
      suggestedBizKey('res_push_dispatch', {
        campaign_id: 3,
        channel_id: 5,
      }),
    ).toBe('campaign:3:channel:5');
    expect(
      suggestedBizKey('auth.weekly_report.publish_dingtalk', {
        channel_id: 8,
        dept_id: 2,
        knowledge_target_id: 7,
        report_date: '2026-08-03',
        week_no: 1,
      }),
    ).toBe('weekly_report:dingtalk:2:2026-08-03:1:7:8');
  });
});
