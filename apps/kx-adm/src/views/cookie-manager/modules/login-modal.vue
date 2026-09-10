<script setup lang="ts">
import type { Login, Site } from '#/api/cookie-manager';

import { ref, watch } from 'vue';

import { Alert, Button, Input, message, Modal, Space } from 'antdv-next';

import { CookieApi } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';
const props = defineProps<{ site?: Site }>();
const emit = defineEmits<{ saved: [] }>();
const open = defineModel<boolean>('open', { required: true });
const run = ref<Login>();
const code = ref('');
const busy = ref(false);
const errorText = ref('');
let generation = 0;
const labels: Record<string, string> = {
  queued_captcha: '等待获取验证码',
  queued_login: '等待登录',
  running: '后台处理中',
  captcha_ready: '请输入图片验证码',
  succeeded: '登录成功，Cookie已保存',
  failed: '登录失败',
};
const poll = useTaskPolling({
  load: () => {
    if (!run.value) throw new Error('登录流程未创建');
    return CookieApi.loginStatus(run.value.id);
  },
  accept: (value) => {
    run.value = value;
    busy.value = ['queued_captcha', 'queued_login', 'running'].includes(
      value.state,
    );
    if (value.state === 'succeeded') {
      message.success('网站登录成功，Cookie已更新');
      emit('saved');
    }
  },
  done: (value) =>
    !['queued_captcha', 'queued_login', 'running'].includes(value.state),
  onError: (e) => {
    errorText.value = requestErrorMessage(e, '读取登录状态失败');
    busy.value = false;
    poll.stop();
  },
});
async function start() {
  if (!props.site) return;
  const request = ++generation;
  poll.stop();
  busy.value = true;
  errorText.value = '';
  code.value = '';
  try {
    const result = await CookieApi.login(props.site.id);
    if (request !== generation || !open.value) return;
    run.value = result;
    poll.start();
  } catch (error) {
    if (request !== generation || !open.value) return;
    errorText.value = requestErrorMessage(error, '获取验证码失败');
    busy.value = false;
  }
}
async function submit() {
  if (!run.value || !code.value.trim()) return;
  const request = ++generation;
  poll.stop();
  busy.value = true;
  errorText.value = '';
  try {
    const result = await CookieApi.submitCaptcha(run.value.id, code.value);
    if (request !== generation || !open.value) return;
    run.value = result;
    code.value = '';
    poll.start();
  } catch (error) {
    if (request !== generation || !open.value) return;
    errorText.value = requestErrorMessage(error, '提交验证码失败');
    busy.value = false;
  }
}
watch(open, (value) => {
  if (value) {
    run.value = undefined;
    void start();
  } else {
    generation++;
    poll.stop();
    code.value = '';
    run.value = undefined;
  }
});
</script>
<template>
  <Modal
    :open="open"
    :title="`${site?.name || ''} · ${site?.account_label || ''} 后台登录`"
    :width="560"
    :footer="null"
    @cancel="open = false"
  >
    <p class="mb-4">
      使用此账号绑定的系统凭证。验证码有效10分钟，图片和Cookie属于同一后端会话；无需在第三方网页输入密码。
    </p>
    <Alert
      v-if="errorText || run?.error_message"
      type="error"
      :message="errorText || run?.error_message"
      class="mb-3"
    />
    <p>{{ labels[run?.state || ''] || '正在创建登录任务' }}</p>
    <img
      v-if="run?.captcha_data_url"
      :src="run.captcha_data_url"
      alt="网站登录验证码"
      class="my-4 border"
    /><Input
      v-if="run?.state === 'captcha_ready'"
      v-model:value="code"
      placeholder="输入图片验证码"
      autocomplete="off"
      @press-enter="submit"
    /><Space class="mt-4">
      <Button :loading="busy" @click="start">重新获取验证码</Button><Button
        v-if="run?.state === 'captcha_ready'"
        type="primary"
        :loading="busy"
        :disabled="!code.trim()"
        @click="submit"
      >
        登录并保存Cookie
      </Button>
    </Space>
  </Modal>
</template>
