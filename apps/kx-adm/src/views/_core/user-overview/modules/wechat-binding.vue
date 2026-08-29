<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WechatBindingRequest } from '#/api/core/account-binding';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { AccountBindingApi } from '#/api';

const emit = defineEmits<{ success: [] }>();

const schema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: {
      options: [],
      placeholder: '请选择已启用的微信应用',
    },
    fieldName: 'app_id',
    label: '微信应用',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '小程序身份', value: 'wx_mini_app' },
        { label: '小程序手机号', value: 'wx_mini_tel' },
      ],
    },
    defaultValue: 'wx_mini_app',
    fieldName: 'login_type',
    label: '授权类型',
    rules: 'selectRequired',
  },
  {
    component: 'InputPassword',
    componentProps: { autocomplete: 'one-time-code' },
    fieldName: 'code',
    label: '临时授权码',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm({
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      const values = (await formApi.getValues()) as WechatBindingRequest;
      await AccountBindingApi.bind_wechat({
        app_id: values.app_id.trim(),
        code: values.code,
        login_type: values.login_type,
      });
      message.success('微信登录方式已绑定');
      modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    await formApi.reset();
    const apps = await AccountBindingApi.bindable_wechat_apps();
    await formApi.updateSchema([
      {
        componentProps: {
          options: apps.map((app) => ({
            label: `${app.app_name}（${app.app_id}）`,
            value: app.app_id,
          })),
          placeholder:
            apps.length > 0 ? '请选择微信应用' : '暂无已启用的微信应用',
        },
        fieldName: 'app_id',
      },
    ]);
    await formApi.setValues({
      app_id: apps[0]?.app_id,
      login_type: 'wx_mini_app',
    });
  },
});
</script>

<template>
  <Modal class="w-full max-w-140" title="绑定微信登录方式">
    <Form class="mx-2" />
  </Modal>
</template>
