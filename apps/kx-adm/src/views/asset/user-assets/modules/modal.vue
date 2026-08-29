<script lang="ts" setup>
import { useVbenModal } from '@vben/common-ui';

const [Modal] = useVbenModal({ destroyOnClose: false });
</script>

<template>
  <Modal><slot></slot></Modal>
</template>
