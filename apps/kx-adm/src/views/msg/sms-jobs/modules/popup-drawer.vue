<script lang="ts" setup>
import { Drawer } from 'antdv-next';

defineOptions({ inheritAttrs: false });
</script>

<template>
  <Drawer v-bind="$attrs">
    <template v-for="(_, key) in $slots" :key="key" #[key]="slotProps">
      <slot :name="key" v-bind="slotProps ?? {}"></slot>
    </template>
  </Drawer>
</template>
