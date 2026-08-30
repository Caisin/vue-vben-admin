<script lang="ts" setup>
import { ref } from 'vue';

import { ChevronDown, ExternalLink } from '@vben/icons';

import { Button, Space } from 'antdv-next';

defineProps<{
  links: Array<{ label: string; url: string }>;
  steps: string[];
  title: string;
}>();

const expanded = ref(false);
</script>

<template>
  <section class="config-guide">
    <button
      :aria-expanded="expanded"
      class="config-guide-trigger"
      type="button"
      @click="expanded = !expanded"
    >
      <span class="config-guide-title">{{ title }}</span>
      <span class="config-guide-action">
        {{ expanded ? '收起配置说明' : '展开配置说明' }}
        <ChevronDown
          class="config-guide-chevron"
          :class="{ 'config-guide-chevron-expanded': expanded }"
        />
      </span>
    </button>
    <div v-if="expanded" class="config-guide-content">
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
    </div>
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

.config-guide-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.config-guide-title {
  font-weight: 650;
  color: hsl(var(--foreground));
}

.config-guide-action {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
  margin-left: 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.config-guide-chevron {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.config-guide-chevron-expanded {
  transform: rotate(180deg);
}

.config-guide-content {
  margin-top: 4px;
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
