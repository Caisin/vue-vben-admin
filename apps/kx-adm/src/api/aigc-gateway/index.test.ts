import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AigcGatewayApi } from './index';

const { post, put } = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }));

vi.mock('#/api/request', () => ({ requestClient: { post, put } }));

const group = {
  code: 'test-group',
  name: '测试分组',
  priority: 0,
  load_strategy: 'priority',
  enabled: true,
};
const provider = {
  group_id: 1,
  code: 'test-provider',
  name: '测试供应商',
  protocol: 'openai',
  base_url: 'https://example.com/v1',
  credential_code: 'credential-ref',
  priority: 0,
  weight: 1,
  enabled: true,
  fail_threshold: 3,
  open_duration_secs: 30,
  breaker_statuses: [401, 429],
};
const model = {
  provider_id: 2,
  canonical_model: 'test-model',
  upstream_model: 'upstream-model',
  aliases: ['alias'],
  capabilities: ['chat', 'input_image'],
  input_price: '1',
  output_price: '2',
  enabled: true,
};

describe('网关写入 DTO', () => {
  beforeEach(() => vi.clearAllMocks());

  function checkWrite<T>(
    name: string,
    path: string,
    write: T,
    save: (data: T, id?: number | string) => Promise<unknown>,
  ) {
    it(`${name} 编辑和编辑后新建只发送可写字段，不修改原始记录`, async () => {
      const record = {
        ...write,
        id: '9007199254740993',
        created_at: 123,
        updated_at: 456,
      };
      const original = structuredClone(record);
      await save(record, record.id);
      expect(put).toHaveBeenLastCalledWith(
        `/aigc/admin/${path}/${record.id}`,
        write,
      );
      await save(record);
      expect(post).toHaveBeenLastCalledWith(`/aigc/admin/${path}`, write);
      expect(record).toEqual(original);
    });
  }
  checkWrite('分组', 'groups', group, AigcGatewayApi.saveGroup);
  checkWrite('供应商', 'providers', provider, AigcGatewayApi.saveProvider);
  checkWrite('模型路由', 'models', model, AigcGatewayApi.saveModel);
});
