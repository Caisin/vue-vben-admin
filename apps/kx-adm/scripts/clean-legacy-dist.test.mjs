import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cleanLegacyDist } from './clean-legacy-dist.mjs';

const fixtures = [];

afterEach(async () => {
  await Promise.all(
    fixtures
      .splice(0)
      .map((fixture) => rm(fixture, { force: true, recursive: true })),
  );
});

describe('clean legacy product output', () => {
  it('removes retired bundles while preserving only RES output', async () => {
    const distDir = await mkdtemp(join(tmpdir(), 'kx-dist-'));
    fixtures.push(distDir);
    await Promise.all([
      mkdir(join(distDir, 'adm')),
      mkdir(join(distDir, 'msg')),
      mkdir(join(distDir, 'res')),
      mkdir(join(distDir, 'js')),
      writeFile(join(distDir, 'index.html'), 'legacy'),
    ]);
    await writeFile(join(distDir, 'res/index.html'), 'current');

    await expect(cleanLegacyDist(distDir)).resolves.toEqual([
      'adm',
      'index.html',
      'js',
      'msg',
    ]);
    await expect(
      readFile(join(distDir, 'res/index.html'), 'utf8'),
    ).resolves.toBe('current');
  });
});
