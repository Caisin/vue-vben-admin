<script setup lang="ts">
import type { Site } from '#/api/cookie-manager';

import { ref, watch } from 'vue';

import { Form, FormItem, Input, message, Modal } from 'antdv-next';

import { CookieApi } from '#/api/cookie-manager';
const emit = defineEmits<{ saved: [site: Site] }>();
const open = defineModel<boolean>('open', { required: true });
const username = ref('');
const password = ref('');
const busy = ref(false);
watch(open, (value) => {
  if (value) {
    username.value = '';
    password.value = '';
  } else password.value = '';
});
async function save() {
  if (!username.value.trim() || !password.value) {
    message.warning('请输入DataEye账号和密码');
    return;
  }
  busy.value = true;
  try {
    const site = await CookieApi.quickDataeye({
      username: username.value.trim(),
      password: password.value,
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
    :width="520"
    ok-text="保存并获取验证码"
    :confirm-loading="busy"
    @ok="save"
    @cancel="open = false"
  >
    <p class="mb-4 text-sm text-muted-foreground">
      账号密码自动保存到系统凭证中心。网站地址、名称和有效期提醒使用默认配置。
    </p>
    <Form layout="vertical">
      <FormItem label="DataEye账号" required>
        <Input
          v-model:value="username"
          autocomplete="off"
          placeholder="输入DataEye账号"
        />
</FormItem><FormItem label="密码" required>
        <Input.Password
          v-model:value="password"
          autocomplete="new-password"
          placeholder="输入DataEye密码"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
