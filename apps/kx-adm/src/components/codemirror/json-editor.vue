<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Minimize2, SquareCode } from '@vben/icons';
import { usePreferences } from '@vben/preferences';

import { json } from '@codemirror/lang-json';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button, Tooltip } from 'antdv-next';
import { basicSetup, EditorView } from 'codemirror';
import JsonBigint from 'json-bigint';

import { formatJsonText } from './json-format';

export interface JsonEditorProps {
  allowEmpty?: boolean;
  maxHeight?: string;
  minHeight?: string;
  modelValue?: unknown;
  placeholder?: string;
  readonly?: boolean;
  stringifySpace?: number;
  valueMode?: 'json' | 'text';
}

const props = withDefaults(defineProps<JsonEditorProps>(), {
  allowEmpty: false,
  maxHeight: '420px',
  minHeight: '220px',
  modelValue: undefined,
  placeholder: '请输入 JSON',
  readonly: false,
  stringifySpace: 2,
  valueMode: 'json',
});

const emit = defineEmits<{
  parseError: [message: string];
  'update:modelValue': [value: unknown];
  validChange: [valid: boolean, message?: string];
}>();

const { isDark } = usePreferences();
const jsonParser = JsonBigint({ storeAsString: true, strict: true });
const editorContainer = ref<HTMLDivElement | null>(null);
const parseMessage = ref('');
const valid = ref(true);
const view = ref<EditorView | null>(null);
const editableConf = new Compartment();
const themeConf = new Compartment();

const lightTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'white',
      color: 'black',
    },
    '.cm-placeholder': {
      color: 'hsl(var(--muted-foreground))',
    },
    '.cm-scroller': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
  },
  { dark: false },
);

const readonlyTheme = EditorView.theme({
  '&.cm-editor.cm-focused': {
    outline: 'none',
  },
});

const theme = computed(() => (isDark.value ? oneDark : lightTheme));
const containerStyle = computed(() => ({
  '--json-editor-max-height': props.maxHeight,
  '--json-editor-min-height': props.minHeight,
}));

function serialize(value: unknown) {
  if (value === undefined || value === '') return '';
  if (props.valueMode === 'text' && typeof value === 'string') return value;
  const result = JsonBigint.stringify(value, null, props.stringifySpace);
  return result === undefined ? '' : result;
}

function parseJson(doc: string) {
  if (!doc.trim()) {
    if (props.allowEmpty) return undefined;
    throw new SyntaxError('JSON 不能为空');
  }
  return jsonParser.parse(doc) as unknown;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'JSON 格式不正确';
}

function setValidState(nextValid: boolean, messageText = '') {
  const changed =
    valid.value !== nextValid || parseMessage.value !== messageText;
  valid.value = nextValid;
  parseMessage.value = messageText;
  if (changed) emit('validChange', nextValid, messageText || undefined);
}

function publishDoc(doc: string) {
  if (props.valueMode === 'text') {
    emit('update:modelValue', doc);
  }
  try {
    const parsed = parseJson(doc);
    setValidState(true);
    if (props.valueMode === 'json') emit('update:modelValue', parsed);
  } catch (error) {
    const messageText = errorMessage(error);
    setValidState(false, messageText);
    emit('parseError', messageText);
  }
}

function transformDoc(space: number) {
  if (props.readonly || !view.value) return;
  try {
    const nextDoc = formatJsonText(view.value.state.doc.toString(), space);
    replaceDoc(nextDoc);
    setValidState(true);
    view.value.focus();
  } catch (error) {
    const messageText = errorMessage(error);
    setValidState(false, messageText);
    emit('parseError', messageText);
  }
}

function prettyPrint() {
  transformDoc(Math.max(1, props.stringifySpace));
}

function compactPrint() {
  transformDoc(0);
}

function replaceDoc(doc: string) {
  if (!view.value || doc === view.value.state.doc.toString()) return;
  view.value.dispatch({
    changes: {
      from: 0,
      insert: doc,
      to: view.value.state.doc.length,
    },
  });
}

onMounted(() => {
  if (!editorContainer.value) return;
  const startDoc = serialize(props.modelValue);
  view.value = new EditorView({
    doc: startDoc,
    extensions: [
      basicSetup,
      json(),
      readonlyTheme,
      themeConf.of(theme.value),
      editableConf.of([
        EditorView.editable.of(!props.readonly),
        EditorState.readOnly.of(props.readonly),
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || props.readonly) return;
        publishDoc(update.state.doc.toString());
      }),
    ],
    parent: editorContainer.value,
  });
});

watch(
  () => props.modelValue,
  (value) => replaceDoc(serialize(value)),
);

watch(
  () => props.readonly,
  (readonly) => {
    view.value?.dispatch({
      effects: editableConf.reconfigure([
        EditorView.editable.of(!readonly),
        EditorState.readOnly.of(readonly),
      ]),
    });
  },
);

watch(
  () => isDark.value,
  () => {
    view.value?.dispatch({ effects: themeConf.reconfigure(theme.value) });
  },
);

onBeforeUnmount(() => {
  view.value?.destroy();
  view.value = null;
});
</script>

<template>
  <div class="json-editor-shell" :class="{ invalid: !valid }">
    <div aria-label="JSON 编辑工具" class="json-editor-toolbar" role="toolbar">
      <Tooltip title="格式化 JSON">
        <Button
          aria-label="格式化 JSON"
          :disabled="readonly || !view"
          size="small"
          type="text"
          @click="prettyPrint"
        >
          <template #icon><SquareCode /></template>
        </Button>
      </Tooltip>
      <Tooltip title="压缩 JSON">
        <Button
          aria-label="压缩 JSON"
          :disabled="readonly || !view"
          size="small"
          type="text"
          @click="compactPrint"
        >
          <template #icon><Minimize2 /></template>
        </Button>
      </Tooltip>
    </div>
    <div
      ref="editorContainer"
      class="json-editor"
      :aria-label="placeholder"
      :style="containerStyle"
    ></div>
    <div v-if="!valid" class="json-editor-error">{{ parseMessage }}</div>
  </div>
</template>

<style scoped>
.json-editor-shell {
  width: 100%;
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.json-editor-shell.invalid {
  border-color: hsl(var(--destructive));
}

.json-editor-toolbar {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  height: 34px;
  padding: 2px 6px;
  background: hsl(var(--muted) / 40%);
  border-bottom: 1px solid hsl(var(--border));
}

.json-editor-toolbar :deep(.ant-btn) {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
}

.json-editor {
  overflow: hidden;
  border-radius: 0 0 6px 6px;
}

.json-editor :deep(.cm-editor) {
  min-height: var(--json-editor-min-height);
  max-height: var(--json-editor-max-height);
  font-size: 13px;
}

.json-editor :deep(.cm-scroller) {
  max-height: var(--json-editor-max-height);
  overflow: auto;
}

.json-editor :deep(.cm-content) {
  min-height: var(--json-editor-min-height);
}

.json-editor-error {
  padding: 6px 10px;
  font-size: 12px;
  color: hsl(var(--destructive));
  background: hsl(var(--muted));
  border-top: 1px solid hsl(var(--border));
}
</style>
