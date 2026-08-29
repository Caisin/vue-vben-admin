<script lang="ts" setup>
import type {
  NotifyChannel,
  WeeklyReportPublish,
  WeeklyReportRepublishRequest,
} from '#/api';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { SystemUserApi } from '#/api';

import { useWeeklyReportRepublishSchema } from '../data';

interface ModalData {
  channels: NotifyChannel[];
  publish: WeeklyReportPublish;
}

const emit = defineEmits<{
  success: [publishId: number | string];
}>();
const publish = ref<WeeklyReportPublish>();

const [Form, formApi] = useVbenForm<WeeklyReportRepublishRequest>({
  layout: 'vertical',
  schema: useWeeklyReportRepublishSchema([]),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal<ModalData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !publish.value) return;
    modalApi.lock();
    try {
      const values = await formApi.getValues();
      const task = await SystemUserApi.weekly_report_republish(
        publish.value.id,
        values,
      );
      message.success(`周报重新推送已提交：#${task.id}`);
      const publishId = publish.value.id;
      modalApi.close();
      emit('success', publishId);
    } finally {
      modalApi.lock(false);
    }
  },
  async onOpenChange(open) {
    if (!open) return;
    const data = modalApi.getData();
    if (!data) return;
    publish.value = data.publish;
    await formApi.updateSchema(useWeeklyReportRepublishSchema(data.channels));
    await formApi.setValues({
      channel_id: Number(data.publish.channel_id),
      notification_style: data.publish.notification_style ?? 'link_card',
    });
  },
});
</script>

<template>
  <Modal title="重新推送周报">
    <Form class="mx-4" />
  </Modal>
</template>
