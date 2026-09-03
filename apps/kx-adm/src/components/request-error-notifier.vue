<script lang="ts" setup>
import { onBeforeUnmount } from 'vue';

import { App } from 'antdv-next';

import { setRequestErrorNotifier } from '#/api/request';

const { message } = App.useApp();

setRequestErrorNotifier((content) => {
  void message.error(content);
});

onBeforeUnmount(() => setRequestErrorNotifier());
</script>

<template>
  <span aria-hidden="true" class="hidden"></span>
</template>
