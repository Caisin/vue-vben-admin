import { describe, expect, it } from 'vitest';

import { customSourceFrom } from './custom-source';

describe('custom recipes', () => {
  it('keeps command arguments separate and leaves the source unchanged', () => {
    const input = {
      args: ['--listen', '127.0.0.1:9000'],
      install_steps: [
        { program: 'make', args: ['-j2'], working_directory: '{release}' },
      ],
    };
    const result = customSourceFrom(input);
    result.install_steps[0]?.args.push('install');
    expect(input.install_steps[0]?.args).toEqual(['-j2']);
    expect(result.args).toEqual(['--listen', '127.0.0.1:9000']);
  });
});
