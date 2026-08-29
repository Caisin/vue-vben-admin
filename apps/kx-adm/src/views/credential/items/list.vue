<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  CredentialKind,
  CredentialProfileSpec,
  CredentialState,
  CredentialView,
} from '#/api/credential';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Eye, Plus, RotateCw } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { useDebounceFn } from '@vueuse/core';
import { Button, Select, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AdminUserApi } from '#/api/auth/admin';
import { CredentialApi } from '#/api/credential';
import { vxeSortParams } from '#/vxe-sort';

import {
  kindLabel,
  stateLabel,
  stateOptions,
  summaryText,
  useColumns,
  useFormSchema,
} from './data';
import BindingsDrawer from './modules/bindings.vue';
import CredentialForm from './modules/item-form.vue';
import ReplaceDrawer from './modules/replace.vue';
import RetireModal from './modules/retire.vue';
import CredentialReveal from './modules/reveal.vue';
import StatusModal from './modules/status.vue';

const profiles = ref<CredentialProfileSpec[]>([]);
const route = useRoute();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userInfo?.roles?.includes('admin'));
const selectedOwnerUid = ref<number | string>();
const ownerLoading = ref(false);
const ownerOptions = ref<{ label: string; value: number | string }[]>([]);

async function loadOwnerOptions(keyword = '') {
  if (!isAdmin.value) return;
  ownerLoading.value = true;
  try {
    const page = await AdminUserApi.list({
      name_prefix: keyword.trim() || undefined,
      page: 1,
      size: 50,
    });
    const next = page.items.map((user) => ({
      label: `${user.name}（#${user.id}）`,
      value: user.id,
    }));
    const selected = ownerOptions.value.find(
      (option) => option.value === selectedOwnerUid.value,
    );
    ownerOptions.value = selected
      ? [selected, ...next.filter((option) => option.value !== selected.value)]
      : next;
  } finally {
    ownerLoading.value = false;
  }
}

const searchOwners = useDebounceFn((keyword: string) => {
  void loadOwnerOptions(keyword);
}, 300);

const [CredentialModal, credentialModalApi] = useVbenModal({
  connectedComponent: CredentialForm,
  destroyOnClose: true,
});
const [ReplaceDrawerComp, replaceDrawerApi] = useVbenDrawer({
  connectedComponent: ReplaceDrawer,
  destroyOnClose: true,
});
const [BindingsDrawerComp, bindingsDrawerApi] = useVbenDrawer({
  connectedComponent: BindingsDrawer,
  destroyOnClose: true,
});
const [RevealModal, revealModalApi] = useVbenModal({
  connectedComponent: CredentialReveal,
  destroyOnClose: true,
});
const [RetireModalComp, retireModalApi] = useVbenModal({
  connectedComponent: RetireModal,
  destroyOnClose: false,
});
const [StatusModalComp, statusModalApi] = useVbenModal({
  connectedComponent: StatusModal,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<CredentialView>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const [profileKind, profile] = String(
            formValues.profile_pair ?? '',
          ).split(':');
          const result = await CredentialApi.list({
            code_prefix:
              String(formValues.code_prefix ?? '').trim() || undefined,
            kind: (formValues.kind || profileKind || undefined) as
              | CredentialKind
              | undefined,
            name_prefix:
              String(formValues.name_prefix ?? '').trim() || undefined,
            created_by: selectedOwnerUid.value,
            page: page.currentPage,
            profile: profile || undefined,
            size: page.pageSize,
            state: formValues.state as CredentialState | undefined,
            ...vxeSortParams(params, ['code', 'name', 'updated_at']),
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<CredentialView>,
});

onMounted(async () => {
  const credentialTypes = await CredentialApi.types();
  profiles.value = credentialTypes.profiles;
  await gridApi.formApi.updateSchema(useFormSchema(profiles.value));
  if (route.query.action === 'create') {
    const kind = String(route.query.kind ?? '');
    const profile = String(route.query.profile ?? '');
    credentialModalApi
      .setData({
        defaultProfilePair: kind && profile ? `${kind}:${profile}` : undefined,
        profiles: profiles.value,
      })
      .open();
  }
});

function openCreate() {
  credentialModalApi.setData({ profiles: profiles.value }).open();
}

function openEdit(row: CredentialView) {
  credentialModalApi.setData({ item: row, profiles: profiles.value }).open();
}

function openReplace(row: CredentialView) {
  replaceDrawerApi.setData({ item: row, profiles: profiles.value }).open();
}

function openReveal(row: CredentialView) {
  revealModalApi.setData(row).open();
}

function openBindings(row: CredentialView) {
  bindingsDrawerApi.setData(row).open();
}

function toggleState(row: CredentialView) {
  statusModalApi.setData(row).open();
}

function retire(row: CredentialView) {
  retireModalApi.setData(row).open();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <CredentialModal @success="gridApi.query" />
    <ReplaceDrawerComp @success="gridApi.query" />
    <BindingsDrawerComp />
    <RevealModal />
    <RetireModalComp @success="gridApi.query" />
    <StatusModalComp @success="gridApi.query" />
    <Grid class="management-grid" table-title="凭证中心">
      <template #name="{ row }">
        <Button
          v-access:code="'credential:update'"
          class="px-0"
          type="link"
          @click.stop="openEdit(row)"
        >
          {{ row.name }}
        </Button>
      </template>
      <template #kind="{ row }">
        <Tag color="processing">{{ kindLabel(row.kind) }}</Tag>
      </template>
      <template #state="{ row }">
        <Tag :color="stateOptions.find((i) => i.value === row.state)?.color">
          {{ stateLabel(row.state) }}
        </Tag>
      </template>
      <template #summary="{ row }">{{ summaryText(row) }}</template>
      <template #operation="{ row }">
        <Space>
          <Button
            v-access:code="'credential:reveal'"
            size="small"
            title="查看明文"
            type="text"
            @click.stop="openReveal(row)"
          >
            <template #icon><Eye /></template>
          </Button>
          <Button
            v-access:code="'credential:replace'"
            size="small"
            type="link"
            @click.stop="openReplace(row)"
          >
            <RotateCw class="size-4" />替换
          </Button>
          <Button size="small" type="link" @click.stop="openBindings(row)">
            使用
          </Button>
          <Button
            v-if="row.state !== 'retired'"
            v-access:code="'credential:status'"
            size="small"
            type="link"
            @click.stop="toggleState(row)"
          >
            {{ row.state === 'active' ? '禁用' : '启用' }}
          </Button>
          <Button
            v-if="row.state !== 'retired'"
            v-access:code="'credential:retire'"
            danger
            size="small"
            type="link"
            @click.stop="retire(row)"
          >
            退役
          </Button>
        </Space>
      </template>
      <template #toolbar-tools>
        <Space>
          <Select
            v-if="isAdmin"
            v-model:value="selectedOwnerUid"
            allow-clear
            class="w-56"
            :filter-option="false"
            :loading="ownerLoading"
            :options="ownerOptions"
            placeholder="我的凭证"
            show-search
            @change="() => gridApi.query()"
            @dropdown-visible-change="(open) => open && loadOwnerOptions()"
            @search="searchOwners"
          />
          <Button
            v-if="!selectedOwnerUid"
            v-access:code="'credential:create'"
            type="primary"
            @click="openCreate"
          >
            <Plus class="size-4" />新增凭证
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
