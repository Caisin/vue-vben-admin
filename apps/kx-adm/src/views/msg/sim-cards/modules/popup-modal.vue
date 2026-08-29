<script lang="ts" setup>
import { Modal } from 'antdv-next';

defineOptions({ inheritAttrs: false });
</script>

<template>
  <Modal v-bind="$attrs">
    <template v-for="(_, key) in $slots" :key="key" #[key]="slotProps">
      <slot :name="key" v-bind="slotProps ?? {}"></slot>
    </template>
  </Modal>
</template>
