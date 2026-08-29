import { describe, expect, it } from 'vitest';

import {
  adminPasswordLoginRequest,
  normalizeAdminCurrentUser,
  toVbenUserInfo,
} from './auth';

describe('admin password login request', () => {
  it('targets the admin login application used by product seeds', () => {
    expect(adminPasswordLoginRequest('Caisin', '1q1w1e1r')).toEqual({
      app_id: 'admin',
      login_type: 'user_name',
      password: '1q1w1e1r',
      user_name: 'Caisin',
    });
  });
});

describe('admin current user adapter', () => {
  const currentUser = {
    avatar: '',
    email: 'admin@example.com',
    enabled: true,
    id: 1,
    name: '系统管理员',
    tel: '',
  };

  it('normalizes optional profile fields for shared account pages', () => {
    expect(normalizeAdminCurrentUser(currentUser)).toMatchObject({
      dept_id: 0,
      dept_name: null,
      home_path: '',
      is_guest: false,
      permission_count: 0,
      roles: [],
    });
  });

  it('accepts the minimal current-user response without roles or home path', () => {
    expect(toVbenUserInfo(currentUser)).toEqual({
      avatar: '',
      desc: 'admin@example.com',
      homePath: '',
      realName: '系统管理员',
      roles: [],
      token: '',
      userId: '1',
      username: '系统管理员',
    });
  });

  it.each(['/overview', '/override'])(
    'ignores the removed legacy home path %s',
    (home_path) => {
      expect(normalizeAdminCurrentUser({ ...currentUser, home_path })).toEqual(
        expect.objectContaining({ home_path: '' }),
      );
    },
  );
});
