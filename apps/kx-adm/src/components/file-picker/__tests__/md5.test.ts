import { describe, expect, it } from 'vitest';

import { md5ArrayBuffer } from '../internal/md5';

function bytes(value: string) {
  return new TextEncoder().encode(value).buffer;
}

describe('browser md5 helper', () => {
  it('matches standard md5 vectors', () => {
    expect(md5ArrayBuffer(bytes(''))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5ArrayBuffer(bytes('abc'))).toBe(
      '900150983cd24fb0d6963f7d28e17f72',
    );
    expect(md5ArrayBuffer(bytes('message digest'))).toBe(
      'f96b697d7cb7938d525a2f31aaf161d0',
    );
  });
});
