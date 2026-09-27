import { Buffer } from 'node:buffer';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
const fixtureFile = process.env.VESTIGE_WEB_FIXTURE_FILE;
const fixture:
  | undefined
  | { username: string; reader_username: string; password: string } =
  fixtureFile ? JSON.parse(readFileSync(fixtureFile, 'utf8')) : undefined;
test.skip(!fixture, 'requires isolated KX training fixture');
test('upload, queue, evidence review, explicit publication and chat adjustment', async ({
  page,
  browser,
  baseURL,
}) => {
  if (!fixture || !fixtureFile) throw new Error('fixture required');
  const name = `界面训练角色-${Date.now().toString(36)}`;
  rmSync(`${fixtureFile}.agent`, { force: true });
  await page.goto('/auth/login');
  await page.getByPlaceholder(/用户名|账号/).fill(fixture.username);
  await page.getByPlaceholder('密码', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await page.getByRole('button', { name: '新建角色', exact: true }).click();
  const create = page.getByRole('dialog', {
    name: '新建记忆角色',
    exact: true,
  });
  await create.getByLabel('角色名称').fill(name);
  await create.getByRole('button', { name: '创建并准备' }).click();
  const preparing = page.getByRole('dialog', {
    name: `${name} · 准备角色`,
    exact: true,
  });
  await expect(preparing.getByText('已完成', { exact: true })).toBeVisible();
  await preparing.getByRole('button', { name: /关闭|close/i }).click();
  const detail = page.getByRole('dialog', { name, exact: true });
  await detail.getByRole('tab', { name: '编剧培养', exact: true }).click();
  await detail
    .getByRole('button', { name: '上传剧本素材', exact: true })
    .click();
  const upload = page.getByRole('dialog', {
    name: '上传剧本素材',
    exact: true,
  });
  await upload.getByLabel('剧本文件').setInputFiles({
    name: 'sample.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '第1场\n林夏：如果说出真相，我就会失去姐姐。\n她把录音交给警察。',
      'utf8',
    ),
  });
  await upload.getByRole('button', { name: '上传并解析', exact: true }).click();
  await expect(upload).toBeHidden();
  await expect(
    detail.getByRole('button', { name: 'sample.txt', exact: true }),
  ).toBeVisible();
  await detail
    .getByRole('button', { name: '提交提炼任务', exact: true })
    .click();
  await expect(detail.getByText('等待 Agent', { exact: true })).toBeVisible();
  await expect(detail.getByText('生效版本 v0', { exact: true })).toBeVisible();
  writeFileSync(`${fixtureFile}.agent`, 'run fixture Agent');
  await expect(
    detail.getByText('候选 v1，请到规则版本审核', { exact: true }),
  ).toBeVisible();
  await expect(detail.getByText('生效版本 v0', { exact: true })).toBeVisible();
  await detail.getByRole('tab', { name: '规则版本', exact: true }).click();
  const candidate = detail
    .getByRole('row')
    .filter({ hasText: '从作品提炼人物选择与代价' });
  await candidate.getByRole('button', { name: '查看规则与证据' }).click();
  const rules = page.getByRole('dialog', { name: '规则版本 v1', exact: true });
  await expect(
    rules.getByRole('heading', { name: /让选择产生代价/ }),
  ).toBeVisible();
  await rules.getByRole('button', { name: '查看原文段落' }).click();
  const evidence = page.getByRole('dialog', {
    name: 'sample.txt',
    exact: true,
  });
  await expect(
    evidence
      .getByText('林夏：如果说出真相，我就会失去姐姐。', { exact: false })
      .first(),
  ).toBeVisible();
  await evidence.getByRole('button', { name: /关闭|close/i }).click();
  await rules.getByRole('button', { name: '采纳此候选', exact: true }).click();
  await page.getByRole('button', { name: '确认采纳发布', exact: true }).click();
  await expect(rules).toBeHidden();
  await expect(detail.getByText('生效版本 v1', { exact: true })).toBeVisible();
  await detail.getByRole('tab', { name: '调整与对话', exact: true }).click();
  await detail
    .getByRole('textbox', { name: '角色调整意见' })
    .fill('请减少旁白，优先用人物行动表达关系。');
  await detail
    .getByRole('button', { name: '提交调整意见', exact: true })
    .click();
  await expect(
    detail.getByText('已记录你的调整，候选规则等待审核后生效。', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(detail.getByText('生效版本 v1', { exact: true })).toBeVisible();
  await detail.getByRole('tab', { name: '规则版本', exact: true }).click();
  const adjustment = detail
    .getByRole('row')
    .filter({ hasText: '增加行动表达偏好' });
  await adjustment.getByRole('button', { name: '查看规则与证据' }).click();
  const second = page.getByRole('dialog', { name: '规则版本 v2', exact: true });
  await second.getByRole('button', { name: '查看原始反馈' }).click();
  const original = page.getByRole('dialog', {
    name: '原始用户反馈',
    exact: true,
  });
  await expect(
    original.getByText('请减少旁白，优先用人物行动表达关系。', { exact: true }),
  ).toBeVisible();
  await original.getByRole('button', { name: /关闭|close/i }).click();
  await second.getByRole('button', { name: '采纳此候选', exact: true }).click();
  await page.getByRole('button', { name: '确认采纳发布', exact: true }).click();
  await expect(detail.getByText('生效版本 v2', { exact: true })).toBeVisible();
  await expect(second).toBeHidden();
  await expect(
    page.getByRole('button', { name: '确认采纳发布', exact: true }),
  ).toBeHidden();

  await detail.getByRole('tab', { name: '创作项目', exact: true }).click();
  await detail
    .getByRole('button', { name: '新建创作项目', exact: true })
    .click();
  const projectForm = page.getByRole('dialog', {
    name: '新建创作项目',
    exact: true,
  });
  await projectForm.getByLabel('项目名称').fill('夜站原创短剧');
  await projectForm
    .getByLabel('创作简述')
    .fill('林夏在末班车前决定留下作证，失去逃离机会。');
  await projectForm.getByLabel('世界观').fill('雨夜的车站');
  await projectForm
    .getByRole('button', { name: '保存项目', exact: true })
    .click();
  await expect(projectForm).toBeHidden();
  await expect(detail.getByText('固定规则 v2', { exact: true })).toBeVisible();
  await detail
    .getByRole('button', { name: '提交写作任务', exact: true })
    .click();
  const writing = page.getByRole('dialog', {
    name: '提交写作任务',
    exact: true,
  });
  await writing.getByLabel('具体要求').fill('写出林夏作出选择的原创大纲。');
  await writing
    .getByRole('button', { name: '提交给 Agent', exact: true })
    .click();
  await expect(writing).toBeHidden();
  await detail.getByRole('button', { name: '夜站的选择', exact: true }).click();
  const draft = page.getByRole('dialog', { name: '夜站的选择', exact: true });
  await expect(draft.getByText('草稿修订 r1', { exact: true })).toBeVisible();
  await draft
    .getByRole('button', { name: '提交审稿任务', exact: true })
    .click();
  const review = page.getByRole('dialog', {
    name: '提交审稿任务',
    exact: true,
  });
  await review
    .getByRole('textbox', { name: '审稿要求' })
    .fill('检查动机和选择代价。');
  await review
    .getByRole('button', { name: '提交给 Agent', exact: true })
    .click();
  await expect(review).toBeHidden();
  await draft.getByRole('tab', { name: '审稿意见', exact: true }).click();
  await expect(
    draft.getByText('人物通过行动作出选择，建议加强动机铺垫。', {
      exact: true,
    }),
  ).toBeVisible();
  await draft.getByRole('tab', { name: '剧本正文', exact: true }).click();
  await draft
    .getByRole('button', { name: '编辑为新修订', exact: true })
    .click();
  await expect(
    draft.getByRole('button', { name: '读取最新修订', exact: true }),
  ).toBeDisabled();
  await draft
    .getByRole('textbox', { name: '草稿正文' })
    .fill('这段编辑应当被放弃');
  await draft
    .getByRole('button', { name: '放弃本次编辑', exact: true })
    .click();
  await draft
    .getByRole('button', { name: '编辑为新修订', exact: true })
    .click();
  await expect(draft.getByRole('textbox', { name: '草稿正文' })).toHaveValue(
    /林夏站在末班车前/,
  );
  await draft
    .getByRole('textbox', { name: '草稿正文' })
    .fill('林夏看见受害者瑟缩的手。她撕掉车票，陪她走向警局。');
  await draft.getByRole('button', { name: '保存新修订', exact: true }).click();
  await expect(draft.getByText('草稿修订 r2', { exact: true })).toBeVisible();
  await draft.getByRole('tab', { name: '审稿意见', exact: true }).click();
  await expect(
    draft.getByText('审阅 r1 · 历史修订', { exact: true }),
  ).toBeVisible();
  await draft.getByLabel('查看历史修订').fill('1');
  await draft.getByRole('button', { name: '读取', exact: true }).click();
  await expect(draft.getByText('草稿修订 r1', { exact: true })).toBeVisible();
  await draft.getByRole('tab', { name: '剧本正文', exact: true }).click();
  await expect(
    draft.getByRole('button', { name: '编辑为新修订', exact: true }),
  ).toBeHidden();
  const downloadEvent = page.waitForEvent('download');
  await draft.getByRole('button', { name: '导出文本', exact: true }).click();
  const downloaded = await downloadEvent;
  expect(downloaded.suggestedFilename()).toBe('夜站的选择-r1.txt');

  await expect(
    page.getByText('已保存为新的草稿修订', { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByText('审稿任务已排队，等待 Agent', { exact: true }),
  ).toBeHidden();
  if (process.env.VESTIGE_TRAINING_SCREENSHOT)
    await page.screenshot({
      path: process.env.VESTIGE_TRAINING_SCREENSHOT,
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const box = await draft.boundingBox();
      return !!box && box.x >= -1 && box.x + box.width <= 391;
    })
    .toBe(true);
  await expect(
    draft.getByRole('button', { name: '导出文本', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await draft.getByRole('button', { name: /关闭|close/i }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await detail.getByRole('tab', { name: '共享成员', exact: true }).click();
  await detail.getByRole('button', { name: '添加成员', exact: true }).click();
  const picker = page.getByRole('dialog', {
    name: '选择协作成员',
    exact: true,
  });
  await picker
    .getByRole('textbox', { name: '搜索协作成员' })
    .fill(fixture.reader_username);
  await picker.getByRole('textbox', { name: '搜索协作成员' }).press('Enter');
  await picker
    .getByRole('row')
    .filter({ hasText: '工作台验证只读用户' })
    .getByRole('button', { name: '选择', exact: true })
    .click();
  const grant = page.getByRole('dialog', { name: '设置共享权限', exact: true });
  await expect(
    grant.getByText('只读：检索知识和已发布规则', { exact: true }),
  ).toBeVisible();
  await grant.getByRole('button', { name: '保存权限', exact: true }).click();
  await expect(grant).toBeHidden();
  const reader = await browser.newPage({ baseURL });
  await reader.goto('/auth/login');
  await reader.getByPlaceholder(/用户名|账号/).fill(fixture.reader_username);
  await reader.getByPlaceholder('密码', { exact: true }).fill(fixture.password);
  await reader.getByRole('button', { name: 'login', exact: true }).click();
  await reader.getByRole('button', { name, exact: true }).click();
  const readonly = reader.getByRole('dialog', { name, exact: true });
  await readonly.getByRole('tab', { name: '编剧培养', exact: true }).click();
  await readonly.getByRole('tab', { name: '创作项目', exact: true }).click();
  await expect(
    readonly.getByRole('button', { name: '新建创作项目', exact: true }),
  ).toHaveCount(0);
  await readonly
    .getByRole('button', { name: '夜站原创短剧', exact: true })
    .click();
  await expect(
    readonly.getByRole('button', { name: '编辑项目设定', exact: true }),
  ).toHaveCount(0);
  await expect(
    readonly.getByRole('button', { name: '提交写作任务', exact: true }),
  ).toHaveCount(0);
  await readonly
    .getByRole('button', { name: '夜站的选择', exact: true })
    .click();
  const readerDraft = reader.getByRole('dialog', {
    name: '夜站的选择',
    exact: true,
  });
  await expect(
    readerDraft.getByText('草稿修订 r2', { exact: true }),
  ).toBeVisible();
  await expect(
    readerDraft.getByRole('button', { name: '编辑为新修订', exact: true }),
  ).toHaveCount(0);
  await expect(
    readerDraft.getByRole('button', { name: '提交审稿任务', exact: true }),
  ).toHaveCount(0);
  await readerDraft.getByRole('tab', { name: '审稿意见', exact: true }).click();
  await expect(
    readerDraft.getByText('审阅 r1 · 历史修订', { exact: true }),
  ).toBeVisible();
  await reader.close();
});
