import { defineConfig, oxfmtConfig } from '@vben/oxfmt-config';

export default defineConfig({
  overrides: [
    ...(oxfmtConfig.overrides ?? []),
    {
      files: ['apps/kx-adm/src/views/vestige/**/*.vue'],
      options: { htmlWhitespaceSensitivity: 'ignore' },
    },
  ],
  ignorePatterns: [
    'dist',
    'dev-dist',
    '.local',
    '.claude',
    '.agent',
    '.agents',
    '.codex',
    '.output.js',
    'node_modules',
    '.nvmrc',
    'coverage',
    'CODEOWNERS',
    '.nitro',
    '.output',
    '**/*.svg',
    '**/*.sh',
    'public',
    '.npmrc',
    '*-lock.yaml',
    'skills-lock.json',
    'apps/kx-adm/src/views/res/seas/global/order/index.vue',
    'apps/kx-adm/src/views/res/seas/global/return_config/index.vue',
    'apps/kx-adm/src/views/res/seas/global/tmplate_lib/TmpReviewModal.vue',
    'apps/kx-adm/src/views/res/seas/set/def_tmplate_lib/index.vue',
    'apps/kx-adm/src/views/software/applications/list.vue',
  ],
});
