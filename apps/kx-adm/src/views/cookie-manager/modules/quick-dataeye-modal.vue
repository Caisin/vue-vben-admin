<script setup lang="ts">
import type { Id, Site } from '#/api/cookie-manager';

import { ref, watch } from 'vue';

import { Form, FormItem, Input, message, Modal, Select } from 'antdv-next';

import { AdminUserApi } from '#/api/auth/admin';
import { CookieApi } from '#/api/cookie-manager';
const emit = defineEmits<{ saved: [site: Site] }>();
const open = defineModel<boolean>('open', { required: true });
const username = ref('');
const password = ref('');
const uids = ref<Id[]>([]);
const busy = ref(false);
const users = ref<{ label: string; value: string }[]>([]);
async function search(keyword = '') {
  const r = await AdminUserApi.list({ page: 1, size: 100, keyword });
  users.value = r.items.map((u) => ({ label: u.name, value: String(u.id) }));
}
watch(open, (value) => {
  if (value) {
    username.value = '';
    password.value = '';
    uids.value = [];
    void search();
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
      allowed_uids: uids.value,
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
</FormItem><FormItem label="分配使用用户">
        <Select
          v-model:value="uids"
          mode="multiple"
          show-search
          :filter-option="false"
          :options="users"
          placeholder="选择使用者；也可以保存后再分配"
          @search="search"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
