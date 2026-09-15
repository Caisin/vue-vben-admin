<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';

import { Button, message, Tooltip } from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { requestErrorMessage } from '#/request-errors';

import OperationsPanel from './operations-panel.vue';

const props = defineProps<{
  id: number;
  database?: boolean;
  databaseId?: null | number;
  compact?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ finished: [] }>();
const { hasAccessByCodes } = useAccess();
const allowed = computed(() => hasAccessByCodes(['data-sync:execute']));
const busy = ref(false);
const mounted = ref(false);
const panel = ref<InstanceType<typeof OperationsPanel>>();
const label = computed(() =>
  props.databaseId ? '所属全库回执对账' : '回执对账',
);
async function reconcile() {
  if (!allowed.value || busy.value || props.disabled) return;
  busy.value = true;
  const id = props.id;
  const database = props.database;
  try {
    // 强停结果可能只携带job ID；托管表的对账必须使用所属全库授权和执行器。
    let parent = database ? id : props.databaseId;
    if (!database && !parent) {
      const detail = await DataSyncApi.detail(id);
      parent = detail.job.database_id;
    }
    if (props.id !== id || props.database !== database) return;
    mounted.value = true;
    await nextTick();
    await panel.value?.prepare(
      [{ kind: parent ? 'database' : 'job', id: parent || id }],
      'reconcile',
    );
  } catch (error) {
    message.error(requestErrorMessage(error, '对账预检失败，请重试'));
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Tooltip v-if="allowed" title="核对未完成批次的回执，对账成功后再启动同步">
    <Button
      :size="compact ? 'small' : 'middle'"
      :loading="busy"
      :disabled="disabled"
      @click="reconcile"
    >
      {{ label }}
    </Button>
  </Tooltip>
  <OperationsPanel
    v-if="mounted"
    ref="panel"
    :history="false"
    @finished="emit('finished')"
  />
</template>
