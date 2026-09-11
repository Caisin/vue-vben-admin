<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { ref, watch } from 'vue';

import { Form, FormItem, Input, message, Modal, Select } from 'antdv-next';

import { CookieApi } from '#/api/cookie-manager';
import CredentialSelect from '#/components/credential/credential-select.vue';
const emit = defineEmits<{ saved: [site: Site] }>();
const open = defineModel<boolean>('open', { required: true });
const username = ref('');
const password = ref('');
const credentialCode = ref<string>();
const origin = ref('https://adxray-app.dataeye.com');
const busy = ref(false);
watch(open, (value) => {
  if (value) {
    username.value = '';
    password.value = '';
    credentialCode.value = undefined;
    origin.value = 'https://adxray-app.dataeye.com';
  } else password.value = '';
});
async function save() {
  if (!password.value && !credentialCode.value) {
    message.warning('请输入密码或选择已有凭证');
    return;
  }
  if (!username.value.trim() && !credentialCode.value) {
    message.warning('请输入账号');
    return;
  }
  busy.value = true;
  try {
    const site = await CookieApi.quickDataeye({
      origin: origin.value,
      username: username.value.trim(),
      password: password.value || undefined,
      credential_code: credentialCode.value || null,
    });
    password.value = '';
    open.value = false;
    message.success('DataEye账号已添加，继续填写验证码即可');
    emit('saved', site);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    title="快速新增 DataEye"
    :width="560"
    ok-text="保存并获取验证码"
    :confirm-loading="busy"
    @ok="save"
    @cancel="open = false"
  >
    <p class="mb-4 text-sm text-muted-foreground">
      选择国内版或海外版；可输入密码新建凭证，也可选择已有账号密码凭证。
    </p>
    <Form layout="vertical">
      <FormItem label="版本" required>
        <Select
          v-model:value="origin"
          :options="[
            { label: '国内版', value: 'https://adxray-app.dataeye.com' },
            { label: '海外版', value: 'https://oversea-v2.dataeye.com' },
          ]"
        />
      </FormItem>
      <FormItem label="DataEye账号（选择凭证时可留空）">
        <Input
          v-model:value="username"
          autocomplete="off"
          placeholder="输入DataEye账号"
        />
      </FormItem>
      <FormItem label="密码（或选择已有凭证）">
        <Input.Password
          v-model:value="password"
          autocomplete="new-password"
          placeholder="输入DataEye密码"
        />
      </FormItem>
      <FormItem label="已有账号密码凭证">
        <CredentialSelect
          v-model="credentialCode"
          kind="username_password"
          create-kind="username_password"
          placeholder="选择后无需输入密码"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
