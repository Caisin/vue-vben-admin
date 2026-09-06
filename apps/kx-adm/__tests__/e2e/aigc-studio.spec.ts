import type { Request, Route } from '@playwright/test';

import type {
  StudioKind,
  StudioRun,
  StudioSession,
} from '../../src/api/aigc-gateway/studio';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
for (const kind of ['chat', 'image', 'video'] as const) {
  for (const readonly of [false, true]) {
    test(`${kind} 创作与${readonly ? '只读' : '操作'}闭环`, async ({
      page,
    }, info) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const sessions: StudioSession[] = [
        {
          id: 1,
          kind,
          title: '历史创作',
          version: 1,
          updated_at: 1_788_700_000,
        },
      ];
      const records: StudioRun[] = [];
      const submitted: Record<string, unknown>[] = [];
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZFoAAAAASUVORK5CYII=',
        'base64',
      );
      const video =
        kind === 'video'
          ? Buffer.from(
              await page.evaluate(async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('canvas unavailable');
                ctx.fillStyle = '#416864';
                ctx.fillRect(0, 0, 320, 180);
                ctx.fillStyle = '#ffffff';
                ctx.font = '22px sans-serif';
                ctx.fillText('AIGC video test', 70, 95);
                const recorder = new MediaRecorder(canvas.captureStream(10), {
                  mimeType: 'video/webm',
                });
                const chunks: Blob[] = [];
                recorder.ondataavailable = (event) => chunks.push(event.data);
                const done = new Promise<number[]>((resolve) => {
                  recorder.onstop = async () =>
                    resolve([
                      ...new Uint8Array(await new Blob(chunks).arrayBuffer()),
                    ]);
                });
                recorder.start();
                setTimeout(() => recorder.stop(), 300);
                return done;
              }),
            )
          : png;
      await page
        .context()
        .route('**/{auth,notify,param,adm,storage,aigc}/**', async (route) => {
          if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
            await route.continue();
            return;
          }
          const path = new URL(route.request().url()).pathname.replace(
            /^\/api(?=\/)/,
            '',
          );
          const method = route.request().method();
          let result: unknown = null;
          if (path === '/auth/user/access_token')
            result = {
              access_token: 'test-token',
              token_type: 'Bearer',
              uid: 7,
              exp_at: 4_102_444_800,
              exp_in: 3600,
            };
          else if (path === '/auth/user/user_info')
            result = {
              id: 7,
              name: '创作用户',
              enabled: true,
              home_path: `/aigc-gateway/${kind}`,
              avatar: '',
              permission_count: 1,
              is_guest: false,
            };
          else if (path === '/auth/per/codes')
            result = readonly ? [] : ['aigc:studio-write'];
          else if (path === '/auth/menu/current') result = menus(kind);
          else if (path === '/notify/inbox')
            result = { items: [], unread_count: 0 };
          else if (path === '/aigc/studio/models')
            result = [
              {
                id: 1,
                name: '创作模型',
                provider: '测试供应商',
                protocol: 'gemini',
                capabilities: [kind, 'input_image', 'input_video'],
                input_price: '1',
                output_price: '2',
              },
            ];
          else if (path === '/aigc/studio/storage-options')
            result = [
              {
                code: 'private',
                storage_name: '创作私有存储',
                storage_type: 'fs',
              },
            ];
          else if (path === '/aigc/studio/sessions' && method === 'GET')
            result = sessions.filter((session) =>
              session.title.includes(
                new URL(route.request().url()).searchParams.get('keyword') ??
                  '',
              ),
            );
          else if (path === '/aigc/studio/sessions' && method === 'POST') {
            const req = body(route.request());
            const session = {
              id: sessions.length + 1,
              kind,
              title: req.title,
              version: 1,
              updated_at: 1_788_700_000,
            };
            sessions.push(session);
            result = session;
          } else if (/\/sessions\/\d+$/.test(path)) {
            const id = path.split('/').at(-1);
            const session = sessions.find((item) => String(item.id) === id);
            if (method === 'PUT' && session) {
              session.title = body(route.request()).title;
              session.version++;
            }
            if (method === 'DELETE') {
              const index = sessions.findIndex(
                (item) => String(item.id) === id,
              );
              sessions.splice(index, 1);
            }
            result = session;
          } else if (/\/sessions\/\d+\/runs$/.test(path)) {
            const id = path.split('/').at(-2);
            if (method === 'POST') {
              const req = body(route.request());
              submitted.push(req);
              const row: StudioRun = {
                id: records.length + 1,
                session_id: Number(id),
                route_id: 1,
                upstream_model: '创作模型',
                upstream_id: kind === 'video' ? 'video-original' : '',
                state: 'running',
                input: { kind, protocol: 'gemini', request: req },
                output_text: '',
                output_files: [],
                progress: 20,
                error_code: '',
                cancel_requested: false,
                usage: {},
                created_at: 1_788_700_000,
              };
              records.unshift(row);
              result = row;
              const session = sessions.find((item) => String(item.id) === id);
              if (session) session.version++;
            } else {
              records.forEach((row) => {
                if (row.state === 'running' && !row.cancel_requested) {
                  row.state = 'succeeded';
                  row.progress = 100;
                  row.output_text =
                    kind === 'chat'
                      ? '# 回答\n\n**已读取素材**\n\n```rust\nfn main() {}\n```\n\n<script>alert(1)</script>'
                      : '';
                  row.output_files = kind === 'chat' ? [] : [10];
                  row.usage = { total_tokens: 5 };
                }
              });
              result = records.filter((row) => String(row.session_id) === id);
            }
          } else if (path === '/storage/file/upload/private') {
            expect(route.request().headers()['content-type']).toContain(
              'multipart/form-data',
            );
            result = [
              {
                file: file(9, kind === 'video' ? 'input.webm' : 'input.png'),
                url: '/storage/file/content/9',
              },
            ];
          } else if (path === '/storage/file')
            result = {
              items: [file(9, 'input.png')],
              total: 1,
              page: 1,
              page_size: 20,
            };
          else if (/\/storage\/file\/\d+$/.test(path))
            result = file(
              Number(path.split('/').at(-1)),
              kind === 'video' ? 'result.webm' : 'result.png',
            );
          else if (/\/storage\/file\/url\/\d+$/.test(path))
            result = `/storage/file/content/${path.split('/').at(-1)}`;
          else if (path === '/storage/file/urls')
            result = body(route.request()).map((id: number) => ({
              file_id: id,
              name: 'input.png',
              url: `/storage/file/content/${id}`,
            }));
          else if (/\/storage\/file\/content\/\d+$/.test(path)) {
            await route.fulfill({
              body: kind === 'video' ? video : png,
              contentType: kind === 'video' ? 'video/webm' : 'image/png',
            });
            return;
          }
          await fulfill(route, result);
        });
      await page.goto('/');
      await page.locator("input[name='username']").fill('creator');
      await page.locator("input[name='password']").fill('test-only');
      await page.getByRole('button', { name: /登录|login/i }).click();
      await expect(page).toHaveURL(new RegExp(`/aigc-gateway/${kind}`), {
        timeout: 30_000,
      });
      await expect(
        page.getByRole('button', { name: /历史创作/ }),
      ).toBeVisible();
      if (readonly) {
        await expect(
          page.getByRole('textbox', { name: '创作内容' }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: '添加素材' }),
        ).toHaveCount(0);
      } else {
        await page.getByRole('button', { name: /历史创作/ }).click();
        await page.getByRole('button', { name: '添加素材' }).click();
        const picker = page.getByRole('dialog', { name: '选择文件' });
        await expect(picker).toBeVisible();
        await expect(
          picker.getByRole('button', { name: 'URL 转存' }),
        ).toHaveCount(0);
        await picker
          .locator('input[type="file"]')
          .first()
          .setInputFiles({
            name: kind === 'video' ? 'input.webm' : 'input.png',
            mimeType: kind === 'video' ? 'video/webm' : 'image/png',
            buffer: kind === 'video' ? video : png,
          });
        await expect(page.getByText('上传成功', { exact: true })).toBeVisible();
        await picker.getByRole('button', { name: /确\s*[认定]/ }).click();
        await expect(picker).toBeHidden();
        await page
          .getByRole('textbox', { name: '创作内容' })
          .fill('根据素材完成创作');
        await page
          .getByRole('button', {
            name: kind === 'chat' ? '发送' : '生成',
            exact: true,
          })
          .click();
        await expect(page.locator('[data-run-id="1"]')).toContainText('已完成');
        expect(submitted).toHaveLength(1);
        expect(submitted[0]?.file_ids).toEqual([9]);
        if (kind === 'chat') {
          await expect(
            page.getByRole('heading', { name: '回答', exact: true }),
          ).toBeVisible();
          await expect(page.locator('.studio-markdown script')).toHaveCount(0);
          await expect(page.locator('.studio-markdown code')).toContainText(
            'fn main',
          );
        } else {
          await expect(
            page.getByRole('button', { name: '下载原文件' }),
          ).toBeVisible();
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: '下载原文件' }).click();
          const artifact = await download;
          expect(artifact.suggestedFilename()).toMatch(/result\.(png|webm)/);
          await (kind === 'video'
            ? expect
                .poll(() =>
                  page
                    .locator('.result-file video')
                    .evaluate((video) => video.readyState),
                )
                .toBeGreaterThan(0)
            : expect
                .poll(() =>
                  page
                    .locator('.result-file img')
                    .evaluate((image) => image.naturalWidth),
                )
                .toBeGreaterThan(0));
        }
        await page
          .getByRole('button', { name: '重新生成', exact: true })
          .click();
        await expect.poll(() => submitted.length).toBe(2);
        expect(submitted[0]?.request_key).not.toBe(submitted[1]?.request_key);
        if (kind === 'chat') expect(submitted[1]?.regenerate_from).toBe(1);
        await page.getByRole('button', { name: '重命名会话' }).click();
        await page
          .getByRole('textbox', { name: '会话名称' })
          .fill('商业创作测试');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /确\s*定|OK/ })
          .click();
        await expect(
          page.getByRole('heading', { name: '商业创作测试' }),
        ).toBeVisible();
        await expect(
          page.getByRole('dialog', { name: '重命名会话' }),
        ).toBeHidden();
      }
      for (const width of [1440, 390]) {
        if (width === 390) {
          await page.locator('[data-layout-action="toggle-sidebar"]').click();
          await expect(
            page.getByRole('menuitem', { name: '聊天', exact: true }),
          ).not.toBeInViewport();
        }
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByText('登录成功', { exact: true })).toBeHidden({
          timeout: 10_000,
        });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        if (!readonly)
          await expect(
            page.getByRole('button', {
              name: kind === 'chat' ? '发送' : '生成',
              exact: true,
            }),
          ).toBeInViewport({ ratio: 1 });
        await page.screenshot({
          path: info.outputPath(
            `${kind}-${readonly ? 'readonly' : 'write'}-${width}.png`,
          ),
          fullPage: true,
        });
        if (width === 390 && !readonly) {
          await page
            .getByRole('button', { name: '生成参数', exact: true })
            .click();
          await expect(
            page.getByRole('combobox', { name: /私有存储/ }),
          ).toBeInViewport({ ratio: 1 });
          await page.screenshot({
            path: info.outputPath(`${kind}-settings-mobile.png`),
            fullPage: true,
          });
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
function file(id: number, name: string) {
  return {
    file_id: id,
    file_name: name.split('.')[0],
    file_ext: name.split('.').at(-1),
    size: 100,
    storage_code: 'private',
    storage_type: 'fs',
    key: name,
    md5_hash: 'fixture',
    created_by: 7,
    created_at: 1_788_700_000,
  };
}
function menus(kind: StudioKind) {
  return [
    {
      id: 1,
      pid: 0,
      name: 'AigcGateway',
      title: 'AIGC',
      path: '/aigc-gateway',
      component: 'BasicLayout',
      perm_type: 'catalog',
      enabled: true,
      order_no: 1,
      auth_code: '',
      meta: {},
      redirect: `/aigc-gateway/${kind}`,
    },
    ...(['chat', 'image', 'video'] as const).map((item, index) => ({
      id: index + 2,
      pid: 1,
      name: `Aigc${item}`,
      title: { chat: '聊天', image: '图片创作', video: '视频创作' }[item],
      path: `/aigc-gateway/${item}`,
      component: `/aigc-gateway/${item}`,
      perm_type: 'menu',
      enabled: true,
      order_no: index + 1,
      auth_code: '',
      meta: {},
      redirect: null,
    })),
  ];
}
async function fulfill(route: Route, result: unknown) {
  const text = JSON.stringify({ code: 200, msg: 'ok', result });
  await route.fulfill({
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(text))
        : text,
    contentType: 'application/json',
  });
}
function body(request: Request) {
  const data = request.postDataBuffer();
  if (!data) throw new Error('missing body');
  return JSON.parse(KxEd.decodeText(KxEd.decrypt(data)));
}
