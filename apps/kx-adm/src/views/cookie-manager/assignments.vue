<script setup lang="ts">
import type { AdminUser } from '#/api/auth/admin';
import type { AssignedUser, Id, Site } from '#/api/cookie-manager';

import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { AdminUserApi } from '#/api/auth/admin';
import { CookieApi } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';
const route = useRoute();
const { hasAccessByCodes } = useAccess();
const siteId = ref<Id>();
const sites = ref<Site[]>([]);
const rows = ref<AssignedUser[]>([]);
const version = ref<Id>();
const keyword = ref('');
const current = ref(1);
const size = ref(20);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
let generation = 0;
const adding = ref(false);
const userKeyword = ref('');
const userPage = ref(1);
const userTotal = ref(0);
const users = ref<AdminUser[]>([]);
const userLoading = ref(false);
const selected = ref<Id[]>([]);
let userGeneration = 0;
async function searchSites(search = '') {
  const r = await CookieApi.sites({ page: 1, size: 100, keyword: search });
  sites.value = r.items;
}
async function load() {
  const id = siteId.value;
  const request = ++generation;
  if (!id) {
    rows.value = [];
    version.value = undefined;
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const result = await CookieApi.assignments(id, {
      page: current.value,
      size: size.value,
      keyword: keyword.value,
    });
    if (request !== generation) return;
    rows.value = result.items;
    version.value = result.version;
    total.value = Number(result.total);
    errorText.value = '';
  } catch (error) {
    if (request !== generation) return;
    version.value = undefined;
    errorText.value = requestErrorMessage(error, '读取分配用户失败');
  } finally {
    if (request === generation) loading.value = false;
  }
}
async function searchUsers() {
  const request = ++userGeneration;
  userLoading.value = true;
  try {
    const r = await AdminUserApi.list({
      page: userPage.value,
      size: 20,
      keyword: userKeyword.value,
    });
    if (request !== userGeneration) return;
    users.value = r.items;
    userTotal.value = Number(r.total);
  } finally {
    if (request === userGeneration) userLoading.value = false;
  }
}
function openAdd() {
  selected.value = [];
  userPage.value = 1;
  userKeyword.value = '';
  adding.value = true;
  void searchUsers();
}
async function change(add: Id[], remove: Id[]) {
  if (!siteId.value || version.value === undefined) return;
  const id = siteId.value;
  saving.value = true;
  try {
    await CookieApi.assign(id, {
      expected_version: version.value,
      add_uids: add,
      remove_uids: remove,
    });
    message.success(add.length > 0 ? '使用用户已添加' : '使用权限已撤销');
    adding.value = false;
    current.value = 1;
    await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '分配失败，请刷新后重试');
  } finally {
    saving.value = false;
  }
}
watch(siteId, () => {
  current.value = 1;
  keyword.value = '';
  version.value = undefined;
  adding.value = false;
  void load();
});
watch(
  () => route.query.site_id,
  (value) => {
    if (typeof value === 'string') siteId.value = value;
  },
);
onMounted(async () => {
  await searchSites();
  const id =
    typeof route.query.site_id === 'string'
      ? route.query.site_id
      : sites.value[0]?.id;
  siteId.value = id === undefined ? undefined : String(id);
});
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">Cookie 使用用户分配</h1>
    <Alert
      type="info"
      show-icon
      class="mb-4"
      message="为每个网站账号单独分配用户。使用者还需“Cookie使用者”角色；撤销后立即停止后续获取，已写入浏览器的Cookie需在目标网站注销或轮换。"
    /><Space wrap class="mb-4">
      <Select
        v-model:value="siteId"
        show-search
        :filter-option="false"
        :disabled="saving"
        class="!w-96"
        placeholder="搜索并选择网站账号"
        :options="
          sites.map((s) => ({
            value: String(s.id),
            label: `${s.name} · ${s.account_label} · ${s.origin}`,
          }))
        "
        @search="searchSites"
      /><Input
        v-model:value="keyword"
        placeholder="搜索已分配用户姓名或ID"
        @press-enter="
          current = 1;
          load();
        "
      /><Button
        @click="
          current = 1;
          load();
        "
      >
        查询
</Button><Button :loading="loading" @click="load">刷新</Button><Button
        v-if="hasAccessByCodes(['cookie-manager:assign'])"
        type="primary"
        :disabled="!siteId || version === undefined || loading || saving"
        @click="openAdd"
      >
        添加使用用户
      </Button>
</Space><Alert
      v-if="errorText"
      type="error"
      :message="errorText"
      class="mb-4"
    /><Table
      :data-source="rows"
      row-key="uid"
      :loading="loading"
      :columns="[
        { title: '用户ID', dataIndex: 'uid' },
        { title: '用户名称', dataIndex: 'name' },
        { title: '用户状态', dataIndex: 'enabled' },
        { title: '操作', dataIndex: 'action' },
      ]"
      :pagination="{ current, pageSize: size, total, showSizeChanger: true }"
      @change="
        (p) => {
          current = p.current || 1;
          size = p.pageSize || 20;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <Tag
          v-if="column.dataIndex === 'enabled'"
          :color="record.enabled ? 'success' : 'default'"
        >
          {{
            !record.exists ? '已删除' : record.enabled ? '启用' : '停用'
          }}
</Tag><Popconfirm
          v-else-if="
            column.dataIndex === 'action' &&
            hasAccessByCodes(['cookie-manager:assign'])
          "
          :title="`撤销 ${record.name} 的使用权限？`"
          @confirm="change([], [record.uid])"
        >
          <Button
            danger
            type="link"
            :disabled="saving || version === undefined"
          >
            撤销分配
          </Button>
        </Popconfirm>
      </template>
    </Table>
    <Modal
      v-model:open="adding"
      title="添加使用用户"
      :width="820"
      ok-text="添加所选用户"
      :confirm-loading="saving"
      :ok-button-props="{
        disabled: selected.length === 0 || version === undefined,
      }"
      @ok="change(selected, [])"
    >
      <Space class="mb-3">
        <Input
          v-model:value="userKeyword"
          placeholder="搜索系统用户"
          @press-enter="
            userPage = 1;
            searchUsers();
          "
        /><Button
          @click="
            userPage = 1;
            searchUsers();
          "
        >
          搜索
</Button><span>已选 {{ selected.length }} 人</span>
</Space><Table
        :data-source="users"
        :row-key="(r) => String(r.id)"
        :loading="userLoading"
        :row-selection="{
          selectedRowKeys: selected,
          preserveSelectedRowKeys: true,
          onChange: (keys) => {
            selected = keys as Id[];
          },
          getCheckboxProps: (r) => ({ disabled: !r.enabled }),
        }"
        :columns="[
          { title: '用户ID', dataIndex: 'id' },
          { title: '名称', dataIndex: 'name' },
        ]"
        :pagination="{
          current: userPage,
          pageSize: 20,
          total: userTotal,
          showSizeChanger: false,
        }"
        @change="
          (p) => {
            userPage = p.current || 1;
            searchUsers();
          }
        "
      />
    </Modal>
  </Page>
</template>
