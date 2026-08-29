import { describe, expect, it } from 'vitest';

import {
  editableNotifyPayload,
  editableNotifyPayloadObject,
} from './editable-payload';

describe('editable notify payload', () => {
  it('removes credential fields and masked mobiles recursively', () => {
    expect(
      editableNotifyPayload({
        at_mobiles: ['138****0000', '13912340000'],
        nested: {
          access_token: '[REDACTED]',
          atMobiles: ['137****0000'],
          label: '保留内容',
        },
        password: '[REDACTED]',
      }),
    ).toEqual({
      at_mobiles: ['13912340000'],
      nested: {
        atMobiles: [],
        label: '保留内容',
      },
    });
  });

  it('normalizes non-object payloads to an editable object', () => {
    expect(editableNotifyPayloadObject(['value'])).toEqual({});
    expect(editableNotifyPayloadObject(null)).toEqual({});
  });
});
