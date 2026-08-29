<script lang="ts" setup>
import { CircleHelp, ExternalLink } from '@vben/icons';

import { Tooltip } from 'antdv-next';

defineProps<{
  help: string;
  label: string;
  linkLabel?: string;
  linkUrl?: string;
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <span>{{ label }}</span>
    <Tooltip :title="help">
      <CircleHelp class="size-3.5 cursor-help text-muted-foreground" />
    </Tooltip>
    <Tooltip v-if="linkUrl" :title="linkLabel">
      <a
        class="inline-flex text-muted-foreground hover:text-primary"
        :href="linkUrl"
        rel="noopener noreferrer"
        target="_blank"
        @click.stop
      >
        <ExternalLink class="size-3.5" />
      </a>
    </Tooltip>
  </span>
</template>
