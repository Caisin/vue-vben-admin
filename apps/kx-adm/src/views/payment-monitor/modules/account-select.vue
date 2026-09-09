<script setup lang="ts">
import type { Id } from '#/api/payment-monitor';

import { onMounted, ref } from 'vue';

import { Select } from 'antdv-next';

import { PaymentApi } from '#/api/payment-monitor';
const value = defineModel<Id>();
const options = ref<{ label: string; value: Id }[]>([]);
const loading = ref(false);
async function search(keyword = '') {
  loading.value = true;
  try {
    const result = await PaymentApi.accounts({ keyword, page: 1, size: 100 });
    options.value = result.items.map((a) => ({
      label: `${a.name} · ${a.provider}${a.livemode ? '' : ' · 测试'}`,
      value: a.id,
    }));
  } finally {
    loading.value = false;
  }
}
onMounted(() => search());
</script>
<template>
  <Select
    v-model:value="value"
    allow-clear
    show-search
    :filter-option="false"
    :options="options"
    :loading="loading"
    placeholder="搜索支付账户"
    class="!w-64"
    @search="search"
  />
</template>
