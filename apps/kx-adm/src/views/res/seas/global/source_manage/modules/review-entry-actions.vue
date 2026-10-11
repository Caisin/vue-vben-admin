<script setup lang="ts">
import type { ResRecord } from '#/api/res/seas/global/source_manage';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from 'antdv-next';

import ReviewMembers from './review-members.vue';

const props = defineProps<{ resource: ResRecord; canManage: boolean }>();
const membersOpen = ref(false);
const router = useRouter();
</script>
<template>
  <div
    v-if="resource.res_type === 'drama'"
    class="flex flex-wrap justify-center gap-1"
  >
    <Button
      v-if="canManage"
      size="small"
      type="link"
      @click="membersOpen = true"
    >
      协作者
    </Button>
    <Button
      size="small"
      type="link"
      @click="
        router.push({
          path: '/resource-review',
          query: { res: String(resource.id) },
        })
      "
    >
      作品审核
    </Button>
    <ReviewMembers
      v-if="membersOpen"
      :key="String(resource.id)"
      v-model:open="membersOpen"
      :res="resource.id"
      :name="resource.res_name || resource.title"
      :show-trigger="false"
    />
  </div>
</template>
