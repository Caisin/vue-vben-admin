<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { layouts, themes } from './style-options';
const route = useRoute();
const theme = computed(
  () =>
    themes.find((item) => item.value === route.query.theme) ??
    themes[0] ?? { color: '#fff', accent: '#111', detail: '', sample: 'APP.' },
);
const layout = computed(
  () =>
    layouts.find((item) => item.value === route.query.layout) ??
    layouts[0] ?? { label: '', detail: '' },
);
</script>
<template>
  <main
    class="min-h-screen p-4 md:p-10"
    :style="{ background: theme.color, color: theme.accent }"
  >
    <header class="mx-auto max-w-6xl">
      <p class="text-sm uppercase tracking-[0.3em]">{{ theme.detail }}</p>
      <h1 class="mt-8 text-4xl md:text-7xl font-bold">{{ theme.sample }}</h1>
      <p class="mt-4 text-xl">{{ layout.label }} · {{ layout.detail }}</p>
    </header>
    <section
      class="mx-auto mt-16 grid max-w-6xl grid-cols-1 md:grid-cols-3 gap-5"
    >
      <article
        v-for="item in ['应用介绍', '功能亮点', '立即下载']"
        :key="item"
        class="rounded-2xl border border-current/30 p-8 text-2xl"
      >
        {{ item }}
      </article>
    </section>
  </main>
</template>
