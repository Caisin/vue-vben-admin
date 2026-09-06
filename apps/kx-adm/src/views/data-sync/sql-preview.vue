<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createIconifyIcon } from '@vben/icons';
import { usePreferences } from '@vben/preferences';

import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { useClipboard } from '@vueuse/core';
import { Button, message, Tooltip } from 'antdv-next';
import { basicSetup, EditorView } from 'codemirror';

import { formatTargetDdl } from './sql-format';

const props = defineProps<{ value: string }>();
const Copy = createIconifyIcon('lucide:copy');
const { isDark } = usePreferences();
const { copy } = useClipboard({ legacy: true });
const container = ref<HTMLElement>();
const formatted = computed(() => formatTargetDdl(props.value));
const theme = new Compartment();
let editor: EditorView | undefined;
const baseTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
  },
  '.cm-scroller': {
    maxHeight: '420px',
    minHeight: '140px',
    overflow: 'auto',
    fontFamily: 'ui-monospace, monospace',
  },
});
onMounted(() => {
  editor = new EditorView({
    parent: container.value,
    doc: formatted.value.sql,
    extensions: [
      basicSetup,
      sql({ dialect: PostgreSQL }),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': '目标 DDL SQL',
        'aria-readonly': 'true',
        role: 'textbox',
        tabindex: '0',
      }),
      baseTheme,
      theme.of(isDark.value ? oneDark : []),
    ],
  });
});
watch(formatted, (value) => {
  if (editor)
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value.sql },
    });
});
watch(isDark, (value) =>
  editor?.dispatch({ effects: theme.reconfigure(value ? oneDark : []) }),
);
onBeforeUnmount(() => editor?.destroy());
async function copySql() {
  try {
    await copy(formatted.value.sql);
    message.success('SQL 已复制');
  } catch {
    message.error('复制失败，请选中 SQL 后复制');
  }
}
</script>
<template>
  <div class="sql-preview">
    <div class="sql-toolbar">
      <span>SQL</span>
      <span v-if="!formatted.formatted" role="status">格式化未成功，保留原文</span>
      <Tooltip title="复制 SQL" :z-index="2500">
        <Button
          size="small"
          aria-label="复制 SQL"
          :disabled="!formatted.sql"
          @click="copySql"
        >
          <Copy class="size-4" />
        </Button>
      </Tooltip>
    </div>
    <div ref="container"></div>
  </div>
</template>
<style scoped>
.sql-preview {
  min-width: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.sql-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid hsl(var(--border));
}

.sql-toolbar > :last-child {
  margin-left: auto;
}
</style>
