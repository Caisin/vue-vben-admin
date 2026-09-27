import type {
  ProjectFormat,
  ProjectWrite,
  WriterProject,
} from '#/api/vestige/projects';
export interface ProjectForm {
  name: string;
  format: ProjectFormat;
  brief: string;
  world: string;
  characters: string;
  constraints: string;
  role_version: number;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function settings(canon: Record<string, unknown>) {
  const value = canon.workbench;
  if (value !== undefined && !object(value))
    throw new Error(
      '此项目的工作台设定格式不兼容，请先由 Agent 调整；原有设定未修改',
    );
  return value ?? {};
}
export function projectForm(project?: WriterProject, version = 0): ProjectForm {
  const data = settings(project?.canon ?? {});
  return {
    name: project?.name ?? '',
    format: project?.format ?? 'short_drama',
    brief: project?.brief ?? '',
    role_version: project?.role_version ?? version,
    world: typeof data.world === 'string' ? data.world : '',
    characters: typeof data.characters === 'string' ? data.characters : '',
    constraints: typeof data.constraints === 'string' ? data.constraints : '',
  };
}
/** 仅更新工作台拥有的文本字段，不覆盖 Agent 的人物、世界观或其他扩展字段。 */
export function projectWrite(
  form: ProjectForm,
  prior: Record<string, unknown> = {},
): ProjectWrite {
  const old = settings(prior);
  for (const key of ['world', 'characters', 'constraints'] as const) {
    if (old[key] !== undefined && typeof old[key] !== 'string')
      throw new Error('原有工作台设定包含结构化字段，不能用空文本覆盖');
  }
  const result = {
    name: form.name.trim(),
    format: form.format,
    brief: form.brief.trim(),
    role_version: form.role_version,
    canon: {
      ...prior,
      workbench: {
        ...old,
        world: form.world.trim(),
        characters: form.characters.trim(),
        constraints: form.constraints.trim(),
      },
    },
  };
  if (!result.name || !result.brief)
    throw new Error('请填写项目名称与创作简述');
  if (
    new TextEncoder().encode(result.brief).length > 16_000 ||
    new TextEncoder().encode(JSON.stringify(result.canon)).length > 32_000
  )
    throw new Error('项目设定过长，请精简后再保存');
  return result;
}
