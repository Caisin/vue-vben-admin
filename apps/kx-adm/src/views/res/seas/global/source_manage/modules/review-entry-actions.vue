<script setup lang="ts">
import type { ResRecord } from '#/api/res/seas/global/source_manage';

import { ref } from 'vue';

import { Button, Modal } from 'antdv-next';

import ReviewMembers from './review-members.vue';
import ReviewWorkbench from './review-workbench.vue';

const props = defineProps<{ resource: ResRecord; canManage: boolean }>();
const membersOpen = ref(false);
const reviewOpen = ref(false);
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
    <Button size="small" type="link" @click="reviewOpen = true">
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
    <Modal
      v-model:open="reviewOpen"
      :title="`${resource.res_name || resource.title || '作品'} · 作品审核`"
      width="min(1600px, 96vw)"
      :style="{ top: '3vh' }"
      :styles="{ body: { maxHeight: '86vh', overflowY: 'auto' } }"
      :z-index="960"
      :footer="null"
      :mask-closable="false"
      destroy-on-close
    >
      <ReviewWorkbench
        v-if="reviewOpen"
        :key="String(props.resource.id)"
        :res="resource.id"
        :name="resource.res_name || resource.title || '作品'"
      />
    </Modal>
  </div>
</template>
