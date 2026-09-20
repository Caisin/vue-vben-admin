import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
for (const [kind, label, nativeMode = false] of [
  ['drama', '短剧'],
  ['novel', '小说'],
  ['script', '剧本'],
  ['drama', '短剧桌面', true],
  ['novel', '小说手机'],
] as const) {
  test(`${label}：多个版本备注与内容独立，重新打开可管理`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    if (kind === 'script' || label === '小说手机')
      await page.setViewportSize({ width: 390, height: 844 });
    if (nativeMode) {
      await page.addInitScript(() => {
        const callbacks = new Map<number, (value: unknown) => void>();
        const events = new Map<string, number>();
        let callbackId = 0;
        let generation = 1;
        let job: null | Record<string, unknown> = null;
        const host = window as unknown as {
          __TAURI_INTERNALS__: unknown;
          __TAURI_EVENT_PLUGIN_INTERNALS__: unknown;
          isTauri: boolean;
        };
        host.isTauri = true;
        host.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
        host.__TAURI_INTERNALS__ = {
          transformCallback(fn: (value: unknown) => void) {
            const id = ++callbackId;
            callbacks.set(id, fn);
            return id;
          },
          async invoke(command: string, args: Record<string, unknown>) {
            if (command === 'plugin:event|listen') {
              events.set(String(args.event), Number(args.handler));
              return 1;
            }
            if (command === 'plugin:event|unlisten') return;
            if (command === 'desktop_bootstrap')
              return { apiBase: '/api', session: null };
            if (command === 'desktop_import_session')
              return {
                apiBase: '/api',
                uid: '7',
                token: args.token,
                generation: ++generation,
                expiresAt: 4_102_444_800,
              };
            if (command === 'desktop_clear_session') return;
            if (command === 'desktop_refresh_session')
              return {
                apiBase: '/api',
                uid: '7',
                token: 'native-refreshed',
                generation: ++generation,
                expiresAt: 4_102_444_800,
              };
            if (command === 'desktop_jobs')
              return job ? [structuredClone(job)] : [];
            if (command === 'desktop_scan') {
              job = {
                id: 'folder-test',
                revision: 0,
                collapsed: true,
                res: args.res,
                version: args.version,
                name: '整剧目录',
                status: '待确认',
                error: '',
                concurrency: 3,
                versionName: args.versionName,
                targetDirectory: `res/${args.res}/versions/${args.version}/`,
                snapshotAt: Date.now(),
                timing: { elapsedMs: 0, active: false },
                items: [
                  {
                    relative: '预告.mp4',
                    seq: 0,
                    title: '预告',
                    fileId: null,
                    size: 50,
                    bytes: 0,
                    status: '待确认',
                    error: '',
                  },
                  {
                    relative: '第03集.mp4',
                    seq: 3,
                    title: '第03集',
                    fileId: null,
                    size: 100,
                    bytes: 0,
                    status: '待确认',
                    error: '',
                  },
                ],
              };
              return structuredClone(job);
            }
            if (command === 'desktop_collapse_job' && job) {
              job.collapsed = args.collapsed;
              return structuredClone(job);
            }
            if (command === 'desktop_update_job' && job) {
              const update = args.update as {
                expectedRevision: number;
                name: string;
                concurrency: number;
                items: { relative: string; seq: number; title: string }[];
              };
              if (update.expectedRevision !== job.revision)
                throw new Error('stale revision');
              const original = job.items as { relative: string }[];
              job.items = update.items.map((item) => ({
                ...original.find((v) => v.relative === item.relative),
                ...item,
              }));
              job.name = update.name;
              job.concurrency = update.concurrency;
              job.revision = Number(job.revision) + 1;
              return structuredClone(job);
            }
            if (command === 'desktop_rebind_job' && job) {
              job.revision = Number(job.revision) + 1;
              job.error = '';
              return structuredClone(job);
            }
            if (command === 'desktop_remove_job') {
              job = null;
              return;
            }
            if (command === 'desktop_start' && job) {
              if (args.concurrency !== 2)
                throw new Error('并发集数没有传给原生队列');
              job.concurrency = args.concurrency;
              job.status = '完成';
              job.timing = {
                elapsedMs: 5200,
                active: false,
                startedAt: Date.now() - 5200,
                finishedAt: Date.now(),
              };
              const items = job.items as {
                bytes: number;
                fileId: null | string;
                status: string;
              }[];
              if (items[0]) {
                items[0].bytes = 100;
                items[0].status = '已登记';
                items[0].fileId = '78';
              }
              callbacks.get(events.get('desktop-upload-updated') ?? -1)?.({
                payload: structuredClone(job),
              });
              return;
            }
            throw new Error(`unexpected native command ${command}`);
          },
        };
      });
    }
    const res = {
      id: 41,
      res_name: `测试${label}`,
      res_type: kind,
      state: 0,
      remark: '',
      intro: '',
      ext_info: {},
      lang_info: {},
    };
    const versions = [
      { id: 1, res_id: 41, name: '初版', remark: '初版备注', revision: 1 },
    ];
    const items: Record<string, unknown>[] = [];
    const file = {
      file_id: 77,
      file_name: '修订视频',
      file_ext: 'mp4',
      storage_code: 'media',
      storage_type: 's3',
      created_at: 1,
      created_by: 7,
      key: 'uploads/res/41/versions/2/video-hash',
      size: 100,
      md5_hash: 'fixture',
    };
    let created = false;
    let fail = false;
    let uploaded = false;
    let nativeExpired = nativeMode;
    let nativeRefreshed = false;
    let storageFailure = 0;
    let novelRequest:
      | undefined
      | {
          name: string;
          remark: string;
          chapters: { title: string; content: string }[];
        };
    let novelFail = true;
    let novelDone = false;
    let novelPolls = 0;
    const fileListPaths: string[] = [];
    await page.route('**/{auth,adm,param,notify,storage}/**', async (route) => {
      const req = route.request();
      if (!['fetch', 'xhr'].includes(req.resourceType()))
        return route.continue();
      const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
      const read = () => {
        const bytes = req.postDataBuffer();
        if (!bytes) throw new Error('missing body');
        return JSON.parse(KxEd.decryptText(bytes));
      };
      let result: unknown = [];
      if (path === '/auth/dt/exchange')
        result = {
          access_token: 'fixture',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '管理员',
          enabled: true,
          home_path: '/res/seas/global/source_manage',
        };
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'ResContent',
            title: '资源管理',
            path: '/res/seas/global/source_manage',
            component: '/res/seas/global/source_manage/index',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            meta: {},
          },
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (path === '/adm/res/41/novel-imports/latest')
        result = novelRequest
          ? {
              id: 91,
              version_id: novelDone ? 3 : null,
              name: novelRequest.name,
              chapter_count: 3,
              dispatch_error: '',
              task_run: {
                status: novelDone ? 'succeeded' : 'running',
                total_count: 3,
                succeeded_count: novelDone ? 3 : 0,
              },
            }
          : null;
      else if (path === '/adm/res/41/novel-imports/parse') {
        const body = read();
        expect(body.file_name).toBe('整本小说.txt');
        expect(body.content).toContain('第一章 初遇');
        result = {
          chapters: [
            { title: '序言', content: '保留的序言内容' },
            { title: '第一章 初遇', content: '第一章正文。' },
            { title: '第二章 重逢', content: '第二章正文。' },
          ],
          warnings: ['章节标题前的正文已保留为序言'],
        };
      } else if (
        path === '/adm/res/41/novel-imports' &&
        req.method() === 'POST'
      ) {
        const body = read();
        expect(body.chapters).toHaveLength(3);
        expect(body.name).toBe('TXT 精修版');
        expect(body.remark).toBe('调整重逢章节');
        if (novelFail) {
          novelFail = false;
          await fulfill(route, null, 500, '导入提交失败，请重试');
          return;
        }
        novelRequest = body;
        result = {
          id: 91,
          version_id: null,
          name: body.name,
          chapter_count: 3,
          dispatch_error: '',
          task_run: { status: 'running', total_count: 3, succeeded_count: 0 },
        };
      } else if (path === '/adm/res/41/novel-imports/91') {
        if (!novelRequest) throw new Error('missing novel import');
        if (novelPolls++ === 0) {
          await fulfill(route, {
            id: 91,
            version_id: null,
            name: novelRequest.name,
            chapter_count: 3,
            dispatch_error: '',
            task_run: { status: 'running', total_count: 3, succeeded_count: 0 },
          });
          return;
        }

        if (!novelDone) {
          novelDone = true;
          versions.push({
            id: 3,
            res_id: 41,
            name: novelRequest.name,
            remark: novelRequest.remark,
            revision: 1,
          });
          novelRequest.chapters.forEach((chapter, index) =>
            items.push({
              id: 200 + index,
              version_id: 3,
              seq_no: index + 1,
              ...chapter,
              link: '',
              duration: 0,
              remark: '',
            }),
          );
        }
        result = {
          id: 91,
          version_id: 3,
          name: novelRequest.name,
          chapter_count: 3,
          dispatch_error: '',
          task_run: { status: 'succeeded', total_count: 3, succeeded_count: 3 },
        };
      } else if (path === '/param/system-settings/public') result = null;
      else if (path === '/adm/res/drama-storage') {
        if (storageFailure) {
          await route.fulfill({
            status: storageFailure,
            contentType: 'application/json',
            body: Buffer.from(
              KxEd.encryptText(
                JSON.stringify({
                  code: storageFailure,
                  msg:
                    storageFailure === 409
                      ? '请先在存储设置中配置剧视频存储'
                      : '存储服务暂时不可用',
                  result: null,
                }),
              ),
            ),
          });
          return;
        }

        if (nativeExpired) {
          nativeExpired = false;
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: Buffer.from(
              KxEd.encryptText(
                JSON.stringify({
                  code: 401,
                  msg: 'ExpiredSignature',
                  result: null,
                }),
              ),
            ),
          });
          return;
        }
        if (nativeMode) {
          expect(req.headers().authorization).toBe('Bearer native-refreshed');
          nativeRefreshed = true;
        }
        result = {
          code: 'media',
          storage_name: '剧视频专用存储',
          storage_type: 's3',
        };
      } else if (/^\/adm\/res\/41\/versions\/[12]\/files$/.test(path)) {
        fileListPaths.push(path);
        result = {
          items: path.includes('/2/') && uploaded ? [file] : [],
          total: path.includes('/2/') && uploaded ? 1 : 0,
        };
      } else if (path === '/adm/res/41/versions/2/files/media/prepare') {
        const body = read();
        expect(body.file_ext).toBe('mp4');
        file.md5_hash = body.md5_hash;
        file.key = `uploads/res/41/versions/2/${body.md5_hash}`;
        file.size = body.size;
        result = {
          upload_required: true,
          method: 'PUT',
          upload_url: 'https://upload.example.test/video',
          headers: {},
          key: file.key,
          expires_in: 60,
        };
      } else if (path === '/adm/res/41/versions/2/files/media/complete') {
        const body = read();
        expect(body.key).toBe(file.key);
        uploaded = true;
        result = { file, url: 'https://example.test/v2.mp4' };
      } else if (path === '/storage/file/77') result = file;
      else if (path === '/storage/file/urls')
        result = [
          {
            file_id: 77,
            name: '修订视频.mp4',
            url: 'https://example.test/v2.mp4',
          },
        ];
      else if (path === '/storage/file/url/77')
        result = 'https://example.test/v2.mp4';
      else if (path === '/adm/res')
        result = { items: created ? [res] : [], total: created ? 1 : 0 };
      else if (path === '/adm/res/create_with_version') {
        const body = read();
        expect(body.res_type).toBe(kind);
        created = true;
        result = { res_id: 41, version: versions[0] };
      } else if (path === '/adm/res/41/versions') {
        if (req.method() === 'POST') {
          const body = read();
          versions.push({ ...body, id: 2, res_id: 41, revision: 1 });
          result = versions[1];
        } else result = versions;
      } else if (/^\/adm\/res\/41\/versions\/[123]$/.test(path)) {
        const id = Number(path.split('/').at(-1));
        const version = versions.find((v) => v.id === id);
        if (!version) throw new Error('missing version');
        if (req.method() === 'PUT') {
          const body = read();
          expect(body.expected_revision).toBe(version.revision);
          Object.assign(version, {
            name: body.name,
            remark: body.remark,
            revision: version.revision + 1,
          });
          result = version;
        } else {
          result = { version, items: items.filter((v) => v.version_id === id) };
        }
      } else if (/^\/adm\/res\/41\/versions\/[12]\/items$/.test(path)) {
        const body = read();
        const id = Number(path.split('/').at(-2));
        const version = versions.find((v) => v.id === id);
        if (!version) throw new Error('missing version');
        expect(body.expected_revision).toBe(version.revision);
        if (fail) {
          fail = false;
          await fulfill(route, null, 400, '保存失败，请重试');
          return;
        }
        result = { ...body, id: items.length + 1, version_id: id };
        items.push(result as Record<string, unknown>);
        version.revision++;
      }
      await fulfill(route, result);
    });
    await page.route('https://upload.example.test/video', async (route) => {
      expect(route.request().method()).toBe('PUT');
      await route.fulfill({ status: 200, body: '' });
    });
    if (kind === 'drama') {
      await page.goto('/');
      const recorded = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas unavailable');
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(0, 0, 160, 240);
        const stream = canvas.captureStream(10);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks: BlobPart[] = [];
        const result = new Promise<number[]>((resolve) => {
          recorder.ondataavailable = (event) => chunks.push(event.data);
          recorder.onstop = async () => {
            const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
            stream.getTracks().forEach((track) => track.stop());
            resolve([...bytes]);
          };
        });
        recorder.start();
        const draw = setInterval(() => ctx.fillRect(0, 0, 160, 240), 30);
        setTimeout(() => {
          clearInterval(draw);
          recorder.stop();
        }, 250);
        return result;
      });
      await page.route('https://example.test/*.mp4', (route) =>
        route.fulfill({
          contentType: 'video/webm',
          body: Buffer.from(recorded),
        }),
      );
    }
    await page.goto('/#/auth/login?exchange_code=fixture');
    await page.getByRole('button', { name: '新增资源', exact: true }).click();
    const create = page.getByRole('dialog', { name: '新增资源', exact: true });
    if (kind !== 'drama') {
      await create.getByRole('combobox').click();
      await page
        .getByTitle(kind === 'novel' ? '小说' : '剧本', { exact: true })
        .click();
    }
    await create
      .getByPlaceholder('资源名称', { exact: true })
      .fill(`测试${label}`);
    await create
      .getByPlaceholder('例如：原始版、配音调整、删减说明或改稿说明')
      .fill('初版备注');
    await create.getByRole('button', { name: '创建并管理版本' }).click();
    const manager = page.getByRole('dialog', {
      name: `测试${label} · 版本与内容`,
      exact: true,
    });
    await expect(manager).toBeVisible();
    const add = kind === 'drama' ? '添加分集' : '添加章节';
    await manager.getByRole('button', { name: add }).click();
    let editor = page.getByRole('dialog', {
      name: '初版 · 新增内容',
      exact: true,
    });
    await editor.getByPlaceholder('章节标题', { exact: true }).fill('第一章');
    await (kind === 'drama'
      ? editor
          .getByPlaceholder('填写视频 HTTP/HTTPS 地址，或选择上传的视频')
          .fill('https://example.test/v1.mp4')
      : editor
          .getByRole('textbox', { name: '填写本版本的章节正文' })
          .fill('第一版正文'));
    fail = true;
    await editor.getByRole('button', { name: /确.*定/ }).click();
    await expect(editor.getByText('保存失败，请重试')).toBeVisible();
    await expect(
      editor.getByPlaceholder('章节标题', { exact: true }),
    ).toHaveValue('第一章');
    await editor.getByRole('button', { name: /确.*定/ }).click();
    await expect(editor).toBeHidden();
    await manager
      .getByRole('button', { name: '新增版本', exact: true })
      .click();
    const newVersion = page.getByRole('dialog', {
      name: '新增版本',
      exact: true,
    });
    await newVersion
      .getByPlaceholder('例如：原版、海外版、第二次修订')
      .fill('修订版');
    await newVersion
      .getByPlaceholder('填写本版本相对其他版本的内容差异')
      .fill('修改结局与台词');
    await newVersion.getByRole('button', { name: /确.*定/ }).click();
    await expect(
      manager.getByRole('heading', { name: '修订版' }),
    ).toBeVisible();
    await expect(
      manager.getByRole('cell', { name: '第一章', exact: true }),
    ).toHaveCount(0);
    await manager.getByRole('button', { name: add }).click();
    editor = page.getByRole('dialog', {
      name: '修订版 · 新增内容',
      exact: true,
    });
    await editor.getByPlaceholder('章节标题', { exact: true }).fill('修订章节');
    if (kind === 'drama') {
      await editor
        .getByRole('button', { name: '选择文件', exact: true })
        .click();
      const picker = page.getByRole('dialog', {
        name: '选择文件',
        exact: true,
      });
      await expect(picker).toBeVisible();
      await expect(editor.getByText(/res\/41\/versions\/2\//)).toBeVisible();
      await picker
        .locator('input[type=file]')
        .first()
        .setInputFiles({
          name: 'revision.mp4',
          mimeType: 'video/mp4',
          buffer: Buffer.from('video-fixture'),
        });
      await expect.poll(() => uploaded).toBe(true);
      const row = picker.getByRole('row').filter({ hasText: '修订视频.mp4' });
      await row.getByRole('cell').first().click();
      await picker.getByRole('button', { name: /确.*认/ }).click();
      await expect(picker).toBeHidden();
      await expect(
        editor.getByPlaceholder('填写视频 HTTP/HTTPS 地址，或选择上传的视频'),
      ).toHaveValue('77');
    } else {
      await editor.getByLabel('导入章节文本', { exact: true }).setInputFiles({
        name: 'revision.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('修订版正文'),
      });
    }
    await editor.getByRole('button', { name: /确.*定/ }).click();
    await expect(editor).toBeHidden();
    await manager
      .getByRole('navigation', { name: '资源版本' })
      .getByRole('button', { name: /初版/ })
      .click();
    await expect(
      manager.getByRole('cell', { name: '第一章', exact: true }),
    ).toBeVisible();
    await expect(
      manager.getByRole('cell', { name: '修订章节', exact: true }),
    ).toHaveCount(0);
    await manager.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '版本与内容', exact: true }).click();
    await manager
      .getByRole('navigation', { name: '资源版本' })
      .getByRole('button', { name: /修订版/ })
      .click();
    await expect(
      manager.getByRole('cell', { name: '修订章节', exact: true }),
    ).toBeVisible();
    if (nativeMode) {
      await manager
        .getByRole('button', { name: '整剧目录上传', exact: true })
        .click();
      const uploader = page.getByRole('dialog', {
        name: '整剧目录上传',
        exact: true,
      });
      await uploader.getByRole('button', { name: '选择目录并扫描' }).click();
      await expect(
        uploader.getByRole('cell', { name: '第03集.mp4', exact: true }),
      ).toBeVisible();
      await uploader
        .getByRole('row')
        .filter({ hasText: '预告.mp4' })
        .getByRole('button', { name: '移除', exact: true })
        .click();
      await expect(
        uploader.getByRole('cell', { name: '预告.mp4', exact: true }),
      ).toHaveCount(0);
      await uploader
        .getByRole('textbox', { name: '目录名称', exact: true })
        .fill('自定义目录');
      await uploader.getByLabel('分集集数').fill('5');
      await uploader.getByLabel('分集标题').fill('自定义第五集');
      await uploader.getByRole('button', { name: '刷新配置和任务' }).click();
      await expect(uploader.getByLabel('分集标题')).toHaveValue('自定义第五集');
      await uploader.getByRole('button', { name: '保存修改' }).click();
      await uploader.getByRole('button', { name: '收起明细' }).click();
      await expect(uploader.getByRole('table')).toHaveCount(0);
      await expect(uploader.getByLabel('目录上传进度')).toBeVisible();
      await expect(uploader.getByText('上传耗时：0时0分0秒')).toBeVisible();
      await expect(uploader.getByText(/自定义目录/)).toBeVisible();
      await uploader.screenshot({
        path: info.outputPath('directory-collapsed.png'),
        animations: 'disabled',
      });
      await uploader.getByRole('button', { name: '关闭', exact: true }).click();
      await manager
        .getByRole('button', { name: '整剧目录上传', exact: true })
        .click();
      await expect(uploader.getByRole('table')).toHaveCount(0);
      await uploader.getByRole('button', { name: '展开明细' }).click();
      await expect(uploader.getByLabel('分集集数')).toHaveValue('5');
      await expect(uploader.getByLabel('分集标题')).toHaveValue('自定义第五集');

      for (const status of [500, 409]) {
        storageFailure = status;
        await uploader.getByRole('button', { name: '刷新配置和任务' }).click();
        await expect(
          uploader.getByText(
            status === 409
              ? /请先在存储设置中配置剧视频存储/
              : /存储服务暂时不可用/,
          ),
        ).toBeVisible();
        await expect(
          uploader.getByRole('button', { name: '确认清单并上传' }),
        ).toBeDisabled();
        await expect(
          uploader.getByRole('cell', { name: '第03集.mp4', exact: true }),
        ).toBeVisible();
      }
      storageFailure = 0;
      await uploader.getByRole('button', { name: '刷新配置和任务' }).click();
      await expect(
        uploader.getByRole('button', { name: '确认清单并上传' }),
      ).toBeEnabled();
      await uploader.getByRole('button', { name: '使用当前存储' }).click();
      await uploader.getByRole('button', { name: '编辑清单' }).click();
      await uploader
        .getByRole('spinbutton', { name: '同时上传集数' })
        .fill('2');
      await uploader.getByRole('button', { name: '确认清单并上传' }).click();
      await expect(uploader.getByText('已登记', { exact: true })).toBeVisible();
      expect(nativeRefreshed).toBe(true);
      await expect(uploader.getByText('上传耗时：0时0分5秒')).toBeVisible();
      await expect(
        uploader.getByText(/目标目录：res\/41\/versions\/2\//),
      ).toBeVisible();
      await uploader.screenshot({
        path: info.outputPath('desktop-directory-upload.png'),
        animations: 'disabled',
      });
      await uploader.getByRole('button', { name: '收起明细' }).click();
      await expect(uploader.getByRole('table')).toHaveCount(0);
      await expect(uploader.getByText('上传耗时：0时0分5秒')).toBeVisible();
      await uploader.getByRole('button', { name: '移除目录' }).click();
      await page
        .getByRole('button', { name: /确.*定/ })
        .last()
        .click();
      await expect(uploader.getByText(/自定义目录/)).toHaveCount(0);
      await uploader.getByRole('button', { name: '刷新配置和任务' }).click();
      await expect(
        uploader.getByText('当前版本暂无目录上传任务'),
      ).toBeVisible();
      await uploader.getByRole('button', { name: '关闭', exact: true }).click();
    }
    expect(items).toHaveLength(2);
    await manager
      .getByRole('button', { name: '修改版本信息', exact: true })
      .click();
    const editVersion = page.getByRole('dialog', {
      name: '修改版本信息',
      exact: true,
    });
    await editVersion
      .getByPlaceholder('填写本版本相对其他版本的内容差异')
      .fill('修订版最终差异说明');
    await editVersion.getByRole('button', { name: /确.*定/ }).click();
    await expect(editVersion).toBeHidden();
    await expect(
      manager.getByRole('region', { name: '版本内容' }),
    ).toContainText('修订版最终差异说明');
    expect(versions[0]?.remark).toBe('初版备注');
    if (kind === 'drama') {
      expect(items[1]?.link).toBe('storage:file:77');
      expect(fileListPaths).toContain('/adm/res/41/versions/2/files');
    }
    expect(items[0]?.version_id).not.toBe(items[1]?.version_id);
    if (kind === 'novel') {
      await manager
        .getByRole('button', { name: '章节预览', exact: true })
        .click();
      const oldReader = page.getByRole('dialog', {
        name: `测试${label} · 修订版 · 章节预览`,
        exact: true,
      });
      await expect(
        oldReader.getByRole('region', { name: '章节正文' }),
      ).toContainText('修订版正文');
      await oldReader
        .getByRole('button', { name: '关闭', exact: true })
        .click();
      await manager
        .getByRole('button', { name: '导入 TXT 生成版本', exact: true })
        .click();
      const importer = page.getByRole('dialog', {
        name: '导入小说 TXT · 生成新版本',
        exact: true,
      });
      await importer.getByLabel('选择整本小说 TXT').setInputFiles({
        name: '整本小说.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(
          '保留的序言内容\n第一章 初遇\n第一章正文。\n第二章 重逢\n第二章正文。',
        ),
      });
      await expect(importer.getByText('解析目录 · 3 章')).toBeVisible();
      await importer
        .getByRole('button', { name: '3. 第二章 重逢', exact: true })
        .click();
      await expect(importer.getByLabel('导入正文预览')).toContainText(
        '第二章正文。',
      );
      await importer
        .getByLabel('新版本名称', { exact: true })
        .fill('TXT 精修版');
      await importer.getByLabel('导入版本差异备注').fill('调整重逢章节');
      await importer.screenshot({
        path: info.outputPath('novel-import-review.png'),
        animations: 'disabled',
      });
      await importer
        .getByRole('button', { name: '确认章节并生成版本' })
        .click();
      await expect(
        importer.getByText('导入提交失败，请重试', { exact: true }),
      ).toBeVisible();
      await expect(importer.getByText('解析目录 · 3 章')).toBeVisible();
      await importer
        .getByRole('button', { name: '确认章节并生成版本' })
        .click();
      await expect(importer.getByText(/正在生成「TXT 精修版」/)).toBeVisible();
      await importer
        .getByRole('button', { name: '关闭', exact: true })
        .first()
        .click();
      await manager
        .getByRole('button', { name: '导入 TXT 生成版本', exact: true })
        .click();
      await expect(
        importer.getByText('版本「TXT 精修版」已生成，共 3 章'),
      ).toBeVisible();
      await importer
        .getByRole('button', { name: '关闭', exact: true })
        .first()
        .click();
      await expect(
        manager.getByRole('heading', { name: 'TXT 精修版', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText('导入提交失败，请重试', { exact: true }),
      ).toHaveCount(0, { timeout: 10_000 });
      await manager
        .getByRole('button', { name: '章节预览', exact: true })
        .click();
      const reader = page.getByRole('dialog', {
        name: `测试${label} · TXT 精修版 · 章节预览`,
        exact: true,
      });
      await expect(
        reader.getByRole('region', { name: '章节正文' }),
      ).toContainText('保留的序言内容');
      await reader.getByRole('button', { name: '下一章', exact: true }).click();
      await expect(
        reader.getByRole('region', { name: '章节正文' }),
      ).toContainText('第一章正文。');
      await reader
        .getByRole('navigation', { name: '选择章节' })
        .getByRole('button', { name: /第二章 重逢/ })
        .click();
      await expect(
        reader.getByRole('region', { name: '章节正文' }),
      ).toContainText('第二章正文。');
      await reader.screenshot({
        path: info.outputPath('novel-reader.png'),
        animations: 'disabled',
      });
      await reader.getByRole('button', { name: '关闭', exact: true }).click();
      await manager
        .getByRole('navigation', { name: '资源版本' })
        .getByRole('button', { name: /初版/ })
        .click();
      await expect(
        manager.getByRole('cell', { name: '第一章', exact: true }),
      ).toBeVisible();
      await expect(
        manager.getByRole('cell', { name: '第二章 重逢', exact: true }),
      ).toHaveCount(0);
    }

    if (kind === 'drama') {
      const extra = Array.from({ length: 51 }, (_, index) => ({
        id: 100 + index,
        version_id: 2,
        seq_no: index + 2,
        title: `修订第${index + 2}集`,
        link: 'https://example.test/v2.mp4',
        remark: '',
      }));
      items.push(...extra);
      await manager
        .getByRole('button', { name: '刷新版本', exact: true })
        .click();
      await manager
        .getByRole('button', { name: '播放预览', exact: true })
        .click();
      const preview = page.getByRole('dialog', {
        name: `测试${label} · 修订版 · 播放预览`,
        exact: true,
      });
      await expect(preview.getByText(/剧集（1\/52）/)).toBeVisible();
      await expect
        .poll(() =>
          preview
            .locator('video')
            .evaluate((player: HTMLVideoElement) => player.readyState),
        )
        .toBeGreaterThan(0);
      await preview.getByRole('switch', { name: '自动播放下一集' }).click();
      await preview
        .locator('video')
        .evaluate((player: HTMLVideoElement) => player.play());
      await expect
        .poll(() =>
          preview
            .locator('video')
            .evaluate((player: HTMLVideoElement) => player.currentTime),
        )
        .toBeGreaterThan(0);
      await preview
        .locator('video')
        .evaluate((player: HTMLVideoElement) => player.pause());
      await preview.getByRole('switch', { name: '自动播放下一集' }).click();
      await preview
        .getByRole('button', { name: '下一集', exact: true })
        .click();
      await expect(
        preview.getByText('第 2 集 · 修订第2集', { exact: true }),
      ).toBeVisible();
      await preview.locator('video').dispatchEvent('ended');
      await expect(
        preview.getByText('第 3 集 · 修订第3集', { exact: true }),
      ).toBeVisible();
      await preview.getByRole('button', { name: '页 2', exact: true }).click();
      await preview
        .getByRole('button', { name: '播放第 51 集：修订第51集', exact: true })
        .click();
      await expect(
        preview.getByText('第 51 集 · 修订第51集', { exact: true }),
      ).toBeVisible();
      await preview.screenshot({
        path: info.outputPath('version-playlist.png'),
        animations: 'disabled',
      });
      await preview.getByRole('button', { name: '关闭', exact: true }).click();
      await manager
        .getByRole('navigation', { name: '资源版本' })
        .getByRole('button', { name: /初版/ })
        .click();
      await manager
        .getByRole('button', { name: '播放预览', exact: true })
        .click();
      const original = page.getByRole('dialog', {
        name: `测试${label} · 初版 · 播放预览`,
        exact: true,
      });
      await expect(
        original.getByText('剧集（1/1）', { exact: true }),
      ).toBeVisible();
      await expect(
        original.getByRole('button', { name: '播放第 51 集：修订第51集' }),
      ).toHaveCount(0);
      await original.getByRole('button', { name: '关闭', exact: true }).click();
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${kind}-versions.png`),
      animations: 'disabled',
    });
  });
}
async function fulfill(route: Route, result: unknown, code = 200, msg = 'ok') {
  const body = JSON.stringify({ code, result, msg });
  await route.fulfill({
    contentType: 'application/json',
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
  });
}
