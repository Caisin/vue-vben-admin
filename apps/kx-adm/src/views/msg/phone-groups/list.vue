<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  PhoneGroup,
  PhoneGroupNotificationChannelOption,
  SimCard,
} from '#/api/msg';
import type { SystemUser } from '#/api/system/user';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { ExternalLink, Plus, RotateCw, X } from '@vben/icons';

import {
  Button,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
} from 'antdv-next';

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
const simAddOpen = ref(false);
const userAddOpen = ref(false);
const assignLoading = ref(false);
const selectedGroup = ref<PhoneGroup>();
const selectedIccids = ref<string[]>([]);
const selectedUids = ref<number[]>([]);
const pendingIccids = ref<string[]>([]);
const pendingUids = ref<number[]>([]);
const selectedNotificationChannelIds = ref<number[]>([]);
const notificationChannelOptions = ref<PhoneGroupNotificationChannelOption[]>(
  [],
);
const groupSims = ref<SimCard[]>([]);
const users = ref<SystemUser[]>([]);
const userOptions = ref<{ label: string; value: number }[]>([]);
const router = useRouter();
const groupSortFields = ['grp_code', 'grp_name', 'order_no'];
const tablePagination = { pageSize: 10, showSizeChanger: true };

const simColumns = [
  { dataIndex: 'phone_number', title: '号码' },
  { dataIndex: 'iccid', title: 'ICCID' },
  { dataIndex: 'carrier', title: '运营商' },
  { dataIndex: 'real_name', title: '实名' },
  { key: 'actions', title: '操作', width: 80 },
];
const userColumns = [
  { dataIndex: 'name', title: '用户' },
  { dataIndex: 'tel', title: '手机号' },
  { dataIndex: 'email', title: '邮箱' },
  { key: 'actions', title: '操作', width: 80 },
];
const selectedUsers = computed(() => {
  const byId = new Map(users.value.map((user) => [Number(user.id), user]));
  return selectedUids.value.map((uid) => {
    const user = byId.get(uid);
    return {
      email: user?.email ?? '',
      id: uid,
      name: user?.name || `用户 #${uid}`,
      tel: user?.tel ?? '',
    };
  });
});
const availableUserOptions = computed(() => {
  const selected = new Set(selectedUids.value);
  return userOptions.value.filter((option) => !selected.has(option.value));
});

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

async function replaceSims(iccids: string[], successMessage: string) {
  if (!selectedGroup.value) return;
  assignLoading.value = true;
  try {
    const result = await PhoneGroupApi.replaceSims(
      selectedGroup.value.id,
      iccids,
    );
    selectedIccids.value = result.iccids;
    groupSims.value = result.items;
    message.success(successMessage);
    await gridApi.query();
  } finally {
    assignLoading.value = false;
  }
}

function openAddSims() {
  pendingIccids.value = [];
  simAddOpen.value = true;
}

async function addSims() {
  const iccids = [
    ...new Set([...selectedIccids.value, ...pendingIccids.value]),
  ];
  await replaceSims(iccids, '号码已添加');
  simAddOpen.value = false;
}

async function removeSim(iccid: string) {
  await replaceSims(
    selectedIccids.value.filter((value) => value !== iccid),
    '号码已移除',
  );
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

async function replaceUsers(uids: number[], successMessage: string) {
  if (!selectedGroup.value) return;
  assignLoading.value = true;
  try {
    const result = await PhoneGroupApi.replaceUsers(
      selectedGroup.value.id,
      uids,
    );
    selectedUids.value = result.uids;
    message.success(successMessage);
    await gridApi.query();
  } finally {
    assignLoading.value = false;
  }
}

function openAddUsers() {
  pendingUids.value = [];
  userAddOpen.value = true;
}

async function addUsers() {
  const uids = [...new Set([...selectedUids.value, ...pendingUids.value])];
  await replaceUsers(uids, '用户已添加');
  userAddOpen.value = false;
}

async function removeUser(uid: number) {
  await replaceUsers(
    selectedUids.value.filter((value) => value !== uid),
    '用户已移除',
  );
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
  users.value = loaded;
  userOptions.value = loaded.map((user) => ({
    label: `${user.name || user.id}（${user.id}）`,
    value: Number(user.id),
  }));
}

async function refreshNotificationChannels() {
  if (!selectedGroup.value) return;
  assignLoading.value = true;
  try {
    const result = await PhoneGroupApi.notificationChannels(
      selectedGroup.value.id,
    );
    selectedNotificationChannelIds.value = result.channel_ids;
    notificationChannelOptions.value = result.options;
    message.success('通知群列表已刷新');
  } finally {
    assignLoading.value = false;
  }
}

function openNotifyChannelPage(create = false) {
  const href = router.resolve({
    path: '/notify/channels',
    query: create
      ? { action: 'create', channel_type: 'dingtalk_custom_robot' }
      : undefined,
  }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
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
      </template>
    </Grid>

    <PopupDrawer
      v-model:open="simDrawerOpen"
      class="w-full max-w-180"
      :title="simDrawerTitle"
    >
      <div class="mb-3 flex justify-end">
        <Button
          v-access:code="'phone_groups:manage'"
          type="primary"
          @click="openAddSims"
        >
          <template #icon><Plus /></template>添加号码
        </Button>
      </div>
      <Table
        :columns="simColumns"
        :data-source="groupSims"
        :loading="assignLoading"
        :pagination="tablePagination"
        row-key="iccid"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'phone_number'">
            {{ displayValue(record.phone_number) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <Popconfirm
              :title="`确认从分组移除 ${record.phone_number || record.iccid}？`"
              @confirm="removeSim(record.iccid)"
            >
              <Button danger size="small" type="link">移除</Button>
            </Popconfirm>
          </template>
        </template>
      </Table>
    </PopupDrawer>

    <Modal
      v-model:open="simAddOpen"
      :confirm-loading="assignLoading"
      ok-text="添加"
      :ok-button-props="{ disabled: pendingIccids.length === 0 }"
      title="添加号码"
      :z-index="3000"
      @ok="addSims"
    >
      <SimCardSelect
        v-model="pendingIccids"
        mode="multiple"
        placeholder="搜索并选择要添加的号码"
      />
    </Modal>

    <PopupDrawer
      v-model:open="userDrawerOpen"
      class="w-full max-w-180"
      :title="userDrawerTitle"
    >
      <div class="mb-3 flex justify-end">
        <Button
          v-access:code="'phone_groups:manage'"
          type="primary"
          @click="openAddUsers"
        >
          <template #icon><Plus /></template>添加用户
        </Button>
      </div>
      <Table
        :columns="userColumns"
        :data-source="selectedUsers"
        :loading="assignLoading"
        :pagination="tablePagination"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'tel'">
            {{ displayValue(record.tel) }}
          </template>
          <template v-else-if="column.dataIndex === 'email'">
            {{ displayValue(record.email) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <Popconfirm
              :title="`确认移除用户 ${record.name}？`"
              @confirm="removeUser(record.id)"
            >
              <Button danger size="small" type="link">移除</Button>
            </Popconfirm>
          </template>
        </template>
      </Table>
    </PopupDrawer>

    <Modal
      v-model:open="userAddOpen"
      :confirm-loading="assignLoading"
      ok-text="添加"
      :ok-button-props="{ disabled: pendingUids.length === 0 }"
      title="添加用户"
      :z-index="3000"
      @ok="addUsers"
    >
      <Select
        v-model:value="pendingUids"
        class="w-full"
        mode="multiple"
        :options="availableUserOptions"
        placeholder="搜索并选择要添加的用户"
        show-search
      />
    </Modal>

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
      <Space class="mt-3" wrap>
        <Button
          v-access:code="'notify:channel:write'"
          @click="openNotifyChannelPage(true)"
        >
          <template #icon><Plus /></template>新增钉钉通知群
        </Button>
        <Button :loading="assignLoading" @click="refreshNotificationChannels">
          <template #icon><RotateCw /></template>刷新
        </Button>
        <Button
          v-access:code="'notify:channel:write'"
          @click="openNotifyChannelPage()"
        >
          <template #icon><ExternalLink /></template>维护通知通道
        </Button>
      </Space>
      <div class="mt-3 text-sm text-gray-500">
        同一号码属于多个分组时，会通知所有分组绑定的不同钉钉群。
      </div>
    </PopupDrawer>
  </Page>
</template>
