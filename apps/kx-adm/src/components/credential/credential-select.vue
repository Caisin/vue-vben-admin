<script lang="ts" setup>
import type {
  CredentialKind,
  CredentialPayload,
  CredentialState,
  CredentialView,
} from '#/api/credential';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { ExternalLink, Plus, RotateCw } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  message,
  Modal,
  Select,
  SpaceCompact,
  TextArea,
  Tooltip,
} from 'antdv-next';

import {
  CredentialApi,
  normalizeDingtalkRobotCredentialInput,
} from '#/api/credential';

import { credentialSelectOptions } from './credential-select-options';
import JsonFileInput from './json-file-input.vue';

interface Props {
  allowClear?: boolean;
  createKind?: CredentialKind;
  disabled?: boolean;
  kind?: CredentialKind;
  kinds?: CredentialKind[];
  managePath?: string;
  placeholder?: string;
  profile?: string;
  state?: CredentialState;
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: true,
  createKind: undefined,
  disabled: false,
  kind: undefined,
  kinds: () => [],
  managePath: '/credential/items',
  placeholder: '选择凭证中心的凭证',
  profile: undefined,
  state: 'active',
});
const modelValue = defineModel<null | string>();

const router = useRouter();
const loading = ref(false);
const quickCreateOpen = ref(false);
const quickCreating = ref(false);
const credentials = ref<CredentialView[]>([]);
const quickForm = reactive({
  accessKeyId: '',
  accessToken: '',
  baseUrl: '',
  cookie: '',
  headerName: '',
  headerValue: '',
  keyword: '',
  name: '',
  passphrase: '',
  password: '',
  privateKey: '',
  serviceAccountJson: '',
  secret: '',
  secretAccessKey: '',
  scheme: '',
  token: '',
  userAgent: '',
  username: '',
});
const allowedKinds = computed(() => {
  if (props.kinds.length > 0) return props.kinds;
  if (props.kind) return [props.kind];
  return [];
});

const options = computed(() => credentialSelectOptions(credentials.value));

async function loadCredentials() {
  loading.value = true;
  try {
    const kinds =
      allowedKinds.value.length > 0 ? allowedKinds.value : [undefined];
    const pages = await Promise.all(
      kinds.map((kind) =>
        CredentialApi.all({
          kind,
          profile: props.profile,
          state: props.state,
        }),
      ),
    );
    credentials.value = [
      ...new Map(pages.flat().map((item) => [item.code, item])).values(),
    ];
  } finally {
    loading.value = false;
  }
}

function openCredentialCenter(action?: 'create') {
  const kind = props.createKind ?? allowedKinds.value[0];
  const href = router.resolve({
    path: props.managePath,
    query: action ? { action, kind, profile: props.profile } : undefined,
  }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
}

const quickKind = computed(
  () => props.createKind ?? props.kind ?? props.kinds[0],
);

function defaultProfile(kind: CredentialKind) {
  if (kind === 'http_token') return 'bearer';
  if (kind === 'http_header') return 'custom_x_header';
  if (kind === 'tiktok') return 'mini_app';
  if (kind === 'wechat_merchant') return 'merchant_private_key';
  if (['dingtalk', 'douyin', 'kuaishou', 'wechat'].includes(kind)) return 'app';
  if (kind === 'tt_web') return 'tt_web';
  return 'generic';
}

const quickProfile = computed(() =>
  quickKind.value
    ? (props.profile ?? defaultProfile(quickKind.value))
    : undefined,
);
const accessKeyLabels = computed(() => {
  if (quickProfile.value === 'tencent') {
    return { id: 'SecretId', secret: 'SecretKey' };
  }
  if (['aliyun', 's3', 'volcengine'].includes(quickProfile.value ?? '')) {
    return { id: 'Access Key ID', secret: 'Secret Access Key' };
  }
  return { id: 'AppID / AppKey', secret: 'AppSecret / SK' };
});

const quickPayloadType = computed(() => {
  const kind = quickKind.value;
  const profile = quickProfile.value;
  if (
    kind === 'access_key' ||
    (['dingtalk', 'douyin', 'kuaishou', 'wechat'].includes(kind ?? '') &&
      profile === 'app') ||
    (kind === 'tiktok' && profile === 'mini_app')
  )
    return 'access_key';
  if (
    kind === 'password' ||
    (['dingtalk', 'douyin', 'wechat', 'wechat_merchant'].includes(kind ?? '') &&
      !(kind === 'dingtalk' && profile === 'custom_robot'))
  )
    return 'password';
  if (kind === 'dingtalk' && profile === 'custom_robot')
    return 'dingtalk_robot';
  return kind;
});

function quickPayload(kind: CredentialKind): CredentialPayload | undefined {
  if (quickPayloadType.value === 'access_key') {
    return {
      access_key_id: quickForm.accessKeyId,
      kind: 'access_key',
      secret_access_key: quickForm.secretAccessKey,
      session_token: '',
    };
  }
  if (quickPayloadType.value === 'password') {
    return { kind: 'password', password: quickForm.password };
  }
  if (quickPayloadType.value === 'dingtalk_robot') {
    const robotInput = normalizeDingtalkRobotCredentialInput(
      quickForm.accessToken,
      quickForm.keyword,
    );
    return {
      access_token: robotInput.accessToken,
      kind: 'dingtalk_robot',
      keyword: robotInput.keyword,
      secret: quickForm.secret,
    };
  }
  if (kind === 'http_token') {
    return {
      base_url: quickForm.baseUrl,
      header_name: quickForm.headerName || 'Authorization',
      kind,
      scheme: quickForm.scheme || 'Bearer',
      token: quickForm.token,
    };
  }
  if (kind === 'http_header') {
    return {
      base_url: quickForm.baseUrl,
      header_name: quickForm.headerName || 'x-goog-api-key',
      kind,
      value: quickForm.headerValue,
    };
  }
  if (kind === 'username_password') {
    return {
      base_url: '',
      kind,
      password: quickForm.password,
      username: quickForm.username,
    };
  }
  if (kind === 'ssh_key') {
    return {
      kind,
      passphrase: quickForm.passphrase,
      private_key: quickForm.privateKey,
      public_key: '',
      username: quickForm.username,
    };
  }
  if (kind === 'tt_web') {
    return {
      cookie: quickForm.cookie,
      curl: '',
      kind,
      user_agent: quickForm.userAgent,
    };
  }
  if (kind === 'google_service_account') {
    return { kind, service_account_json: quickForm.serviceAccountJson };
  }
  return undefined;
}

function openQuickCreate() {
  Object.assign(quickForm, {
    accessKeyId: '',
    accessToken: '',
    baseUrl: '',
    cookie: '',
    headerName: quickKind.value === 'http_header' ? 'x-goog-api-key' : '',
    headerValue: '',
    keyword: '',
    name: '',
    passphrase: '',
    password: '',
    privateKey: '',
    serviceAccountJson: '',
    secret: '',
    secretAccessKey: '',
    scheme: quickKind.value === 'http_token' ? 'Bearer' : '',
    token: '',
    userAgent: '',
    username: '',
  });
  quickCreateOpen.value = true;
}

async function createCredential() {
  const kind = quickKind.value;
  if (!kind) return;
  quickCreating.value = true;
  try {
    const profile = quickProfile.value ?? defaultProfile(kind);
    const payload = quickPayload(kind);
    if (!payload) throw new Error('当前凭证类型请前往完整维护页面新增');
    const created = await CredentialApi.create({
      kind,
      name: quickForm.name.trim(),
      payload,
      profile,
    });
    await loadCredentials();
    modelValue.value = created.code;
    quickCreateOpen.value = false;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '凭证新增失败');
  } finally {
    quickCreating.value = false;
  }
}

watch(
  () => [props.kind, props.kinds, props.profile, props.state],
  () => void loadCredentials(),
  { deep: true },
);
onMounted(loadCredentials);

defineExpose({ reload: loadCredentials });
</script>

<template>
  <div class="w-full">
    <SpaceCompact block>
      <Select
        v-model:value="modelValue"
        :allow-clear="props.allowClear"
        class="min-w-0 flex-1"
        :disabled="props.disabled"
        :loading="loading"
        :not-found-content="loading ? '正在加载凭证' : '没有可用凭证'"
        :options="options"
        option-filter-prop="label"
        :placeholder="props.placeholder"
        show-search
      >
        <template #popupRender="menuNode">
          <component :is="menuNode" />
          <div class="credential-select-create" @mousedown.prevent.stop>
            <Button block size="small" type="link" @click="openQuickCreate">
              <template #icon><Plus /></template>
              新增凭证
            </Button>
          </div>
        </template>
      </Select>
      <Tooltip title="刷新凭证列表">
        <Button
          aria-label="刷新凭证列表"
          :disabled="props.disabled"
          :loading="loading"
          @click="loadCredentials"
        >
          <template #icon><RotateCw /></template>
        </Button>
      </Tooltip>
    </SpaceCompact>
    <Modal
      v-model:open="quickCreateOpen"
      destroy-on-close
      title="新增凭证"
      width="620"
    >
      <Form layout="vertical">
        <FormItem label="凭证名称" required>
          <Input v-model:value="quickForm.name" />
        </FormItem>
        <template v-if="quickPayloadType === 'access_key'">
          <FormItem :label="accessKeyLabels.id" required>
            <Input v-model:value="quickForm.accessKeyId" />
          </FormItem>
          <FormItem :label="accessKeyLabels.secret" required>
            <InputPassword v-model:value="quickForm.secretAccessKey" />
          </FormItem>
        </template>
        <FormItem
          v-else-if="quickPayloadType === 'password'"
          label="密钥"
          required
        >
          <InputPassword v-model:value="quickForm.password" />
        </FormItem>
        <template v-else-if="quickKind === 'http_token'">
          <FormItem label="Base URL">
            <Input v-model:value="quickForm.baseUrl" />
          </FormItem>
          <FormItem label="Header 名" required>
            <Input
              v-model:value="quickForm.headerName"
              placeholder="默认 Authorization"
            />
          </FormItem>
          <FormItem label="认证方案">
            <Input v-model:value="quickForm.scheme" placeholder="默认 Bearer" />
          </FormItem>
          <FormItem label="Token" required>
            <TextArea v-model:value="quickForm.token" :rows="4" />
          </FormItem>
        </template>
        <template v-else-if="quickKind === 'http_header'">
          <FormItem label="Base URL">
            <Input v-model:value="quickForm.baseUrl" />
          </FormItem>
          <FormItem label="Header 名" required>
            <Input
              v-model:value="quickForm.headerName"
              placeholder="默认 x-goog-api-key"
            />
          </FormItem>
          <FormItem label="Header 值" required>
            <TextArea v-model:value="quickForm.headerValue" :rows="4" />
          </FormItem>
        </template>
        <template v-else-if="quickPayloadType === 'dingtalk_robot'">
          <FormItem label="Access Token 或 Webhook 地址" required>
            <TextArea
              v-model:value="quickForm.accessToken"
              :rows="3"
              placeholder="可粘贴纯 access_token，或 https://oapi.dingtalk.com/robot/send?access_token=...&keyword=..."
            />
          </FormItem>
          <FormItem label="加签密钥">
            <InputPassword
              v-model:value="quickForm.secret"
              placeholder="选填；未启用加签可留空"
            />
          </FormItem>
          <FormItem label="关键词">
            <Input
              v-model:value="quickForm.keyword"
              placeholder="选填；未启用关键词安全可留空"
            />
          </FormItem>
        </template>
        <template v-else-if="quickKind === 'username_password'">
          <FormItem label="用户名" required>
            <Input v-model:value="quickForm.username" />
          </FormItem>
          <FormItem label="密码" required>
            <InputPassword v-model:value="quickForm.password" />
          </FormItem>
        </template>
        <template v-else-if="quickKind === 'ssh_key'">
          <FormItem label="用户名" required>
            <Input v-model:value="quickForm.username" />
          </FormItem>
          <FormItem label="私钥" required>
            <TextArea v-model:value="quickForm.privateKey" :rows="6" />
          </FormItem>
          <FormItem label="口令">
            <InputPassword v-model:value="quickForm.passphrase" />
          </FormItem>
        </template>
        <template v-else-if="quickKind === 'tt_web'">
          <FormItem label="Cookie" required>
            <TextArea v-model:value="quickForm.cookie" :rows="4" />
          </FormItem>
          <FormItem label="User-Agent">
            <Input v-model:value="quickForm.userAgent" />
          </FormItem>
        </template>
        <FormItem v-else label="凭证材料" required>
          <JsonFileInput v-model="quickForm.serviceAccountJson" :rows="8" />
        </FormItem>
      </Form>
      <template #footer>
        <Button type="link" @click="openCredentialCenter('create')">
          <template #icon><ExternalLink /></template>
          前往完整维护页面
        </Button>
        <Button @click="quickCreateOpen = false">取消</Button>
        <Button
          :loading="quickCreating"
          type="primary"
          @click="createCredential"
        >
          新增
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.credential-select-create {
  padding: 6px 8px;
  border-top: 1px solid var(--vben-border-color, #f0f0f0);
}
</style>
