import { describe, expect, it } from 'vitest';

import { projectForm, projectWrite } from './project-form';
describe('project canon editing', () => {
  it('preserves Agent-managed canon and workbench extension fields', () => {
    const canon = {
      characters: [{ name: '林夏', arc: '抉择' }],
      workbench: { world: '夜站', extension: { locked: true } },
    };
    const form = {
      ...projectForm(),
      name: '夜站',
      brief: '原创短剧',
      world: '新夜站',
    };
    const result = projectWrite(form, canon);
    expect(result.canon).toEqual({
      characters: canon.characters,
      workbench: {
        world: '新夜站',
        characters: '',
        constraints: '',
        extension: { locked: true },
      },
    });
    expect(canon.workbench.world).toBe('夜站');
  });
  it('rejects incompatible structured values instead of overwriting them', () => {
    const form = { ...projectForm(), name: '夜站', brief: '短剧' };
    expect(() => projectWrite(form, { workbench: [] })).toThrow('格式不兼容');
    expect(() =>
      projectWrite(form, { workbench: { characters: ['林夏'] } }),
    ).toThrow('不能用空文本覆盖');
  });
  it('enforces UTF-8 limits including preserved canon', () => {
    const form = { ...projectForm(), name: '夜站', brief: '剧'.repeat(6000) };
    expect(() => projectWrite(form)).toThrow('设定过长');
    expect(() =>
      projectWrite({ ...form, brief: '短剧' }, { extra: '设'.repeat(11_000) }),
    ).toThrow('设定过长');
  });
});
