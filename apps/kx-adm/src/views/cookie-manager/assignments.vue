<script setup lang="ts">
import type { AdminUser } from '#/api/auth/admin';
import type { AssignedUser, Id, Site } from '#/api/cookie-manager';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Empty,
  Input,
  message,
  Popconfirm,
  Space,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { AdminUserApi } from '#/api/auth/admin';
import { CookieApi } from '#/api/cookie-manager';
import { requestErrorMessage } from '#/request-errors';

const route = useRoute();
const { hasAccessByCodes } = useAccess();
const canAssign = computed(() => hasAccessByCodes(['cookie-manager:assign']));
const siteId = ref<string>();
const site = ref<Site>();
const sites = ref<Site[]>([]);
const siteKeyword = ref('');
const sitePage = ref(1);
const siteTotal = ref(0);
const sitesLoading = ref(false);
const siteError = ref('');
let siteGeneration = 0;
const rows = ref<AssignedUser[]>([]);
const version = ref<Id>();
const keyword = ref('');
const current = ref(1);
const size = ref(20);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const tab = ref('assigned');
const removed = ref<string[]>([]);
let generation = 0;
const userKeyword = ref('');
const userPage = ref(1);
const userTotal = ref(0);
const users = ref<AdminUser[]>([]);
const userLoading = ref(false);
const userError = ref('');
const selected = ref<string[]>([]);
let userGeneration = 0;
const assignedIds = computed(
  () => new Set((site.value?.allowed_uids || []).map(String)),
);
const blocked = computed(
  () => saving.value || loading.value || version.value === undefined,
);

async function searchSites() {
  const request = ++siteGeneration;
  sitesLoading.value = true;
  try {
    const r = await CookieApi.sites({
      page: sitePage.value,
      size: 10,
      keyword: siteKeyword.value,
    });
    if (request !== siteGeneration) return;
    sites.value = r.items;
    siteTotal.value = Number(r.total);
    siteError.value = '';
  } catch (error) {
    if (request === siteGeneration)
      siteError.value = requestErrorMessage(error, '读取网站列表失败');
  } finally {
    if (request === siteGeneration) sitesLoading.value = false;
  }
}
async function load() {
  const id = siteId.value;
  const request = ++generation;
  if (!id) return;
  loading.value = true;
  try {
    const [result, detail] = await Promise.all([
      CookieApi.assignments(id, {
        page: current.value,
        size: size.value,
        keyword: keyword.value,
      }),
      CookieApi.site(id),
    ]);
    if (request !== generation) return;
    rows.value = result.items;
    version.value = result.version;
    total.value = Number(result.total);
    site.value = detail;
    removed.value = removed.value.filter((uid) => assignedIds.value.has(uid));
    selected.value = selected.value.filter(
      (uid) => !assignedIds.value.has(uid),
    );
    errorText.value = '';
    if (current.value > 1 && rows.value.length === 0) {
      current.value = 1;
      await load();
    }
  } catch (error) {
    if (request !== generation) return;
    version.value = undefined;
    rows.value = [];
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
    userError.value = '';
  } catch (error) {
    if (request === userGeneration) {
      users.value = [];
      userError.value = requestErrorMessage(
        error,
        '读取可分配用户失败，请重试',
      );
    }
  } finally {
    if (request === userGeneration) userLoading.value = false;
  }
}
function chooseSite(id: Id) {
  if (saving.value || String(id) === siteId.value) return;
  siteId.value = String(id);
}
function openAdd() {
  tab.value = 'add';
  void searchUsers();
}
async function change(add: string[], remove: string[]) {
  if (
    !siteId.value ||
    blocked.value ||
    !canAssign.value ||
    version.value === undefined
  )
    return;
  const id = siteId.value;
  saving.value = true;
  errorText.value = '';
  try {
    await CookieApi.assign(id, {
      expected_version: version.value,
      add_uids: add,
      remove_uids: remove,
    });
    message.success(
      add.length > 0
        ? `已添加 ${add.length} 名使用用户`
        : `已撤销 ${remove.length} 名用户的使用权限`,
    );
    selected.value = [];
    removed.value = [];
    tab.value = 'assigned';
    keyword.value = '';
    await Promise.all([load(), searchSites()]);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '分配失败，请刷新后重试');
    version.value = undefined;
  } finally {
    saving.value = false;
  }
}
watch(siteId, () => {
  generation++;
  userGeneration++;
  rows.value = [];
  site.value = undefined;
  total.value = 0;
  current.value = 1;
  keyword.value = '';
  version.value = undefined;
  errorText.value = '';
  selected.value = [];
  removed.value = [];
  tab.value = 'assigned';
  userPage.value = 1;
  userKeyword.value = '';
  userError.value = '';
  users.value = [];
  userLoading.value = false;
  void load();
});
watch(
  () => route.query.site_id,
  (id) => {
    if (typeof id === 'string') chooseSite(id);
  },
);
onMounted(async () => {
  await searchSites();
  const id =
    typeof route.query.site_id === 'string'
      ? route.query.site_id
      : sites.value[0]?.id;
  if (id !== undefined) chooseSite(id);
});
</script>
<template>
  <Page>
    <h1 class="mb-3 text-xl font-semibold">网站使用授权</h1>
    <p class="mb-4 text-muted-foreground">
      选择网站账号，再添加或撤销使用用户。使用者还需“Cookie使用者”角色。
    </p>
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section
        class="min-w-0 rounded-lg border bg-card p-4"
        aria-label="网站账号列表"
      >
        <h2 class="mb-3 font-semibold">网站账号 · {{ siteTotal }}</h2>
        <Space class="mb-3" wrap>
          <Input
            v-model:value="siteKeyword"
            allow-clear
            placeholder="搜索网站、账号或域名"
            :disabled="saving"
            @press-enter="
              sitePage = 1;
              searchSites();
            "
          />
          <Button
            :loading="sitesLoading"
            :disabled="saving"
            @click="
              sitePage = 1;
              searchSites();
            "
          >
            查找网站
          </Button>
        </Space>
        <Alert
          v-if="siteError"
          type="error"
          :message="siteError"
          class="mb-3"
        />
        <Table
          :data-source="sites"
          :row-key="(r) => String(r.id)"
          :loading="sitesLoading"
          size="small"
          :columns="[
            { title: '网站 / 账号', dataIndex: 'site' },
            { title: '授权', dataIndex: 'allowed_uids', width: 65 },
          ]"
          :pagination="{
            current: sitePage,
            pageSize: 10,
            total: siteTotal,
            showSizeChanger: false,
            simple: true,
            disabled: saving,
          }"
          @change="
            (p) => {
              sitePage = p.current || 1;
              searchSites();
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <div
              v-if="column.dataIndex === 'site'"
              :class="{
                'rounded bg-primary/10 p-2': String(record.id) === siteId,
              }"
            >
              <Button
                type="link"
                class="!h-auto !px-0 !whitespace-normal !text-left"
                :disabled="saving"
                @click="chooseSite(record.id)"
              >
                {{ record.name }} · {{ record.account_label }}
              </Button>
              <p class="break-all text-xs text-muted-foreground">
                {{ record.origin }}
              </p>
              <Tag v-if="!record.enabled">已停用</Tag>
            </div>
            <span v-else>{{ record.allowed_uids.length }} 人</span>
          </template>
        </Table>
      </section>
      <section
        class="min-w-0 rounded-lg border bg-card p-4"
        aria-label="使用用户维护"
      >
        <template v-if="siteId">
          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold">
                {{
                  site
                    ? `${site.name} · ${site.account_label}`
                    : '正在读取网站账号'
                }}
              </h2>
              <p class="mt-1 break-all text-sm text-muted-foreground">
                {{ site?.origin }} · 已分配
                {{ site?.allowed_uids.length || 0 }} 人
              </p>
            </div>
            <Button :loading="loading" :disabled="saving" @click="load">
              刷新授权
            </Button>
          </div>
          <Alert
            v-if="errorText"
            type="error"
            :message="errorText"
            class="mb-3"
          />
          <Tabs
            :active-key="tab"
            @change="
              (key) => {
                if (!saving) {
                  tab = String(key);
                  if (tab === 'add') searchUsers();
                }
              }
            "
          >
            <TabPane key="assigned" tab="已分配用户" :disabled="saving">
              <Space class="mb-3" wrap>
                <Input
                  v-model:value="keyword"
                  allow-clear
                  placeholder="搜索已分配用户姓名或ID"
                  :disabled="saving"
                  @press-enter="
                    current = 1;
                    removed = [];
                    load();
                  "
                />
                <Button
                  :disabled="saving"
                  @click="
                    current = 1;
                    removed = [];
                    load();
                  "
                >
                  查询
                </Button>
                <Button
                  v-if="canAssign"
                  type="primary"
                  :disabled="blocked"
                  @click="openAdd"
                >
                  添加使用用户
                </Button>
                <Popconfirm
                  v-if="canAssign"
                  :title="`撤销所选 ${removed.length} 名用户对 ${site?.name} · ${site?.account_label} 的使用权限？`"
                  :disabled="blocked || removed.length === 0"
                  @confirm="change([], removed)"
                >
                  <Button
                    danger
                    :disabled="blocked || removed.length === 0"
                    :loading="saving"
                  >
                    批量撤销（{{ removed.length }}）
                  </Button>
                </Popconfirm>
              </Space>
              <Table
                :data-source="rows"
                :row-key="(r) => String(r.uid)"
                :loading="loading"
                :scroll="{ x: 480 }"
                :row-selection="
                  canAssign
                    ? {
                        selectedRowKeys: removed,
                        preserveSelectedRowKeys: true,
                        onChange: (keys) => {
                          removed = keys.map(String);
                        },
                        getCheckboxProps: () => ({ disabled: blocked }),
                      }
                    : undefined
                "
                :columns="[
                  { title: '用户名称', dataIndex: 'name' },
                  { title: '用户ID', dataIndex: 'uid' },
                  { title: '状态', dataIndex: 'enabled' },
                  { title: '操作', dataIndex: 'action' },
                ]"
                :pagination="{
                  current,
                  pageSize: size,
                  total,
                  showSizeChanger: true,
                  disabled: saving,
                }"
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
                      !record.exists
                        ? '已删除'
                        : record.enabled
                          ? '启用'
                          : '停用'
                    }}
                  </Tag>
                  <Popconfirm
                    v-else-if="column.dataIndex === 'action' && canAssign"
                    :title="`撤销 ${record.name} 的使用权限？`"
                    :disabled="blocked"
                    @confirm="change([], [String(record.uid)])"
                  >
                    <Button danger type="link" :disabled="blocked">
                      撤销分配
                    </Button>
                  </Popconfirm>
                </template>
              </Table>
              <p class="mt-3 text-xs text-muted-foreground">
                撤销立即阻止后续同步；已写入浏览器的Cookie需退出网站或轮换会话。
              </p>
            </TabPane>
            <TabPane
              v-if="canAssign"
              key="add"
              tab="添加用户"
              :disabled="blocked"
            >
              <Space class="mb-3" wrap>
                <Input
                  v-model:value="userKeyword"
                  allow-clear
                  placeholder="搜索系统用户"
                  :disabled="saving"
                  @press-enter="
                    userPage = 1;
                    searchUsers();
                  "
                />
                <Button
                  :loading="userLoading"
                  :disabled="saving"
                  @click="
                    userPage = 1;
                    searchUsers();
                  "
                >
                  搜索用户
                </Button>
                <span>跨页已选 {{ selected.length }} 人</span>
                <Button
                  :disabled="saving || selected.length === 0"
                  @click="selected = []"
                >
                  清除选择
                </Button>
                <Button
                  type="primary"
                  :loading="saving"
                  :disabled="blocked || userLoading || selected.length === 0"
                  @click="change(selected, [])"
                >
                  添加所选用户
                </Button>
              </Space>
              <Alert
                v-if="userError"
                type="error"
                :message="userError"
                class="mb-3"
              />
              <Table
                :data-source="users"
                :row-key="(r) => String(r.id)"
                :loading="userLoading"
                :scroll="{ x: 400 }"
                :row-selection="{
                  selectedRowKeys: selected,
                  preserveSelectedRowKeys: true,
                  onChange: (keys) => {
                    selected = keys.map(String);
                  },
                  getCheckboxProps: (r) => ({
                    disabled:
                      blocked || !r.enabled || assignedIds.has(String(r.id)),
                  }),
                }"
                :columns="[
                  { title: '名称', dataIndex: 'name' },
                  { title: '用户ID', dataIndex: 'id' },
                  { title: '授权状态', dataIndex: 'assigned' },
                ]"
                :pagination="{
                  current: userPage,
                  pageSize: 20,
                  total: userTotal,
                  showSizeChanger: false,
                  disabled: saving,
                }"
                @change="
                  (p) => {
                    userPage = p.current || 1;
                    searchUsers();
                  }
                "
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'assigned'">
                    <Tag
                      v-if="assignedIds.has(String(record.id))"
                      color="success"
                    >
                      已分配
</Tag><Tag v-else-if="!record.enabled">用户已停用</Tag><span v-else>未分配</span>
                  </template>
                </template>
              </Table>
            </TabPane>
          </Tabs>
        </template>
        <Empty v-else description="请从左侧选择网站账号" />
      </section>
    </div>
  </Page>
</template>
