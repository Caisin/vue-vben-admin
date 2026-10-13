<script setup lang="ts">
import type { ClientDevice, DeviceEvent } from '#/api/system/client-devices';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Drawer,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { ClientDeviceApi } from '#/api/system/client-devices';
import { SystemUserApi } from '#/api/system/user';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';
const { hasAccessByCodes } = useAccess();
const keyword = ref('');
const loading = ref(false);
const page = ref(1);
const rows = ref<ClientDevice[]>([]);
const status = ref<string>();
const person = ref<string>();
const personRole = ref('any');
const people = ref<{ label: string; value: string }[]>([]);
const peopleLoading = ref(false);
const peopleError = ref('');
const peopleTotal = ref(0);
const pageError = ref('');
let peopleGeneration = 0;
let pageGeneration = 0;
async function loadPeople(keyword = '') {
  const generation = ++peopleGeneration;
  peopleLoading.value = true;
  peopleError.value = '';
  try {
    const result = await ClientDeviceApi.users({ keyword, page: 1, size: 50 });
    if (generation !== peopleGeneration) return;
    const selected = people.value.find((item) => item.value === person.value);
    people.value = result.items.map((user) => ({
      label: `${user.name}（${user.uid}）`,
      value: String(user.uid),
    }));
    if (selected && !people.value.some((item) => item.value === selected.value))
      people.value.unshift(selected);
    peopleTotal.value = Number(result.total);
  } catch (error) {
    if (generation === peopleGeneration)
      peopleError.value = requestErrorMessage(
        error,
        '人员选项加载失败，请重试',
      );
  } finally {
    if (generation === peopleGeneration) peopleLoading.value = false;
  }
}
function reset() {
  keyword.value = '';
  status.value = undefined;
  person.value = undefined;
  personRole.value = 'any';
  search();
}
const total = ref(0);
const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已授权',
  revoked: '已撤销',
};
const actionLabels: Record<string, string> = {
  denied: '登录被拒绝',
  login: '登录成功',
  authorize: '授权设备',
  revoke: '撤销授权',
  edit: '维护使用人',
};
const columns = [
  { title: '设备', key: 'device', width: 280 },
  { title: '状态', key: 'status', width: 90 },
  { title: '使用人', key: 'assigned', width: 140 },
  { title: '申请人 / 组织架构', key: 'requester', width: 270 },
  { title: '最近登录人', dataIndex: 'last_login_name', width: 120 },
  { title: '最近登录', key: 'login', width: 175 },
  { title: '最近连接', key: 'seen', width: 175 },
  { title: '操作', key: 'actions', width: 220 },
];
function time(value: null | number) {
  return value ? Times.formatUnix(Number(value)) : '—';
}
async function load() {
  const generation = ++pageGeneration;
  loading.value = true;
  pageError.value = '';
  try {
    const result = await ClientDeviceApi.page({
      page: page.value,
      size: 20,
      keyword: keyword.value,
      status: status.value,
      uid: person.value,
      user_role: personRole.value,
    });
    if (generation === pageGeneration) {
      rows.value = result.items;
      total.value = Number(result.total);
    }
  } catch (error) {
    if (generation === pageGeneration) {
      pageError.value = requestErrorMessage(error, '设备列表加载失败，请重试');
      rows.value = [];
      total.value = 0;
    }
  } finally {
    if (generation === pageGeneration) loading.value = false;
  }
}
function search() {
  page.value = 1;
  void load();
}
function authorize(row: ClientDevice, approved: boolean) {
  Modal.confirm({
    title: approved ? '授权此设备？' : '撤销此设备授权？',
    content: approved
      ? `允许设备“${row.name}”上的用户通过钉钉登录客户端。`
      : '撤销后设备会话失效，客户端退出并暂停任务。',
    async onOk() {
      await (approved
        ? ClientDeviceApi.authorize(row.device_id)
        : ClientDeviceApi.revoke(row.device_id));
      message.success(approved ? '设备已授权' : '设备授权已撤销');
      await load();
    },
  });
}
const assigned = ref<string>();
const editing = ref<ClientDevice>();
const editOpen = ref(false);
const remark = ref('');
const saving = ref(false);
const options = ref<{ label: string; value: string }[]>([]);
const usersLoading = ref(false);
let searchGeneration = 0;
async function loadUsers(keyword = '') {
  const generation = ++searchGeneration;
  usersLoading.value = true;
  try {
    const result = await SystemUserApi.options({
      keyword,
      page: 1,
      pageSize: 50,
    });
    if (generation === searchGeneration)
      options.value = result.items
        .filter((v) => Number(v.status) === 1)
        .map((v) => ({ label: `${v.name} (${v.id})`, value: String(v.id) }));
  } finally {
    if (generation === searchGeneration) usersLoading.value = false;
  }
}
function edit(row: ClientDevice) {
  editing.value = row;
  assigned.value =
    row.assigned_uid === null ? undefined : String(row.assigned_uid);
  remark.value = row.remark;
  options.value = assigned.value
    ? [{ label: row.assigned_name || assigned.value, value: assigned.value }]
    : [];
  editOpen.value = true;
}
async function save() {
  if (!editing.value) return;
  saving.value = true;
  try {
    await ClientDeviceApi.edit(editing.value.device_id, {
      assigned_uid: assigned.value ?? null,
      remark: remark.value,
    });
    editOpen.value = false;
    message.success('设备信息已保存');
    await load();
  } finally {
    saving.value = false;
  }
}
const events = ref<DeviceEvent[]>([]);
const historyLoading = ref(false);
const historyOpen = ref(false);
const historyPage = ref(1);
const historyTotal = ref(0);
const selected = ref<ClientDevice>();
async function loadEvents() {
  if (!selected.value) return;
  historyLoading.value = true;
  try {
    const result = await ClientDeviceApi.events(
      selected.value.device_id,
      historyPage.value,
    );
    events.value = result.items;
    historyTotal.value = Number(result.total);
  } finally {
    historyLoading.value = false;
  }
}
function history(row: ClientDevice) {
  selected.value = row;
  historyPage.value = 1;
  historyOpen.value = true;
  void loadEvents();
}
const pagination = computed(() => ({
  current: page.value,
  pageSize: 20,
  total: total.value,
  showSizeChanger: false,
  onChange: (value: number) => {
    page.value = value;
    void load();
  },
}));
onMounted(load);
</script>
<template>
  <Page
    title="客户端设备"
    description="设备授权仅限制桌面客户端；登录仍需通过钉钉确认用户身份。"
  >
    <Space class="mb-4" align="end" wrap>
      <div class="w-72">
        <label for="client-device-person" class="mb-1 block text-sm">
          人员
        </label>
        <Select
          id="client-device-person"
          v-model:value="person"
          class="w-full"
          allow-clear
          show-search
          :filter-option="false"
          :options="people"
          :loading="peopleLoading"
          placeholder="搜索姓名或用户 ID"
          @focus="loadPeople()"
          @search="loadPeople"
          @change="search"
        />
      </div>
      <div class="w-48">
        <label for="client-device-person-role" class="mb-1 block text-sm">
          匹配身份
        </label>
        <Select
          id="client-device-person-role"
          v-model:value="personRole"
          class="w-full"
          :options="[
            { label: '任一身份', value: 'any' },
            { label: '申请人', value: 'requested' },
            { label: '使用人', value: 'assigned' },
            { label: '最近登录人', value: 'last_login' },
          ]"
          @change="search"
        />
      </div>
      <div>
        <label for="client-device-keyword" class="mb-1 block text-sm">
          设备
        </label>
        <Input
          id="client-device-keyword"
          v-model:value="keyword"
          allow-clear
          placeholder="设备名称或设备号"
          @press-enter="search"
        />
      </div>
      <div>
        <label for="client-device-status" class="mb-1 block text-sm">
          状态
        </label>
        <Select
          id="client-device-status"
          v-model:value="status"
          allow-clear
          placeholder="全部状态"
          class="w-36"
          :options="
            Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            }))
          "
          @change="search"
        />
      </div>
      <Button type="primary" @click="search">查询</Button>
      <Button @click="reset">重置</Button>
      <Button :loading="loading" @click="load">刷新</Button>
    </Space>
    <Alert
      v-if="peopleError"
      class="mb-3"
      type="error"
      :message="peopleError"
      show-icon
    >
      <template #action>
        <Button size="small" @click="loadPeople()">重试加载人员</Button>
      </template>
    </Alert>
    <p v-else-if="peopleTotal > 50" class="mb-3 text-sm text-muted-foreground">
      匹配到 {{ peopleTotal }} 位人员，先展示50位；输入姓名或用户ID缩小范围。
    </p>
    <Alert
      v-if="pageError"
      class="mb-3"
      type="error"
      :message="pageError"
      show-icon
    />
    <Table
      :columns="columns"
      :data-source="rows"
      row-key="device_id"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1450 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'device'">
          <div>{{ record.name }}</div>
          <div class="text-xs text-muted-foreground">
            {{ record.os }} · {{ record.app_version }}
          </div>
          <code class="block break-all text-xs select-all">
            {{ record.device_id }}
          </code>
        </template>
        <Tag
          v-else-if="column.key === 'status'"
          :color="
            record.status === 'approved'
              ? 'success'
              : record.status === 'revoked'
                ? 'error'
                : 'warning'
          "
        >
          {{ statusLabels[record.status] || record.status }}
        </Tag>
        <template v-else-if="column.key === 'assigned'">
          <Button
            v-if="hasAccessByCodes(['client-devices:edit'])"
            type="link"
            @click="edit(record)"
          >
            {{ record.assigned_name || '指定使用人' }}
          </Button>
          <span v-else>{{ record.assigned_name || '未指定' }}</span>
        </template>
        <template v-else-if="column.key === 'requester'">
          <div>
            {{
              record.requested_name ||
              (record.requested_uid ? `用户 #${record.requested_uid}` : '—')
            }}
          </div>
          <div
            v-for="path in record.requested_org_paths ?? []"
            :key="path"
            class="mt-1 break-words text-xs text-muted-foreground"
          >
            {{ path }}
          </div>
          <div
            v-if="!record.requested_org_paths?.length"
            class="mt-1 text-xs text-muted-foreground"
          >
            暂无组织信息
          </div>
        </template>
        <template v-else-if="column.key === 'login'">
          {{ time(record.last_login_at) }}
        </template>
        <template v-else-if="column.key === 'seen'">
          {{ time(record.last_seen_at) }}
        </template>
        <Space v-else-if="column.key === 'actions'">
          <Button
            v-if="
              record.status !== 'approved' &&
              hasAccessByCodes(['client-devices:authorize'])
            "
            type="link"
            @click="authorize(record, true)"
          >
            授权
          </Button>
          <Button
            v-if="
              record.status === 'approved' &&
              hasAccessByCodes(['client-devices:revoke'])
            "
            type="link"
            danger
            @click="authorize(record, false)"
          >
            撤销
          </Button>
          <Button type="link" @click="history(record)">记录</Button>
        </Space>
      </template>
    </Table>
    <Modal
      v-model:open="editOpen"
      title="维护设备使用人"
      :confirm-loading="saving"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="设备">{{ editing?.name }}</FormItem>
        <FormItem label="使用人">
          <Select
            v-model:value="assigned"
            allow-clear
            show-search
            :filter-option="false"
            :options="options"
            :loading="usersLoading"
            placeholder="输入姓名搜索（仅记录设备使用人）"
            @search="loadUsers"
            @focus="() => loadUsers()"
          />
        </FormItem>
        <FormItem label="备注">
          <Input.TextArea v-model:value="remark" :maxlength="255" :rows="3" />
        </FormItem>
      </Form>
    </Modal>
    <Drawer v-model:open="historyOpen" title="设备使用记录" :width="760">
      <p>{{ selected?.name }} · {{ selected?.os }}</p>
      <code class="break-all select-all">{{ selected?.device_id }}</code>
      <div class="my-3">
        <p>申请人：{{ selected?.requested_name || '—' }}</p>
        <p
          v-for="path in selected?.requested_org_paths ?? []"
          :key="path"
          class="text-xs text-muted-foreground"
        >
          {{ path }}
        </p>
        <p
          v-if="!selected?.requested_org_paths?.length"
          class="text-xs text-muted-foreground"
        >
          暂无组织信息
        </p>
      </div>
      <p class="my-3">
        授权操作人：{{ selected?.approved_name || '—' }} ·
        {{ time(selected?.approved_at ?? null) }}
      </p>
      <p>
        最近连接 IP：{{ selected?.last_ip || '—' }} · 备注：{{
          selected?.remark || '—'
        }}
      </p>
      <Table
        class="mt-4"
        row-key="id"
        :loading="historyLoading"
        :data-source="events"
        :columns="[
          { title: '时间', key: 'time' },
          { title: '操作人 / 登录人', key: 'user' },
          { title: '动作', key: 'action' },
          { title: 'IP', dataIndex: 'ip' },
        ]"
        :pagination="{
          current: historyPage,
          pageSize: 20,
          total: historyTotal,
          showSizeChanger: false,
          onChange: (value: number) => {
            historyPage = value;
            loadEvents();
          },
        }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'time'">
            {{ time(record.created_at) }}
          </template>
          <template v-else-if="column.key === 'user'">
            {{ record.user_name || record.uid }}
          </template>
          <template v-else-if="column.key === 'action'">
            {{ actionLabels[record.action] || record.action }}
          </template>
        </template>
      </Table>
    </Drawer>
  </Page>
</template>
