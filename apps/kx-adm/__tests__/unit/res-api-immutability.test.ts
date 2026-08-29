import { describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const get = vi.fn();

vi.mock('../../src/api/request', () => ({
  requestClient: { delete: vi.fn(), get, post, put: vi.fn(), upload: vi.fn() },
}));

describe('res legacy API fixes', () => {
  it('does not mutate language price payloads', async () => {
    const { postLangPrice } =
      await import('../../src/api/res/seas/global/source_manage');
    const data = { lang: [null], res_id: 1 };
    post.mockResolvedValueOnce({});
    await postLangPrice(data);
    expect(data.lang).toEqual([null]);
    expect(post).toHaveBeenCalledWith(
      '/adm/res/set_price_lang',
      { lang: [], res_id: 1 },
      { params: undefined },
    );
  });

  it('does not delete id from coin order query params', async () => {
    const { getCoinOrderList } =
      await import('../../src/api/res/seas/global/source_manage');
    const params = { id: 7, page: 2, size: 20 };
    get.mockResolvedValueOnce({});
    await getCoinOrderList(params);
    expect(params).toEqual({ id: 7, page: 2, size: 20 });
    expect(get).toHaveBeenCalledWith('/adm/res_price/orders/7', {
      params: { page: 2, size: 20 },
    });
  });
});
