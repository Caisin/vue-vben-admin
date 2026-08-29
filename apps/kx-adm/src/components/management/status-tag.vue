<script lang="ts" setup>
import { computed } from 'vue';

import { Tag } from 'antdv-next';

import { statusMeta } from '../../management';

const props = defineProps<{ status: string }>();
const meta = computed(() => statusMeta(props.status));
</script>

<template>
  <Tag class="management-status-tag" :color="meta.color">{{ meta.label }}</Tag>
</template>

<style scoped>
.management-status-tag {
  line-height: 18px;
}
</style>
