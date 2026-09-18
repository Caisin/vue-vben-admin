<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { Tag } from 'antdv-next';

import { cookieStatus } from '#/api/cookie-manager';
import { Times } from '#/times';

defineProps<{ site: Site }>();
</script>

<template>
  <article
    class="cookie-site-card"
    :aria-label="`${site.name} · ${site.account_label}`"
  >
    <header class="flex items-start justify-between gap-2">
      <h2 class="min-w-0 text-base font-semibold">{{ site.name }}</h2>
      <Tag class="!m-0 shrink-0" :color="cookieStatus[site.status]?.color">
        {{ cookieStatus[site.status]?.label || site.status }}
      </Tag>
    </header>
    <p class="mt-2 font-medium">{{ site.account_label }}</p>
    <p class="mt-1 text-sm text-muted-foreground">{{ site.origin }}</p>
    <dl class="mt-3 space-y-2 text-sm">
      <div class="flex flex-wrap justify-between gap-x-3 gap-y-1">
        <dt class="text-muted-foreground">最早到期</dt>
        <dd>
          {{
            site.expires_at
              ? Times.formatOptionalUnix(site.expires_at)
              : '未指定'
          }}
        </dd>
      </div>
      <slot name="details"></slot>
    </dl>
    <div class="cookie-card-actions mt-4"><slot></slot></div>
  </article>
</template>

<style scoped>
.cookie-site-card {
  min-width: 0;
  padding: 16px;
  overflow-wrap: anywhere;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.cookie-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cookie-card-actions :deep(.ant-btn) {
  min-height: 40px;
  padding-inline: 8px;
}
</style>
