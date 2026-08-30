import type { CredentialProfileSpec } from '#/api/credential';

import { describe, expect, it } from 'vitest';

import { profileOptions } from '../../src/views/credential/items/data';

const profiles = [
  {
    allowed_headers: [],
    fields: [],
    kind: 'username_password',
    label: '通用账号密码',
    profile: 'generic',
  },
  {
    allowed_headers: [],
    fields: [],
    kind: 'password',
    label: '通用密码',
    profile: 'generic',
  },
] satisfies CredentialProfileSpec[];

describe('credential profile filter options', () => {
  it('keeps kind context when the kind filter is empty', () => {
    expect(profileOptions(profiles)).toEqual([
      {
        label: '账号密码 / 通用账号密码',
        value: 'username_password:generic',
      },
      { label: '密码 / 通用密码', value: 'password:generic' },
    ]);
  });

  it('cascades profile choices from the selected kind', () => {
    expect(profileOptions(profiles, 'password')).toEqual([
      { label: '通用密码', value: 'password:generic' },
    ]);
  });
});
