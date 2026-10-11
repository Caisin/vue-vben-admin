/* oxlint-disable typescript/no-non-null-assertion -- 测试断言之后读取确定存在的元素。 */
/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  versions: vi.fn(),
  detail: vi.fn(),
  play: vi.fn(),
  addNote: vi.fn(),
  noteState: vi.fn(),
  state: vi.fn(),
  upload: vi.fn(),
  episode: vi.fn(),
}));
vi.mock('#/api/res/review', () => ({
  reviewApi: state,
  reviewLabels: {
    draft: '制作中',
    reviewing: '已交片 · 审片修改',
    final: '定版成片',
    published: '已上架',
  },
  noteLabels: { open: '待处理', processing: '处理中', resolved: '已完成' },
}));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (e: Error) => e.message,
}));
vi.mock('./modules/review-batch-upload.vue', () => ({
  default: { template: '<span />' },
}));
vi.mock('./modules/review-members.vue', () => ({
  default: { template: '<span>协作者</span>' },
}));
vi.mock('./modules/review-guide.vue', () => ({
  default: { template: '<button>操作指引</button>' },
}));
vi.mock('./modules/review-dingtalk.vue', () => ({
  default: { template: '<button>钉钉协作</button>' },
}));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Button = defineComponent({
    props: ['disabled'],
    setup:
      (p, { slots }) =>
      () =>
        h('button', { disabled: p.disabled }, slots.default?.()),
  });
  const Input = defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h('input', {
          value: p.value,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLInputElement).value),
        }),
  });
  const TextArea = defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h('textarea', {
          value: p.value,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLTextAreaElement).value),
        }),
  });
  const Select = defineComponent({
    props: ['value', 'options'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h(
          'select',
          {
            value: p.value,
            onChange: (e: Event) =>
              emit('update:value', (e.target as HTMLSelectElement).value),
          },
          p.options?.map((o: { value: string; label: string }) =>
            h('option', { value: o.value }, o.label),
          ),
        ),
  });
  const Modal = defineComponent({
    props: ['open'],
    emits: ['ok', 'cancel'],
    setup:
      (p, { slots, emit }) =>
      () =>
        p.open
          ? h('section', [
              slots.default?.(),
              h('button', { onClick: () => emit('ok') }, '确认弹窗'),
            ])
          : null,
  });
  const Alert = defineComponent({
    props: ['message'],
    setup: (p) => () => h('p', p.message),
  });
  return {
    Button,
    Input,
    TextArea,
    Select,
    Modal,
    Alert,
    Empty: Wrap,
    InputNumber: Input,
    Popconfirm: Wrap,
    Progress: Wrap,
    Spin: Wrap,
    Tag: Wrap,
  };
});
let cleanup: () => void;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function settle() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
async function mount(edit = true, published = false, stage = 'draft') {
  const version = {
    id: 10,
    res_id: 1,
    name: '导演版',
    review_state: published ? 'published' : stage,
    planned_episodes: 2,
    revision: 3,
    published_at: published ? 1 : 0,
  };
  const view = {
    detail: {
      version,
      items: [
        { id: 11, seq_no: 1, title: '第一集', link: 'storage:file:11' },
        { id: 12, seq_no: 2, title: '第二集', link: 'storage:file:12' },
      ],
    },
    members: [],
    users: { '2': '导演' },
    can_edit: edit,
    can_manage: edit,
    notes: [
      {
        id: 90,
        seq_no: 1,
        uid: 2,
        kind: 'suggestion',
        body: '字幕错字',
        position_ms: 23_000,
        media_link: 'storage:file:11',
        state: 'open',
        resolution: '',
        resolved_by: 0,
        revision: 1,
        created_at: 1,
        history: [],
      },
    ],
  };
  state.versions.mockResolvedValue([version]);
  state.detail.mockResolvedValue(view);
  state.play.mockResolvedValue('');
  state.addNote.mockResolvedValue(undefined);
  state.noteState.mockResolvedValue(undefined);
  const { default: Component } = await import('./modules/review-workbench.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () => h(Component, { res: 1, name: '测试作品' }),
  });
  app.mount(host);
  cleanup = () => app.unmount();
  await settle();
  return view;
}
function button(text: string) {
  const found = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(found, `按钮 ${text}`).toBeTruthy();
  return found!;
}
describe('逐集审核工作台', () => {
  it('协作者切集保留草稿，提交时绑定当前集和修订号', async () => {
    await mount(false);
    const textarea = document.querySelector('textarea')!;
    textarea.value = '第一集修改建议';
    textarea.dispatchEvent(new Event('input'));
    await settle();
    button('下一集').click();
    await settle();
    expect(document.querySelector('textarea')!.value).toBe('');
    button('上一集').click();
    await settle();
    expect(document.querySelector('textarea')!.value).toBe('第一集修改建议');
    button('提交修改建议').click();
    await settle();
    expect(state.addNote).toHaveBeenCalledWith(
      1,
      10,
      expect.objectContaining({
        seq_no: 1,
        expected_revision: 3,
        body: '第一集修改建议',
      }),
    );
    expect(document.querySelector('textarea')!.value).toBe('');
    expect(
      [...document.querySelectorAll('button')].some((b) =>
        b.textContent?.includes('替换这一集'),
      ),
    ).toBe(false);
  });
  it('完成建议必须携带处理说明且刷新当前分集', async () => {
    await mount();
    button('完成建议').click();
    await settle();
    const areas = document.querySelectorAll('textarea');
    const resolution = areas[areas.length - 1]!;
    resolution.value = '字幕已替换并核对';
    resolution.dispatchEvent(new Event('input'));
    await settle();
    button('确认弹窗').click();
    await settle();
    expect(state.noteState).toHaveBeenCalledWith(
      1,
      10,
      expect.objectContaining({ id: 90, revision: 1 }),
      'resolved',
      '字幕已替换并核对',
    );
    expect(document.body.textContent).toContain('建议处理状态已更新');
  });
  it('已上架隐藏写入入口并保留复制入口', async () => {
    await mount(true, true);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.body.textContent).toContain('已上架版本已锁定');
    expect(button('复制版本修改').disabled).toBe(false);
    expect(
      [...document.querySelectorAll('button')].some(
        (b) => b.textContent?.trim() === '完成建议',
      ),
    ).toBe(false);
  });
  it('上传完整但有待处理建议时仍可交片，审片阶段继续允许替换', async () => {
    await mount();
    expect(button('交片，开始审片').disabled).toBe(false);
    cleanup();
    document.body.innerHTML = '';
    await mount(true, false, 'reviewing');
    expect(button('替换这一集').disabled).toBe(false);
    expect(button('修改完成，确认定版').disabled).toBe(true);
    expect(document.body.textContent).toContain('审片修改周期');
  });
  it('定版成片固定内容，仅保留复制或新建和上架入口', async () => {
    await mount(true, false, 'final');
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.body.textContent).toContain('成片版本已固定');
    expect(button('确认上架').disabled).toBe(false);
    expect(button('复制版本修改').disabled).toBe(false);
  });
  it('失败时保留待提交意见并显示原因', async () => {
    await mount(false);
    state.addNote.mockRejectedValue(new Error('版本已变化，请刷新'));
    const textarea = document.querySelector('textarea')!;
    textarea.value = '请保留这条草稿';
    textarea.dispatchEvent(new Event('input'));
    await settle();
    button('提交修改建议').click();
    await settle();
    expect(document.querySelector('textarea')!.value).toBe('请保留这条草稿');
    expect(document.body.textContent).toContain('版本已变化，请刷新');
  });
});
