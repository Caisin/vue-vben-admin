<script setup lang="ts">
import type { CookieMeta, Site, SiteWrite } from '#/api/cookie-manager';

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
  enabled: true,
  warning_hours: 72,
  proxy_enabled: false,
  proxy_origin: null,
  proxy_resources: [],
});
const form = ref<SiteWrite>(defaults());
const text = ref('');
const busy = ref(false);
const parsed = ref<CookieMeta[]>([]);
watch(
  () => form.value.origin,
  (origin) => {
    if (
      !props.site &&
      origin.replace(/\/$/, '') === 'https://adxray-app.dataeye.com' &&
      !form.value.proxy_resources?.length
    ) {
      form.value.proxy_resources = [
        { name: 'cdn', origin: 'https://adxray-app-cdn.dataeye.com' },
      ];
    }
  },
);
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
        enabled: site.enabled,
        warning_hours: site.warning_hours,
        expected_version: site.version,
        proxy_enabled: site.proxy_enabled,
        proxy_origin: site.proxy_origin ?? null,
        proxy_resources: (site.proxy_resources || []).map((r) => ({ ...r })),
      }
    : defaults();
  text.value = '';
  parsed.value = site?.cookies ?? [];
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
</FormItem><FormItem label="启用账号使用">
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

      <div class="my-4 rounded border p-4">
        <FormItem label="启用系统认证代理">
          <Switch v-model:checked="form.proxy_enabled" />
        </FormItem>
        <template v-if="form.proxy_enabled">
          <FormItem label="代理访问域名">
            <Input
              v-model:value="form.proxy_origin"
              placeholder="https://adx.example.com；留空自动生成独立子域名"
            />
          </FormItem>
          <p class="mb-3 text-sm text-muted-foreground">
            目标为上方网站HTTPS地址。所有代理域名指向同一个代理服务端口，新增配置无需单独启动进程；DNS和HTTPS证书需在网关配置。
          </p>
          <p class="mb-2">
            附加资源域名（CDN、图片、脚本；不携带主站登录Cookie）
          </p>
          <div
            v-for="(resource, index) in form.proxy_resources"
            :key="index"
            class="mb-2 flex gap-2"
          >
            <Input
              v-model:value="resource.name"
              placeholder="别名，如cdn"
              class="!w-32"
            />
            <Input
              v-model:value="resource.origin"
              placeholder="https://cdn.example.com"
            />
            <Button danger @click="form.proxy_resources?.splice(index, 1)">
              移除
            </Button>
          </div>
          <Button
            @click="
              (form.proxy_resources ||= []).push({ name: '', origin: '' })
            "
          >
            添加资源域名
          </Button>
          <p v-if="site?.proxy_url" class="mt-3 break-all text-sm">
            当前代理入口：{{ site.proxy_url }}
          </p>
          <Alert
            v-else
            type="info"
            message="保存后显示代理入口；若服务未配置，请管理员设置代理监听和系统登录回跳地址。"
            class="mt-3"
          />
        </template>
      </div>

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
