import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';

import { describe, expect, it } from 'vitest';

import {
  homePageOptions,
  homePageOptionValues,
  userEffectivePermissionIds,
} from './home-page-options';

const menus: SystemMenu[] = [
  {
    authCode: '',
    children: [
      {
        authCode: '',
        id: '2',
        meta: { title: '用户管理' },
        name: 'Users',
        path: '/system/user',
        pid: '1',
        status: 1,
        type: 'menu',
      },
      {
        authCode: '',
        id: '3',
        meta: { title: '外链' },
        name: 'External',
        path: 'https://example.com',
        pid: '1',
        status: 1,
        type: 'link',
      },
      {
        authCode: '',
        id: '4',
        meta: { title: '停用页面' },
        name: 'Disabled',
        path: '/disabled',
        pid: '1',
        status: 0,
        type: 'embedded',
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
];

describe('default home page options', () => {
  it('只保留已授权且启用的可导航页面', () => {
    const options = homePageOptions(menus, ['2', '3', '4']);
    expect(options).toEqual([
      {
        children: [
          {
            label: '用户管理（/system/user）',
            value: '2',
          },
        ],
        label: '系统管理',
        selectable: false,
        value: 'group:1',
      },
    ]);
    expect([...homePageOptionValues(options)]).toEqual(['2']);
  });

  it('合并直接权限与已选择启用角色的权限', () => {
    const roles: SystemRole[] = [
      {
        id: 'enabled',
        name: '启用角色',
        permissions: ['2'],
        status: 1,
      },
      {
        id: 'disabled',
        name: '停用角色',
        permissions: ['3'],
        status: 0,
      },
    ];

    expect([
      ...userEffectivePermissionIds(['1'], ['enabled', 'disabled'], roles),
    ]).toEqual(['1', '2']);
  });
});
