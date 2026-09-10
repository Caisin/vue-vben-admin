<script setup lang="ts">
import type { CookieMeta, Id, Site, SiteWrite } from '#/api/cookie-manager';

import { ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Table,
} from 'antdv-next';

import { AdminUserApi } from '#/api/auth/admin';
import { CookieApi } from '#/api/cookie-manager';
import CredentialSelect from '#/components/credential/credential-select.vue';
import { Times } from '#/times';
const props = defineProps<{ site?: Site }>();
const emit = defineEmits<{ saved: [] }>();
const open = defineModel<boolean>('open', { required: true });
const defaults = (): SiteWrite => ({
  name: '',
  origin: '',
  account_label: '',
  credential_code: null,
  format: 'set_cookie',
  allowed_uids: [],
  enabled: true,
  warning_hours: 72,
});
const form = ref<SiteWrite>(defaults());
const text = ref('');
const busy = ref(false);
const parsed = ref<CookieMeta[]>([]);
const users = ref<{ label: string; value: Id }[]>([]);
async function searchUsers(keyword = '') {
  const r = await AdminUserApi.list({ page: 1, size: 100, keyword });
  users.value = r.items.map((u) => ({
    label: `${u.name}（${u.id}）`,
    value: String(u.id),
  }));
}
watch(open, async (value) => {
  if (!value) {
    text.value = '';
    return;
  }
  const site = props.site;
  form.value = site
    ? {
        name: site.name,
        origin: site.origin,
        account_label: site.account_label,
        credential_code: site.credential_code,
        format: 'set_cookie',
        allowed_uids: site.allowed_uids.map(String),
        enabled: site.enabled,
        warning_hours: site.warning_hours,
        expected_version: site.version,
      }
    : defaults();
  text.value = '';
  parsed.value = site?.cookies ?? [];
  await searchUsers();
});
async function preview() {
  busy.value = true;
  try {
    parsed.value = await CookieApi.preview(
      form.value.origin,
      text.value,
      form.value.format,
    );
    message.success('Cookie属性解析成功，保存时固化过期时间');
  } finally {
    busy.value = false;
  }
}
async function save() {
  busy.value = true;
  try {
    await CookieApi.save(
      { ...form.value, cookie_text: text.value.trim() || undefined },
      props.site?.id,
    );
    text.value = '';
    open.value = false;
    message.success('网站账号与Cookie配置已保存');
    emit('saved');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="site ? '维护网站账号与Cookie' : '新增网站账号'"
    :width="960"
    :confirm-loading="busy"
    @ok="save"
    @cancel="open = false"
  >
    <Form layout="vertical">
      <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
        <FormItem label="网站名称" required>
          <Input
            v-model:value="form.name"
            placeholder="例如 DataEye"
          />
</FormItem><FormItem label="账号标识" required>
          <Input
            v-model:value="form.account_label"
            placeholder="例如 运营账号A，用于同域名切换"
          />
</FormItem><FormItem label="网站HTTPS地址" required>
          <Input
            v-model:value="form.origin"
            :disabled="!!site"
            placeholder="https://adxray-app.dataeye.com"
          />
</FormItem><FormItem label="启用插件同步">
          <Switch v-model:checked="form.enabled" />
        </FormItem>
      </div>
      <FormItem label="网站登录凭证（DataEye后台验证码登录）">
        <CredentialSelect
          v-model="form.credential_code"
          kind="username_password"
          create-kind="username_password"
          placeholder="选择或新增账号密码凭证"
        />
</FormItem><Alert
        type="info"
        show-icon
        message="账号密码保存在系统凭证中心。DataEye可以保存后点击“后台登录”获取验证码；其它网站请手动录入Cookie。"
        class="mb-4"
      />
      <FormItem label="允许使用的用户（管理员分配）">
        <Select
          v-model:value="form.allowed_uids"
          mode="multiple"
          show-search
          :filter-option="false"
          :options="users"
          placeholder="搜索并选择用户，留空表示不分配"
          @search="searchUsers"
        />
      </FormItem>
      <div class="grid grid-cols-2 gap-4">
        <FormItem label="到期提前提醒（小时）">
          <InputNumber
            v-model:value="form.warning_hours"
            :min="1"
            :max="8760"
          />
</FormItem><FormItem label="Cookie输入格式">
          <Select
            v-model:value="form.format"
            :options="[
              { label: 'Set-Cookie：每行一条，含属性', value: 'set_cookie' },
              { label: 'Cookie请求头：只有名称和值', value: 'cookie_header' },
            ]"
          />
        </FormItem>
      </div>
      <FormItem label="Cookie文本">
        <Input.TextArea
          v-model:value="text"
          :rows="5"
          autocomplete="off"
          placeholder="每行一个Set-Cookie；编辑留空保留。不会回显已有Cookie值。"
        />
</FormItem><Button :disabled="!text.trim()" :loading="busy" @click="preview">
        解析属性
      </Button>
      <Alert
        type="warning"
        show-icon
        class="my-3"
        message="Max-Age优先于Expires，按录入时间计算并固化；同步不续期。会话Cookie到期未知，目标网站也可能提前使登录失效。"
      />
      <Table
        :data-source="parsed"
        :row-key="(r) => `${r.name}:${r.domain}:${r.path}`"
        size="small"
        :pagination="false"
        :scroll="{ x: 760 }"
        :columns="[
          { title: '名称', dataIndex: 'name' },
          { title: '域', dataIndex: 'domain' },
          { title: '路径', dataIndex: 'path' },
          { title: 'Secure', dataIndex: 'secure' },
          { title: 'HttpOnly', dataIndex: 'http_only' },
          { title: 'SameSite', dataIndex: 'same_site' },
          { title: '过期时间', dataIndex: 'expires_at' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'expires_at'">
            {{
              record.expires_at
                ? Times.formatOptionalUnix(record.expires_at)
                : '会话Cookie（未知）'
            }}
</template><template v-else-if="column.dataIndex === 'domain'">
            {{ record.domain || '仅当前主机' }}
</template><template v-else-if="column.dataIndex === 'secure'">
            {{ record.secure ? '是' : '否' }}
</template><template v-else-if="column.dataIndex === 'http_only'">
            {{ record.http_only ? '是' : '否' }}
          </template>
        </template>
      </Table>
    </Form>
  </Modal>
</template>
