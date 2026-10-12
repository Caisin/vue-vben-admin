import type { SystemMenu } from '#/api/system/menu';

import { describe, expect, it } from 'vitest';

import {
  buildPermissionGrantTree,
  filterGrantTreeByIds,
  filterPermissionGrantTree,
  mergeVisibleGrantSelection,
} from './tree';

describe('permission grant trees', () => {
  it('only shows assignable backend APIs and preserves API-free domain capabilities', () => {
    const node: SystemMenu = {
      id: 'root',
      pid: '0',
      name: 'System',
      type: 'catalog',
      status: 1,
      path: '/system',
      authCode: '',
      meta: { title: '后台' },
    };
    const menus = [
      {
        ...node,
        children: [
          { ...node, id: 'backend', type: 'button' as const, apiIds: ['1'] },
          { ...node, id: 'client', type: 'button' as const, apiIds: ['2'] },
          { ...node, id: 'mixed', type: 'button' as const, apiIds: ['1', '2'] },
          { ...node, id: 'domain', type: 'button' as const, apiIds: [] },
        ],
      },
    ];
    const tree = buildPermissionGrantTree(
      menus,
      [{ id: 1, api_code: 'app.looking.but.backend' }],
      true,
    );
    expect(tree[0]?.children?.map((child) => child.id)).toEqual([
      'backend',
      'mixed',
      'domain',
    ]);
    expect(
      tree[0]?.children?.find((child) => child.id === 'mixed')?.apiIds,
    ).toEqual(['1']);
    expect(
      buildPermissionGrantTree(
        [
          {
            ...node,
            children: [
              { ...node, id: 'client', type: 'button', apiIds: ['2'] },
            ],
          },
        ],
        [],
        true,
      ),
    ).toEqual([]);
  });
  it('finds real workflow buttons by a missing dependency API code', () => {
    const menus = [
      {
        id: '1',
        pid: '0',
        name: 'Publish',
        type: 'button',
        status: 1,
        path: '',
        authCode: 'article:publish',
        meta: { title: '发布文章' },
        apiIds: ['8', '9'],
      },
    ] satisfies SystemMenu[];
    const tree = buildPermissionGrantTree(menus, [
      { id: 8, api_code: 'article.publish' },
      { id: 9, api_code: 'article.release.detail' },
    ]);
    expect(
      filterPermissionGrantTree(tree, 'api:article.release.detail').map(
        (n) => n.id,
      ),
    ).toEqual(['1']);
    expect(
      filterPermissionGrantTree(tree, 'article.release.detail').map(
        (n) => n.id,
      ),
    ).toEqual(['1']);
    expect(filterPermissionGrantTree(tree, 'api:article.delete')).toEqual([]);
  });
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

describe('menu function assignment', () => {
  it('makes catalogs structural and keeps API bindings on functional nodes', () => {
    const nodes = buildPermissionGrantTree([
      {
        id: '1',
        pid: '0',
        name: 'Catalog',
        meta: { title: '目录' },
        authCode: '',
        path: '/catalog',
        type: 'catalog',
        status: 1,
        children: [
          {
            id: '2',
            pid: '1',
            name: 'Page',
            meta: { title: '页面' },
            authCode: '',
            path: '/page',
            type: 'menu',
            status: 1,
            apiIds: ['7'],
          },
        ],
      },
    ]);
    expect(nodes[0]?.disabled).toBe(true);
    expect(nodes[0]?.children?.[0]?.apiIds).toEqual(['7']);
  });
  it('can revoke a searched selection without changing hidden grants', () => {
    const visible = [
      { id: '1', kind: 'permission', label: '页面', searchText: '页面' },
    ] as const;
    expect(mergeVisibleGrantSelection(['1', '2'], [], visible)).toEqual(['2']);
  });
  it('does not offer retired aggregate permissions for assignment', () => {
    const nodes = buildPermissionGrantTree([
      {
        id: 'legacy',
        pid: '0',
        name: 'LegacyManage',
        type: 'button',
        status: 0,
        meta: { title: '旧管理', permission_tree_retired: true },
        authCode: 'old:manage',
        path: '',
      },
    ]);
    expect(nodes).toEqual([]);
  });
});
