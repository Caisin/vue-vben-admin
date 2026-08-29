import { AxiosHeaders, RequestClient } from '@vben/request';

import { describe, expect, it, vi } from 'vitest';

import {
  addApiSecurityInterceptors,
  addPlaintextHttpSourceInterceptors,
} from './request-security';
import { KxEd } from './transport-ed';

describe('api 请求加密', () => {
  it('开发模式打印加密前请求和解密后响应源数据', async () => {
    const request = {
      app_id: 'admin',
      password: '1q1w1e1r',
      user_name: 'Caisin',
    };
    const responseBody = {
      code: 200,
      msg: 'ok',
      result: { access_token: 'token' },
    };
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = new RequestClient({
      adapter: async (config) => ({
        config,
        data: KxEd.toArrayBuffer(
          KxEd.encryptText(JSON.stringify(responseBody)),
        ),
        headers: new AxiosHeaders({ 'content-type': 'application/json' }),
        status: 200,
        statusText: 'OK',
      }),
    });
    addApiSecurityInterceptors(client);

    await client.post('/auth/user/access_token', request);

    expect(info).toHaveBeenCalledWith(
      '[KX HTTP][encrypted request] POST /auth/user/access_token',
      request,
    );
    expect(info).toHaveBeenCalledWith(
      '[KX HTTP][encrypted response] POST /auth/user/access_token',
      responseBody,
    );
    info.mockRestore();
  });

  it('开发模式打印明文请求和响应源数据', async () => {
    const responseBody = { code: 200, msg: 'ok', result: true };
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = new RequestClient({
      adapter: async (config) => ({
        config,
        data: responseBody,
        headers: new AxiosHeaders({ 'content-type': 'application/json' }),
        status: 200,
        statusText: 'OK',
      }),
    });
    addPlaintextHttpSourceInterceptors(client);

    await client.get('/health');

    expect(info).toHaveBeenCalledWith(
      '[KX HTTP][plaintext request] GET /health',
      undefined,
    );
    expect(info).toHaveBeenCalledWith(
      '[KX HTTP][plaintext response] GET /health',
      responseBody,
    );
    info.mockRestore();
  });

  it('受保护接口始终加密并解密响应', async () => {
    const client = new RequestClient({
      adapter: async (config) => {
        expect(config.headers.get('security')).toBe('true');
        return {
          config,
          data: KxEd.toArrayBuffer(
            KxEd.encryptText('{"code":200,"result":{"id":1},"msg":"ok"}'),
          ),
          headers: new AxiosHeaders({ 'content-type': 'application/json' }),
          status: 200,
          statusText: 'OK',
        };
      },
    });
    addApiSecurityInterceptors(client);

    const response = await client.get('/auth/user/user_info');

    expect(response.data).toEqual({ code: 200, msg: 'ok', result: { id: 1 } });
  });

  it('加密客户端解析进入 handler 前返回的明文 JSON 错误', async () => {
    const errorBody = {
      code: 422,
      msg: '请求参数无效',
      result: null,
    };
    const client = new RequestClient({
      adapter: async (config) => {
        const error = new Error(
          'Request failed with status code 422',
        ) as Error & {
          response: unknown;
        };
        error.response = {
          config,
          data: new TextEncoder().encode(JSON.stringify(errorBody)).buffer,
          headers: new AxiosHeaders({ 'content-type': 'application/json' }),
          status: 422,
          statusText: 'Unprocessable Entity',
        };
        throw error;
      },
    });
    addApiSecurityInterceptors(client);

    await expect(client.post('/software/servers', {})).rejects.toMatchObject(
      errorBody,
    );
  });

  it('加密 JSON 后再交给传输适配器', async () => {
    const request = {
      action: 'privacy.reveal',
      totp_code: '481186',
    };
    let transmittedBody: unknown;
    const client = new RequestClient({
      adapter: async (config) => {
        transmittedBody = config.data;
        const response = JSON.stringify({ code: 200, msg: 'ok', result: true });
        return {
          config,
          data: KxEd.toArrayBuffer(KxEd.encryptText(response)),
          headers: new AxiosHeaders({ 'content-type': 'application/json' }),
          status: 200,
          statusText: 'OK',
        };
      },
    });
    addApiSecurityInterceptors(client);

    const response = await client.post('/auth/user/mfa/step-up', request);

    expect(transmittedBody).toBeInstanceOf(ArrayBuffer);
    expect(
      JSON.parse(KxEd.decodeText(KxEd.decrypt(transmittedBody as ArrayBuffer))),
    ).toEqual(request);
    expect(response.data).toEqual({ code: 200, msg: 'ok', result: true });
  });

  it('区分空请求体和显式 JSON null', async () => {
    const transmittedBodies: unknown[] = [];
    const client = new RequestClient({
      adapter: async (config) => {
        transmittedBodies.push(config.data);
        return {
          config,
          data: KxEd.toArrayBuffer(
            KxEd.encryptText('{"code":200,"result":null,"msg":"ok"}'),
          ),
          headers: new AxiosHeaders({ 'content-type': 'application/json' }),
          status: 200,
          statusText: 'OK',
        };
      },
    });
    addApiSecurityInterceptors(client);

    await client.post('/protected-empty');
    await client.post('/protected-null', null);

    expect(transmittedBodies[0]).toBeUndefined();
    expect(transmittedBodies[1]).toBeInstanceOf(ArrayBuffer);
    expect(
      KxEd.decodeText(KxEd.decrypt(transmittedBodies[1] as ArrayBuffer)),
    ).toBe('null');
  });
});
