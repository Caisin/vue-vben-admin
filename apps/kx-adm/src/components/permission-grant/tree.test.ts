import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';

import { describe, expect, it } from 'vitest';

import {
  buildApiGrantTree,
  buildPermissionGrantTree,
  buildUnboundApiGrantTree,
  filterGrantTreeByIds,
  filterPermissionGrantTree,
  mergeSearchedGrantSelection,
  mergeVisibleGrantSelection,
} from './tree';

describe('permission grant trees', () => {
  it('keeps menu ancestors while filtering descendants', () => {
    const menus = [
      {
        authCode: '',
        children: [
          {
            authCode: 'user:write',
            id: '2',
            meta: { title: '用户编辑' },
            name: 'UserEdit',
            path: '/system/user/edit',
            pid: '1',
            status: 1,
            type: 'button',
          },
        ],
        id: '1',
        meta: { title: '系统管理' },
        name: 'System',
        path: '/system',
        pid: '0',
        status: 1,
        type: 'catalog',
      },
    ] satisfies SystemMenu[];

    const filtered = filterPermissionGrantTree(
      buildPermissionGrantTree(menus),
      'user:write',
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
    expect(filtered[0]?.children?.map((item) => item.id)).toEqual(['2']);
  });

  it('groups only enabled non-public APIs without a menu binding', () => {
    const base = {
      access_mode: 'custom',
      api_code: '/auth/demo;GET',
      api_key: 'demo',
      api_method: 'GET',
      api_name: '示例 API',
      api_path: '/auth/demo',
      auth_exempt: false,
      client_scope: 'backend',
      cfg_hash: '',
      created_at: 0,
      enabled: true,
      id: 7,
      menu_perm_id: 0,
      operation_type: 'detail',
      permission_count: 0,
      permission_ids: [],
      security_exempt: false,
      updated_at: 0,
    } satisfies ApiPermission;
    const tree = buildUnboundApiGrantTree([
      base,
      { ...base, id: 8, menu_perm_id: 20 },
      { ...base, auth_exempt: true, id: 9 },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe('/auth');
    expect(tree[0]?.children?.map((item) => item.id)).toEqual(['7']);
  });

  it('can include enabled non-public APIs that already have menu bindings', () => {
    const base = {
      access_mode: 'menu',
      api_code: '/auth/demo;GET',
      api_key: 'demo',
      api_method: 'GET',
      api_name: '示例 API',
      api_path: '/auth/demo',
      auth_exempt: false,
      client_scope: 'backend',
      cfg_hash: '',
      created_at: 0,
      enabled: true,
      id: 7,
      menu_perm_id: 20,
      operation_type: 'detail',
      permission_count: 0,
      permission_ids: [],
      security_exempt: false,
      updated_at: 0,
    } satisfies ApiPermission;

    const tree = buildApiGrantTree(
      [
        base,
        { ...base, auth_exempt: true, id: 8 },
        { ...base, enabled: false, id: 9 },
      ],
      { includeBound: true },
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children?.map((item) => item.id)).toEqual(['7']);
  });

  it('keeps hidden selections while updating filtered tree nodes', () => {
    const visibleNodes = [
      {
        id: '1',
        kind: 'permission',
        label: '可见权限',
        searchText: '可见权限',
      },
    ] as const;

    expect(mergeVisibleGrantSelection(['1', '2'], [], visibleNodes)).toEqual([
      '2',
    ]);
    expect(mergeVisibleGrantSelection(['2'], [1, '1'], visibleNodes)).toEqual([
      '2',
      '1',
    ]);
  });

  it('only adds grants while selecting search results', () => {
    expect(mergeSearchedGrantSelection(['1', '2'], ['3'])).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(mergeSearchedGrantSelection(['1', '2'], [])).toEqual(['1', '2']);
  });

  it('keeps selected grants and their ancestors in readonly trees', () => {
    const nodes = buildPermissionGrantTree([
      {
        authCode: '',
        children: [
          {
            authCode: 'storage.file_share.*',
            id: '2',
            meta: { title: '文件分享' },
            name: 'StorageFileShares',
            path: '/storage/shares',
            pid: '1',
            status: 1,
            type: 'menu',
          },
        ],
        id: '1',
        meta: { title: '存储管理' },
        name: 'Storage',
        path: '/storage',
        pid: '0',
        status: 1,
        type: 'catalog',
      },
    ] satisfies SystemMenu[]);

    expect(filterGrantTreeByIds(nodes, ['2'])).toMatchObject([
      {
        children: [{ id: '2', label: '文件分享' }],
        id: '1',
        label: '存储管理',
      },
    ]);
  });

  it('keeps parent menu selection independent from sensitive child buttons', () => {
    const nodes = buildPermissionGrantTree([
      {
        authCode: '',
        children: [
          {
            authCode: 'sim_cards:view-all',
            id: '12',
            meta: { title: '查看全部号码' },
            name: 'MsgSimCardsViewAll',
            path: '',
            pid: '11',
            status: 1,
            type: 'button',
          },
        ],
        id: '11',
        meta: { title: '电话卡管理' },
        name: 'MsgSimCards',
        path: 'sim-cards',
        pid: '10',
        status: 1,
        type: 'menu',
      },
    ] satisfies SystemMenu[]);

    expect(mergeVisibleGrantSelection([], ['11'], nodes)).toEqual(['11']);
    expect(mergeVisibleGrantSelection([], ['12'], nodes)).toEqual(['12']);
  });
});
