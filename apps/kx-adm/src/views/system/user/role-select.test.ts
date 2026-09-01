import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({ Tag: {} }));

describe('user role select', () => {
  it('uses TreeSelect treeData instead of Select options', async () => {
    const { useFormSchema } = await import('./data');
    const role = useFormSchema(() => []).find(
      (item) => item.fieldName === 'roles',
    );
    expect(role?.component).toBe('TreeSelect');
    expect(role?.componentProps).toMatchObject({ treeData: [] });
    expect(role?.componentProps).not.toHaveProperty('options');
  });
});
