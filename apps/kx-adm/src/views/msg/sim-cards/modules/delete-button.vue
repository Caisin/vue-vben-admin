<script setup lang="ts">
import type { SimCardView } from '#/api/msg';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, Button, message, Modal, Tooltip } from 'antdv-next';

import { SimCardApi } from '#/api/msg';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{ card: SimCardView }>();
const emit = defineEmits<{ deleted: [iccid: string] }>();
const { hasAccessByCodes } = useAccess();
const allowed = computed(() => hasAccessByCodes(['sim_cards:manage']));
const open = ref(false);
const busy = ref(false);
const errorMessage = ref('');

function confirm() {
  errorMessage.value = '';
  open.value = true;
}

async function remove() {
  if (!allowed.value || busy.value) return;
  const iccid = props.card.iccid;
  busy.value = true;
  errorMessage.value = '';
  try {
    await SimCardApi.delete(iccid);
    open.value = false;
    message.success('SIM 卡已删除');
    emit('deleted', iccid);
  } catch (error) {
    const code = requestErrorMessage(error, '删除失败，请稍后重试');
    errorMessage.value =
      {
        msg_sim_in_device:
          '该卡仍在设备卡槽中，请先拔卡并等待设备刷新后再删除。',
        msg_sim_not_found: '该卡已不存在，请刷新列表。',
      }[code] ?? code;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <template v-if="allowed">
    <Tooltip
      :title="card.device_code ? '请先拔卡并等待设备刷新' : '删除 SIM 卡'"
    >
      <span>
        <Button
          aria-label="删除 SIM 卡"
          danger
          size="small"
          :disabled="!!card.device_code"
          @click="confirm"
        >
          删除
        </Button>
      </span>
    </Tooltip>
    <Modal
      v-model:open="open"
      title="删除 SIM 卡"
      ok-text="删除"
      ok-type="danger"
      cancel-text="取消"
      :confirm-loading="busy"
      :cancel-button-props="{ disabled: busy }"
      :closable="!busy"
      :mask-closable="!busy"
      :keyboard="!busy"
      :z-index="2400"
      @ok="remove"
    >
      <p>号码：{{ card.phone_number || '未知' }}</p>
      <p>ICCID：{{ card.iccid }}</p>
      <p>
        删除卡片档案和分组关联，保留短信、通话、位置历史及号码账号。删除无法撤销，重新插卡后设备可再次发现该卡。
      </p>
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        type="error"
        show-icon
      />
    </Modal>
  </template>
</template>
