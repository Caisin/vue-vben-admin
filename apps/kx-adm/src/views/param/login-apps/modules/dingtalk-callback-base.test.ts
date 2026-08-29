import { describe, expect, it } from 'vitest';

import {
  buildDingtalkCallbackBase,
  hasDingtalkCallbackBase,
} from './dingtalk-callback-base';

describe('buildDingtalkCallbackBase', () => {
  it('uses the current origin for a relative API prefix', () => {
    expect(buildDingtalkCallbackBase('/api', 'https://adm.example')).toBe(
      'https://adm.example/api/auth/dt/callback',
    );
  });

  it('keeps an absolute API origin', () => {
    expect(
      buildDingtalkCallbackBase(
        'https://api.example/base/',
        'https://adm.example',
      ),
    ).toBe('https://api.example/base/auth/dt/callback');
  });

  it('treats an empty callback as not configured', () => {
    expect(hasDingtalkCallbackBase('')).toBe(false);
    expect(hasDingtalkCallbackBase('   ')).toBe(false);
    expect(
      hasDingtalkCallbackBase('https://adm.example/api/auth/dt/callback'),
    ).toBe(true);
  });
});
