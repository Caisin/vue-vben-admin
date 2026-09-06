<script setup lang="ts">
import { computed } from 'vue';

import hljs from 'highlight.js/lib/common';
import MarkdownIt from 'markdown-it';

const props = defineProps<{ text: string }>();
const parser = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight: (text, language) =>
    language && hljs.getLanguage(language)
      ? hljs.highlight(text, { language, ignoreIllegals: true }).value
      : '',
});
const html = computed(() => parser.render(props.text));
// 模型输出不能自动加载外部图片，避免第三方跟踪或隐私外传。
parser.renderer.rules.image = (tokens, index) =>
  parser.utils.escapeHtml(tokens[index]?.content ?? '');
</script>
<template><div class="studio-markdown" v-html="html"></div></template>
<style scoped>
.studio-markdown {
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.studio-markdown :deep(p) {
  margin: 0 0 10px;
}

.studio-markdown :deep(pre) {
  padding: 14px;
  overflow: auto;
  font-size: 13px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.studio-markdown :deep(code) {
  font-family: ui-monospace, monospace;
}

.studio-markdown :deep(table) {
  display: block;
  max-width: 100%;
  overflow: auto;
  border-collapse: collapse;
}

.studio-markdown :deep(td),
.studio-markdown :deep(th) {
  padding: 6px 10px;
  border: 1px solid hsl(var(--border));
}

.studio-markdown :deep(img) {
  max-width: 100%;
}

.studio-markdown :deep(ul),
.studio-markdown :deep(ol) {
  padding-left: 24px;
}

.studio-markdown :deep(.hljs-keyword),
.studio-markdown :deep(.hljs-literal) {
  color: #b13970;
}

.studio-markdown :deep(.hljs-string),
.studio-markdown :deep(.hljs-number) {
  color: #21855b;
}

.studio-markdown :deep(.hljs-title) {
  color: #3575c7;
}

.studio-markdown :deep(.hljs-comment) {
  color: #777;
}
</style>
