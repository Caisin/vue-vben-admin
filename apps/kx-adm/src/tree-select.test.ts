import { describe, expect, it } from 'vitest';

import { prependTreeOption, wrapTreeWithRoot } from './tree-select';

interface TestNode {
  children?: TestNode[];
  id: string;
  name: string;
}

describe('tree select semantic options', () => {
  const items: TestNode[] = [{ id: '1', name: '业务节点' }];

  it('wraps the existing tree in a selectable semantic root', () => {
    expect(wrapTreeWithRoot(items, { id: '0', name: '根节点' })).toEqual([
      {
        children: items,
        id: '0',
        name: '根节点',
      },
    ]);
  });

  it('prepends a standalone semantic option', () => {
    expect(prependTreeOption(items, { id: '0', name: '未归属' })).toEqual([
      { id: '0', name: '未归属' },
      ...items,
    ]);
  });
});
