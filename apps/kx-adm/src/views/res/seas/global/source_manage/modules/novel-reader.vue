<script setup lang="ts">
import type { Id, VersionDetail } from '#/api/res/versions';

import { computed, nextTick, ref, watch } from 'vue';

import { Button, Empty, Input, Modal } from 'antdv-next';
const props = defineProps<{ detail: VersionDetail; resourceName: string }>();
const open = ref(false);
const selected = ref<Id>();
const search = ref('');
const fontSize = ref(18);
const article = ref<HTMLElement>();
const chapters = computed(() =>
  props.detail.items.toSorted((a, b) => a.seq_no - b.seq_no),
);
const filtered = computed(() =>
  chapters.value.filter((c) =>
    `${c.seq_no} ${c.title}`.includes(search.value.trim()),
  ),
);
const index = computed(() =>
  chapters.value.findIndex((c) => String(c.id) === String(selected.value)),
);
const chapter = computed(() => chapters.value[index.value]);
async function select(id: Id) {
  selected.value = id;
  await nextTick();
  article.value?.scrollTo({ top: 0 });
}
function show(id?: Id) {
  search.value = '';
  open.value = true;
  const chapter =
    chapters.value.find((c) => String(c.id) === String(id)) ??
    chapters.value[0];
  if (chapter) void select(chapter.id);
}
function move(offset: number) {
  const target = chapters.value[index.value + offset];
  if (target) void select(target.id);
}
watch(
  () => props.detail.version.id,
  () => {
    open.value = false;
    selected.value = undefined;
  },
);
watch(
  () => props.detail.items,
  () => {
    if (open.value && !chapter.value && chapters.value[0])
      void select(chapters.value[0].id);
  },
);
defineExpose({ show });
</script>
<template>
  <Button :disabled="!chapters.length" @click="show()">章节预览</Button>
  <Modal
    v-model:open="open"
    :title="`${resourceName} · ${detail.version.name} · 章节预览`"
    :width="1100"
    :z-index="970"
    :footer="null"
  >
    <div class="reader-layout">
      <aside class="reader-nav" aria-label="章节目录">
        <strong>章节目录 · {{ chapters.length }} 章</strong>
        <Input
          v-model:value="search"
          placeholder="搜索章节"
          allow-clear
          class="my-3"
        />
        <nav class="chapter-list" aria-label="选择章节">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            :aria-pressed="String(item.id) === String(selected)"
            @click="select(item.id)"
          >
            <span>{{ item.seq_no }}</span>{{ item.title }}
          </button>
        </nav>
      </aside>
      <section class="min-w-0" aria-label="章节正文">
        <div class="reader-toolbar">
          <span>第 {{ index + 1 }} / {{ chapters.length }} 章</span><Button
            size="small"
            :disabled="fontSize <= 14"
            @click="fontSize -= 2"
          >
            缩小字号
</Button><Button
            size="small"
            :disabled="fontSize >= 26"
            @click="fontSize += 2"
          >
            放大字号
          </Button>
        </div>
        <article
          v-if="chapter"
          ref="article"
          class="reader-article"
          :style="{ fontSize: `${fontSize}px` }"
          tabindex="0"
        >
          <h2>{{ chapter.title }}</h2>
          <p>{{ chapter.content }}</p>
        </article>
        <Empty v-else description="当前版本暂无章节" />
        <div class="reader-footer">
          <Button :disabled="index <= 0" @click="move(-1)">上一章</Button><span>{{ chapter?.content.length ?? 0 }} 字符</span><Button :disabled="index >= chapters.length - 1" @click="move(1)">
            下一章
          </Button>
        </div>
      </section>
    </div>
  </Modal>
</template>
<style scoped>
.reader-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
}

.reader-nav {
  min-width: 0;
  padding-right: 16px;
  border-right: 1px solid hsl(var(--border));
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 59vh;
  overflow: auto;
}

.chapter-list button {
  display: flex;
  gap: 10px;
  padding: 10px;
  text-align: left;
  overflow-wrap: anywhere;
  border-radius: 6px;
}

.chapter-list button[aria-pressed='true'] {
  color: hsl(var(--primary));
  background: hsl(var(--accent));
}

.chapter-list span {
  color: hsl(var(--muted-foreground));
}

.reader-toolbar,
.reader-footer {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
}

.reader-toolbar span {
  flex: 1;
  color: hsl(var(--muted-foreground));
}

.reader-footer {
  justify-content: space-between;
  border-top: 1px solid hsl(var(--border));
}

.reader-article {
  height: 58vh;
  padding: 24px 30px;
  overflow: auto;
  line-height: 1.95;
  overflow-wrap: anywhere;
  background: hsl(var(--muted) / 35%);
  border-radius: 8px;
}

.reader-article h2 {
  margin-bottom: 24px;
  font-size: 1.3em;
  font-weight: 600;
}

.reader-article p {
  white-space: pre-wrap;
}

@media (max-width: 767px) {
  .reader-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .reader-nav {
    padding: 0;
    border-right: 0;
  }

  .chapter-list {
    max-height: 130px;
  }

  .reader-article {
    height: 42vh;
    padding: 18px;
  }
}
</style>
