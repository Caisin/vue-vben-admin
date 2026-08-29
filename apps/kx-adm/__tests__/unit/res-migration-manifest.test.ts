import { describe, expect, it } from 'vitest';

import {
  resMigrationAudit,
  resMigrationStats,
  resRouteComponents,
  resSourceApiFiles,
  resSourceDomains,
  resSourceViewFiles,
} from '../../src/products/migration-manifest';

const migratedViewSources = import.meta.glob(
  '../../src/views/res/seas/**/*.vue',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const migratedApiFiles = import.meta.glob('../../src/api/res/seas/**/*.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

function relativeFiles(files: Record<string, string>, marker: string) {
  return Object.keys(files).map((file) => file.split(marker)[1]);
}

describe('res migration manifest', () => {
  it('tracks the seas source file closure', () => {
    expect(resMigrationStats).toEqual({
      apiFiles: 37,
      domains: 6,
      legacySchemaFiles: 47,
      routeComponents: 116,
      viewFiles: 163,
    });
    expect(resSourceDomains).toEqual([
      'ditch',
      'global',
      'log',
      'report',
      'run',
      'set',
    ]);
    expect(resSourceViewFiles).toContain('global/source_manage/index.vue');
    expect(resSourceApiFiles).toContain('global/source_manage.ts');
    expect(resRouteComponents).toContain(
      '/res/seas/global/source_manage/index',
    );

    const views = relativeFiles(migratedViewSources, '/views/res/seas/');
    const apis = relativeFiles(migratedApiFiles, '/api/res/seas/');
    expect(
      resSourceViewFiles
        .filter((file) => file.endsWith('.vue'))
        .filter((file) => !views.includes(file)),
    ).toEqual([]);
    expect(resSourceApiFiles.filter((file) => !apis.includes(file))).toEqual(
      [],
    );
  });

  it('does not confuse generic adapters with behavioral parity', () => {
    const sources = Object.values(migratedViewSources);
    expect(
      sources.filter((source) => source.includes('ResDataPage')),
    ).toHaveLength(resMigrationAudit.genericPageAdapters);
    expect(
      sources.filter((source) => source.includes('ResRecordModal')),
    ).toHaveLength(resMigrationAudit.genericModalAdapters);
    expect(resMigrationAudit).toMatchObject({
      behaviorParity: 'partial',
      sourceClosure: 'complete',
    });
    expect(resMigrationAudit.knownGaps).not.toHaveLength(0);
  });
});
