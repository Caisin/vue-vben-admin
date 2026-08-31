import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const apiRoot = dirname(fileURLToPath(import.meta.url));
const requestCallPattern =
  /(requestClient|encryptedRequestClient|plaintextRequestClient)\.(?:get|post|put|delete|patch|upload|download|requestSSE)(?:<[\s\S]*?>)?\(\s*([`'"])([\s\S]*?)\2/g;

const preSessionEncryptedPaths = new Set([
  '/auth/dt/apps',
  '/auth/dt/exchange',
  '/auth/user/access_token',
  '/auth/user/mfa/login',
  '/auth/user/refresh_token',
  '/param/system-settings/public',
]);

const plaintextPathPatterns = [
  /^\/import-export\/exports\/.+\/runs\/.+\/file$/,
  /^\/import-export\/imports\/.+\/(?:runs|template)$/,
  /^\/import-export\/runs\/.+\/files\/(?:errors|input|result|\$\{kind\})$/,
  /^\/invoice\/exports\/.+\/content$/,
  /^\/invoice\/files(?:\/.+\/content)?$/,
  /^\/invoice\/imports\/.+\/events$/,
  /^\/storage\/file\/(?:content\/.+|upload\/local_private)$/,
];

function collectApiFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectApiFiles(path);
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return [];
    return [path];
  });
}

function collectRequestCalls() {
  return collectApiFiles(apiRoot).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(requestCallPattern)].map((match) => ({
      client: match[1] ?? '',
      file,
      path: match[3] ?? '',
    }));
  });
}

describe('api 路径规范', () => {
  it('requestClient API 路径不以尾斜杠结尾', () => {
    const violations = collectRequestCalls()
      .filter(
        ({ path }) =>
          path.startsWith('/') && path.length > 1 && path.endsWith('/'),
      )
      .map(({ file, path }) => `${relative(apiRoot, file)}: ${path}`);

    expect(violations).toEqual([]);
  });

  it('登录前可调用的加密 API 使用独立加密客户端', () => {
    const violations = collectRequestCalls()
      .filter(
        ({ client, path }) =>
          preSessionEncryptedPaths.has(path) &&
          client !== 'encryptedRequestClient',
      )
      .map(
        ({ client, file, path }) =>
          `${relative(apiRoot, file)}: ${client} ${path}`,
      );

    expect(violations).toEqual([]);
  });

  it('明文客户端只调用显式明文 API', () => {
    const violations = collectRequestCalls()
      .filter(
        ({ client, path }) =>
          client === 'plaintextRequestClient' &&
          !plaintextPathPatterns.some((pattern) => pattern.test(path)),
      )
      .map(({ file, path }) => `${relative(apiRoot, file)}: ${path}`);

    expect(violations).toEqual([]);
  });

  it('不再调用已移除的 baseline API', () => {
    const violations = collectRequestCalls()
      .filter(
        ({ path }) => path === '/baseline' || path.startsWith('/baseline/'),
      )
      .map(({ file, path }) => `${relative(apiRoot, file)}: ${path}`);

    expect(violations).toEqual([]);
  });
});
