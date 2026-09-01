<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Button, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { DingtalkAppApi } from '#/api';
import { apiURL } from '#/api/request';

import { buildDingtalkCallbackBase } from './dingtalk-callback-base';

const callbackSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    componentProps: { placeholder: 'https://example.com/api/auth/dt/callback' },
    fieldName: 'callback_base_url',
    label: '回调基础地址',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm({
  schema: callbackSchema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      const values = await formApi.getValues();
      await DingtalkAppApi.saveCallbackBase({
        callback_base_url: String(values.callback_base_url ?? '').trim(),
      });
      message.success('回调地址已保存');
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    await formApi.reset();
    const config = await DingtalkAppApi.callbackBase();
    await formApi.setValues(config);
  },
});

function defaultCallbackBase() {
  return buildDingtalkCallbackBase(apiURL, window.location.origin);
}

async function fillDefaultValue() {
  await formApi.setFieldValue('callback_base_url', defaultCallbackBase());
}
</script>

<template>
  <Modal class="w-full max-w-180" title="钉钉登录回调地址">
    <Alert
      class="mx-2 mb-3"
      message="回调基础地址会参与钉钉登录跳转，请使用公网可访问的后台 API 地址；填入默认值会按当前浏览器来源推导。"
      show-icon
      type="info"
    />
    <Form class="mx-2" />
    <div class="mx-2 flex justify-end">
      <Button size="small" @click="fillDefaultValue">填入默认值</Button>
    </div>
  </Modal>
</template>
