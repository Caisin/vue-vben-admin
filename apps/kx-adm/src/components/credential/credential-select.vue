<script lang="ts" setup>
import type {
  CredentialKind,
  CredentialState,
  CredentialView,
} from '#/api/credential';

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { ExternalLink, Plus, RotateCw } from '@vben/icons';

import { Button, Select, Tooltip } from 'antdv-next';

import { CredentialApi } from '#/api/credential';

interface Props {
  allowClear?: boolean;
  createKind?: CredentialKind;
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
const credentials = ref<CredentialView[]>([]);
const allowedKinds = computed(() => {
  if (props.kinds.length > 0) return props.kinds;
  if (props.kind) return [props.kind];
  return [];
});

const options = computed(() =>
  credentials.value.map((item) => ({
    label: `${item.name} · ${kindLabel(item.kind)} (${item.code})`,
    value: item.code,
  })),
);

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

watch(
  () => [props.kind, props.kinds, props.profile, props.state],
  () => void loadCredentials(),
  { deep: true },
);
onMounted(loadCredentials);

defineExpose({ reload: loadCredentials });

function kindLabel(kind: CredentialKind) {
  if (kind === 'password') return '密码';
  if (kind === 'username_password') return '账号密码';
  return kind;
}
</script>

<template>
  <div class="flex w-full items-center gap-2">
    <Select
      v-model:value="modelValue"
      :allow-clear="props.allowClear"
      class="min-w-0 flex-1"
      :loading="loading"
      :not-found-content="loading ? '正在加载凭证' : '没有可用凭证'"
      :options="options"
      option-filter-prop="label"
      :placeholder="props.placeholder"
      show-search
    />
    <Tooltip title="新增凭证">
      <Button
        v-access:code="'credential:create'"
        aria-label="新增凭证"
        @click="openCredentialCenter('create')"
      >
        <template #icon><Plus /></template>
      </Button>
    </Tooltip>
    <Tooltip title="打开凭证中心">
      <Button aria-label="打开凭证中心" @click="openCredentialCenter()">
        <template #icon><ExternalLink /></template>
      </Button>
    </Tooltip>
    <Tooltip title="刷新凭证列表">
      <Button
        aria-label="刷新凭证列表"
        :loading="loading"
        @click="loadCredentials"
      >
        <template #icon><RotateCw /></template>
      </Button>
    </Tooltip>
  </div>
</template>
