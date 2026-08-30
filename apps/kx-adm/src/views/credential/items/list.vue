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
import { Ellipsis, Eye, Plus, RotateCw } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { useDebounceFn } from '@vueuse/core';
import {
  Button,
  Dropdown,
  Menu,
  MenuItem,
  Segmented,
  Select,
  Space,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AdminUserApi } from '#/api/auth/admin';
import { CredentialApi } from '#/api/credential';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  credentialKindTabs,
  expiryInfo,
  kindLabel,
  profileLabel,
  stateLabel,
  stateOptions,
  summaryText,
  useColumns,
  useFormSchema,
} from './data';
import BindingsDrawer from './modules/bindings.vue';
import DetailDrawer from './modules/detail.vue';
import CredentialForm from './modules/item-form.vue';
import ReplaceDrawer from './modules/replace.vue';
import RetireModal from './modules/retire.vue';
import CredentialReveal from './modules/reveal.vue';
import StatusModal from './modules/status.vue';

const profiles = ref<CredentialProfileSpec[]>([]);
const activeKind = ref<'all' | CredentialKind>('all');
const route = useRoute();
const userStore = useUserStore();
const isAdmin = computed(() => userStore.userInfo?.roles?.includes('admin'));
type OwnerScope = 'all' | 'mine' | 'specific';
const ownerScope = ref<OwnerScope>('all');
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

const ownerQueryUid = computed(() => {
  if (!isAdmin.value) return undefined;
  if (ownerScope.value === 'mine') return userStore.userInfo?.userId;
  if (ownerScope.value === 'specific') return selectedOwnerUid.value;
  return undefined;
});

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
const [DetailDrawerComp, detailDrawerApi] = useVbenDrawer({
  connectedComponent: DetailDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<CredentialView>({
  formOptions: {
    schema: useFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await CredentialApi.list({
            code_prefix:
              String(formValues.code_prefix ?? '').trim() || undefined,
            kind: activeKind.value === 'all' ? undefined : activeKind.value,
            name_prefix:
              String(formValues.name_prefix ?? '').trim() || undefined,
            created_by: ownerQueryUid.value,
            expiring_within_days:
              formValues.risk === 'expiring' ? 7 : undefined,
            has_recent_failure: formValues.risk === 'failed' ? true : undefined,
            page: page.currentPage,
            size: page.pageSize,
            state: formValues.state as CredentialState | undefined,
            ...vxeSortParams(params, ['code', 'name', 'updated_at']),
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'code' },
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

function openDetail(row: CredentialView) {
  detailDrawerApi.setData({ item: row, profiles: profiles.value }).open();
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
    <DetailDrawerComp
      @edit="openEdit"
      @replace="openReplace"
      @reveal="openReveal"
      @retire="retire"
      @status="toggleState"
    />
    <Tabs
      v-model:active-key="activeKind"
      class="credential-kind-tabs"
      @change="() => gridApi.query()"
    >
      <TabPane
        v-for="tab in credentialKindTabs"
        :key="tab.value"
        :tab="tab.label"
      />
    </Tabs>
    <Grid class="management-grid" table-title="凭证中心">
      <template #name="{ row }">
        <Button class="px-0" type="link" @click.stop="openDetail(row)">
          {{ row.name }}
        </Button>
      </template>
      <template #kind="{ row }">
        <Tag color="processing">{{ kindLabel(row.kind) }}</Tag>
      </template>
      <template #profile="{ row }">
        {{ profileLabel(profiles, row.kind, row.profile) }}
      </template>
      <template #state="{ row }">
        <Tag :color="stateOptions.find((i) => i.value === row.state)?.color">
          {{ stateLabel(row.state) }}
        </Tag>
      </template>
      <template #summary="{ row }">{{ summaryText(row) }}</template>
      <template #health="{ row }">
        <Tag
          :color="
            Number(row.failed_binding_count) > 0
              ? 'error'
              : Number(row.binding_count) === 0
                ? 'default'
                : Number(row.last_used_at) > 0
                  ? 'success'
                  : 'warning'
          "
        >
          {{
            Number(row.failed_binding_count) > 0
              ? `${row.failed_binding_count} 个使用失败`
              : Number(row.binding_count) === 0
                ? '未绑定'
                : Number(row.last_used_at) > 0
                  ? '最近可用'
                  : '尚未使用'
          }}
        </Tag>
      </template>
      <template #expires="{ row }">
        <div class="flex flex-wrap items-center gap-1">
          <Tag :color="expiryInfo(row.expires_at).color">
            {{ expiryInfo(row.expires_at).label }}
          </Tag>
          <span class="text-xs text-gray-500">
            {{ Times.formatOptionalUnix(row.expires_at) }}
          </span>
        </div>
      </template>
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
          <Dropdown>
            <Button size="small" title="更多操作" type="text">
              <Ellipsis class="size-4" />
            </Button>
            <template #popupRender>
              <Menu>
                <MenuItem key="bindings" @click="openBindings(row)">
                  使用位置
                </MenuItem>
                <MenuItem
                  v-if="row.state !== 'retired'"
                  v-access:code="'credential:status'"
                  key="status"
                  @click="toggleState(row)"
                >
                  {{ row.state === 'active' ? '禁用' : '启用' }}
                </MenuItem>
                <MenuItem
                  v-if="row.state !== 'retired'"
                  v-access:code="'credential:retire'"
                  danger
                  key="retire"
                  @click="retire(row)"
                >
                  退役
                </MenuItem>
              </Menu>
            </template>
          </Dropdown>
        </Space>
      </template>
      <template #toolbar-tools>
        <Space>
          <Segmented
            v-if="isAdmin"
            v-model:value="ownerScope"
            :options="[
              { label: '全部凭证', value: 'all' },
              { label: '我的凭证', value: 'mine' },
              { label: '指定用户', value: 'specific' },
            ]"
            @change="
              (value) => {
                if (value !== 'specific') selectedOwnerUid = undefined;
                gridApi.query();
              }
            "
          />
          <Select
            v-if="isAdmin && ownerScope === 'specific'"
            v-model:value="selectedOwnerUid"
            allow-clear
            class="w-56"
            :filter-option="false"
            :loading="ownerLoading"
            :options="ownerOptions"
            placeholder="创建人（全部）"
            show-search
            @change="() => gridApi.query()"
            @dropdown-visible-change="(open) => open && loadOwnerOptions()"
            @search="searchOwners"
          />
          <Button
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
