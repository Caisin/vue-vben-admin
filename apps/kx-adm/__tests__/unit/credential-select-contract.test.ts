import type { CredentialView } from '#/api/credential';

import { describe, expect, it } from 'vitest';

import { formModelPropNameMap } from '../../src/adapter/form';
import { credentialSelectOptions } from '../../src/components/credential/credential-select-options';

describe('credential select contract', () => {
  it('uses the model prop expected by the custom component', () => {
    expect(formModelPropNameMap.CredentialSelect).toBe('modelValue');
  });

  it('maps credential responses to Ant Select label and value fields', () => {
    const credential = {
      code: 'ak-9r7xGfYz',
      kind: 'access_key',
      name: '凯雪钉钉',
    } as CredentialView;

    expect(credentialSelectOptions([credential])).toEqual([
      {
        label: '凯雪钉钉 · 访问密钥 (ak-9r7xGfYz)',
        value: 'ak-9r7xGfYz',
      },
    ]);
  });
});
