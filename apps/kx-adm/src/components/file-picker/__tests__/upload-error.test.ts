import { describe, expect, it } from 'vitest';

import {
  objectStorageErrorMessage,
  uploadErrorMessage,
} from '../internal/upload-error';

describe('upload errors', () => {
  it('extracts TOS XML diagnostics', () => {
    const message = objectStorageErrorMessage(
      403,
      'Forbidden',
      '<Error><Code>SignatureDoesNotMatch</Code><Message>bad signature</Message><RequestId>tos-request</RequestId><HostId>tos-host</HostId></Error>',
    );

    expect(message).toContain('HTTP 403 Forbidden');
    expect(message).toContain('错误码: SignatureDoesNotMatch');
    expect(message).toContain('bad signature');
    expect(message).toContain('RequestId: tos-request');
    expect(message).toContain('HostId: tos-host');
  });

  it('extracts server upload response diagnostics', () => {
    expect(
      uploadErrorMessage({
        response: {
          data: { code: 'storage_write_failed', msg: 'TOS 写入失败' },
          status: 500,
          statusText: 'Internal Server Error',
        },
      }),
    ).toBe(
      'HTTP 500 Internal Server Error；错误码: storage_write_failed；TOS 写入失败',
    );
  });

  it('supports response bodies rethrown by RequestClient', () => {
    expect(
      uploadErrorMessage({ code: 500, msg: '内部错误', request_id: 'req-1' }),
    ).toBe('错误码: 500；内部错误；RequestId: req-1');
  });

  it('removes signed URL query and credential values', () => {
    const message = objectStorageErrorMessage(
      403,
      '',
      'https://tos.example.com/a.txt?X-Tos-Signature=secret Authorization: Bearer secret-token <AccessKeyId>secret-id</AccessKeyId>',
    );

    expect(message).toContain('https://tos.example.com/a.txt');
    expect(message).not.toContain('X-Tos-Signature');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('secret-id');
  });

  it('keeps a directly thrown string error', () => {
    expect(uploadErrorMessage('连接 TOS 失败')).toBe('连接 TOS 失败');
  });
});
