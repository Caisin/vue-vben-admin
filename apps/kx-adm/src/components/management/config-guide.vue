<script lang="ts" setup>
import { ExternalLink } from '@vben/icons';

import { Button, Space } from 'antdv-next';

defineProps<{
  links: Array<{ label: string; url: string }>;
  steps: string[];
  title: string;
}>();
</script>

<template>
  <section class="config-guide">
    <div class="config-guide-title">{{ title }}</div>
    <ol class="config-guide-steps">
      <li v-for="step in steps" :key="step">{{ step }}</li>
    </ol>
    <Space wrap>
      <Button
        v-for="link in links"
        :key="link.url"
        :href="link.url"
        rel="noopener noreferrer"
        size="small"
        target="_blank"
        type="link"
      >
        <template #icon><ExternalLink /></template>
        {{ link.label }}
      </Button>
    </Space>
  </section>
</template>

<style scoped>
.config-guide {
  padding: 10px 12px;
  margin-bottom: 12px;
  background: hsl(var(--management-surface-muted, var(--muted)));
  border: 1px solid hsl(var(--management-border, var(--border)));
  border-left: 3px solid hsl(var(--primary));
  border-radius: var(--management-page-radius, 8px);
}

.config-guide-title {
  margin-bottom: 4px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.config-guide-steps {
  padding-left: 20px;
  margin: 0 0 4px;
  color: hsl(var(--muted-foreground));
}

.config-guide-steps li + li {
  margin-top: 2px;
}
</style>
