<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  PhoneGroup,
  PhoneGroupNotificationChannelOption,
  SimCard,
} from '#/api/msg';
import type { SystemUser } from '#/api/system/user';

import { computed, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Bell, Plus, X } from '@vben/icons';

import { Button, message, Popconfirm, Select, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { PhoneGroupApi } from '#/api/msg';
import { SystemUserApi } from '#/api/system/user';
import SimCardSelect from '#/components/management/sim-card-select.vue';
import { displayValue } from '#/management';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import Form from './modules/form.vue';
import PopupDrawer from './modules/popup-drawer.vue';

const simDrawerOpen = ref(false);
const userDrawerOpen = ref(false);
const notificationDrawerOpen = ref(false);
const assignLoading = ref(false);
const selectedGroup = ref<PhoneGroup>();
const selectedIccids = ref<string[]>([]);
const selectedUids = ref<number[]>([]);
const selectedNotificationChannelIds = ref<number[]>([]);
const notificationChannelOptions = ref<PhoneGroupNotificationChannelOption[]>(
  [],
);
const groupSims = ref<SimCard[]>([]);
const userOptions = ref<{ label: string; value: number }[]>([]);
const groupSortFields = ['grp_code', 'grp_name', 'order_no'];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<PhoneGroup>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onEnabledChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await PhoneGroupApi.list({
            enabled: formValues.enabled as boolean | undefined,
            grp_code_prefix:
              String(formValues.grp_code_prefix ?? '').trim() || undefined,
            page: page.currentPage,
            size: page.pageSize,
            ...vxeSortParams(params, groupSortFields),
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
  } as VxeTableGridOptions<PhoneGroup>,
});

const simDrawerTitle = computed(() =>
  selectedGroup.value
    ? `分配号码：${selectedGroup.value.grp_name}`
    : '分配号码',
);
const userDrawerTitle = computed(() =>
  selectedGroup.value
    ? `授权用户：${selectedGroup.value.grp_name}`
    : '授权用户',
);
const notificationDrawerTitle = computed(() =>
  selectedGroup.value
    ? `短信通知群：${selectedGroup.value.grp_name}`
    : '短信通知群',
);

function onRefresh() {
  gridApi.query();
}

async function onEnabledChange(enabled: boolean, row: PhoneGroup) {
  await PhoneGroupApi.update(row.id, {
    enabled,
    grp_code: row.grp_code,
    grp_name: row.grp_name,
    order_no: row.order_no,
    remark: row.remark,
  });
  return true;
}

function openCreate() {
  formDrawerApi.setData({}).open();
}

function openEdit(row: PhoneGroup) {
  formDrawerApi.setData({ row }).open();
}

async function remove(row: PhoneGroup) {
  await PhoneGroupApi.remove(row.id);
  message.success('号码分组已删除');
  await gridApi.query();
}

async function openSims(row: PhoneGroup) {
  selectedGroup.value = row;
  selectedIccids.value = [];
  groupSims.value = [];
  simDrawerOpen.value = true;
  assignLoading.value = true;
  try {
    const result = await PhoneGroupApi.sims(row.id);
    selectedIccids.value = result.iccids;
    groupSims.value = result.items;
  } finally {
    assignLoading.value = false;
  }
}

async function saveSims() {
  if (!selectedGroup.value) return;
  assignLoading.value = true;
  try {
    await PhoneGroupApi.replaceSims(
      selectedGroup.value.id,
      selectedIccids.value,
    );
    message.success('分组号码已更新');
    simDrawerOpen.value = false;
    await gridApi.query();
  } finally {
    assignLoading.value = false;
  }
}

async function openUsers(row: PhoneGroup) {
  selectedGroup.value = row;
  selectedUids.value = [];
  userDrawerOpen.value = true;
  assignLoading.value = true;
  try {
    await loadUserOptions();
    const result = await PhoneGroupApi.users(row.id);
    selectedUids.value = result.uids;
  } finally {
    assignLoading.value = false;
  }
}

async function saveUsers() {
  if (!selectedGroup.value) return;
  assignLoading.value = true;
  try {
    await PhoneGroupApi.replaceUsers(
      selectedGroup.value.id,
      selectedUids.value,
    );
    message.success('授权用户已更新');
    userDrawerOpen.value = false;
    await gridApi.query();
  } finally {
    assignLoading.value = false;
  }
}

async function loadUserOptions() {
  if (userOptions.value.length > 0) return;
  const pageSize = 100;
  const loaded: SystemUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (loaded.length < total) {
    const result = await SystemUserApi.list({ page, pageSize });
    loaded.push(...result.items);
    total = result.total;
    if (result.items.length === 0) break;
    page += 1;
  }
  userOptions.value = loaded.map((user) => ({
    label: `${user.name || user.id}（${user.id}）`,
    value: Number(user.id),
  }));
}

async function openNotificationChannels(row: PhoneGroup) {
  selectedGroup.value = row;
  selectedNotificationChannelIds.value = [];
  notificationChannelOptions.value = [];
  notificationDrawerOpen.value = true;
  assignLoading.value = true;
  try {
    const result = await PhoneGroupApi.notificationChannels(row.id);
    selectedNotificationChannelIds.value = result.channel_ids;
    notificationChannelOptions.value = result.options;
  } finally {
    assignLoading.value = false;
  }
}

async function saveNotificationChannels() {
  if (!selectedGroup.value) return;
  assignLoading.value = true;
  try {
    await PhoneGroupApi.replaceNotificationChannels(
      selectedGroup.value.id,
      selectedNotificationChannelIds.value,
    );
    message.success('短信通知群已更新');
    notificationDrawerOpen.value = false;
    await gridApi.query();
  } finally {
    assignLoading.value = false;
  }
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <header class="page-heading">
      <div>
        <h1>号码权限</h1>
        <p>通过号码分组给用户授权，普通用户只能访问授权分组内的号码。</p>
      </div>
    </header>

    <Grid class="management-grid" table-title="号码权限">
      <template #toolbar-tools>
        <Button
          v-access:code="'phone_groups:manage'"
          type="primary"
          @click="openCreate"
        >
          <template #icon><Plus /></template>新增分组
        </Button>
      </template>
      <template #groupName="{ row }">
        <Button
          v-access:code="'phone_groups:manage'"
          class="px-0"
          size="small"
          type="link"
          @click.stop="openEdit(row)"
        >
          {{ row.grp_name }}
        </Button>
      </template>
      <template #simCount="{ row }">
        <Button
          v-access:code="'phone_groups:manage'"
          class="px-0"
          size="small"
          type="link"
          @click.stop="openSims(row)"
        >
          {{ row.sim_count }} 个号码
        </Button>
      </template>
      <template #userCount="{ row }">
        <Button
          v-access:code="'phone_groups:manage'"
          class="px-0"
          size="small"
          type="link"
          @click.stop="openUsers(row)"
        >
          {{ row.user_count }} 个用户
        </Button>
      </template>
      <template #notificationChannelCount="{ row }">
        <Button
          v-access:code="'phone_groups:manage'"
          class="px-0"
          size="small"
          type="link"
          @click.stop="openNotificationChannels(row)"
        >
          {{ row.notification_channel_count }} 个群
        </Button>
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Button
            v-access:code="'phone_groups:manage'"
            size="small"
            type="link"
            @click.stop="openSims(row)"
          >
            号码
          </Button>
          <Button
            v-access:code="'phone_groups:manage'"
            size="small"
            type="link"
            @click.stop="openUsers(row)"
          >
            用户
          </Button>
          <Button
            v-access:code="'phone_groups:manage'"
            size="small"
            type="link"
            @click.stop="openNotificationChannels(row)"
          >
            <template #icon><Bell /></template>通知
          </Button>
          <Popconfirm
            :title="`确认删除号码分组 ${row.grp_name}？`"
            cancel-text="取消"
            ok-text="删除"
            @confirm="remove(row)"
          >
            <Button
              v-access:code="'phone_groups:manage'"
              danger
              size="small"
              type="link"
            >
              <template #icon><X /></template>删除
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>

    <PopupDrawer
      v-model:open="simDrawerOpen"
      class="w-full max-w-180"
      :title="simDrawerTitle"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="simDrawerOpen = false">取消</Button>
          <Button
            v-access:code="'phone_groups:manage'"
            :loading="assignLoading"
            type="primary"
            @click="saveSims"
          >
            保存
          </Button>
        </div>
      </template>
      <div class="space-y-4">
        <SimCardSelect
          v-model="selectedIccids"
          mode="multiple"
          placeholder="选择要归入该分组的号码"
        />
        <div class="text-sm text-gray-500">
          已选 {{ selectedIccids.length }} 个号码
        </div>
        <div v-if="groupSims.length" class="space-y-2">
          <div
            v-for="sim in groupSims"
            :key="sim.iccid"
            class="rounded border p-2 text-sm"
          >
            <div>{{ displayValue(sim.phone_number) }} / {{ sim.iccid }}</div>
            <div class="text-gray-500">
              {{ sim.carrier || '-' }} · {{ sim.real_name || '-' }}
            </div>
          </div>
        </div>
      </div>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="userDrawerOpen"
      class="w-full max-w-160"
      :title="userDrawerTitle"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="userDrawerOpen = false">取消</Button>
          <Button
            v-access:code="'phone_groups:manage'"
            :loading="assignLoading"
            type="primary"
            @click="saveUsers"
          >
            保存
          </Button>
        </div>
      </template>
      <Select
        v-model:value="selectedUids"
        class="w-full"
        mode="multiple"
        :options="userOptions"
        placeholder="选择可访问该号码分组的用户"
        show-search
      />
      <div class="mt-3 text-sm text-gray-500">
        已授权 {{ selectedUids.length }} 个用户
      </div>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="notificationDrawerOpen"
      class="w-full max-w-160"
      :title="notificationDrawerTitle"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="notificationDrawerOpen = false">取消</Button>
          <Button
            v-access:code="'phone_groups:manage'"
            :loading="assignLoading"
            type="primary"
            @click="saveNotificationChannels"
          >
            保存
          </Button>
        </div>
      </template>
      <Select
        v-model:value="selectedNotificationChannelIds"
        class="w-full"
        mode="multiple"
        :options="
          notificationChannelOptions.map((channel) => ({
            label: `${channel.channel_name}（${
              channel.channel_type === 'dingtalk_custom_robot'
                ? '自定义机器人'
                : '企业群机器人'
            }）`,
            value: Number(channel.channel_id),
          }))
        "
        placeholder="选择收到短信时通知的钉钉群"
        show-search
      />
      <div class="mt-3 text-sm text-gray-500">
        同一号码属于多个分组时，会通知所有分组绑定的不同钉钉群。
      </div>
    </PopupDrawer>
  </Page>
</template>
