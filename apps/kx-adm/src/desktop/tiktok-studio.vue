<script setup lang="ts">
import type {
  TikTokAccount,
  TikTokDirectory,
  TikTokSchedule,
  TikTokVideoFile,
} from './tiktok';
import type { TikTokStoredAccount } from './tiktok-accounts';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Table,
} from 'antdv-next';

import { desktop } from './index';
import {
  canUploadTikTok,
  importTikTokCookie,
  isTikTokRunning,
  legacyTikTokLogin,
  localDateTime,
  logoutTikTok,
  restoreTikTokLogin,
  scheduleTimestamp,
  switchTikTokAccount,
  tiktok,
} from './tiktok';
import { tikTokAccounts } from './tiktok-accounts';
import TikTokOverview from './tiktok-overview.vue';

const { hasAccessByCodes } = useAccess();
const canManage = computed(() => hasAccessByCodes(['tiktok:account-manage']));
const accounts = ref<TikTokStoredAccount[]>([]);
const accountsOpen = ref(false);
const accountLabel = ref('');
const updatingUid = ref<string>();
const updatingVersion = ref<number>();
const legacy = ref(legacyTikTokLogin());
const concurrency = ref(3);
const statusFilter = ref('');
const previewOpen = ref(false);
const previewUrl = ref('');
const previewName = ref('');
let accountEpoch = 0;
const accountOptions = computed(() =>
  accounts.value
    .filter((a) => a.enabled)
    .map((a) => ({
      label: `${a.label} · ${a.account.nickname}`,
      value: a.account.uid,
    })),
);
const visibleFiles = computed(() =>
  (directory.value?.files ?? []).filter((f) => {
    if (statusFilter.value === 'running') return isTikTokRunning(f);
    if (statusFilter.value === 'issues')
      return ['failed', 'review'].includes(f.status);
    if (statusFilter.value === 'pending')
      return ['pending', 'ready'].includes(f.status);
    return !statusFilter.value || f.status === statusFilter.value;
  }),
);
async function loadAccounts() {
  accounts.value = await tikTokAccounts.list();
}
function resetAccountView() {
  accountEpoch += 1;
  edits.value = {};
  selected.value = [];
  directory.value = null;
  statusFilter.value = '';
  previewOpen.value = false;
  previewUrl.value = '';
}
function openCookie(uid?: string) {
  updatingUid.value = uid;
  updatingVersion.value = accounts.value.find(
    (a) => a.account.uid === uid,
  )?.version;
  accountLabel.value =
    accounts.value.find((a) => a.account.uid === uid)?.label ?? '';
  cookieText.value = '';
  userAgent.value = '';
  cookieOpen.value = true;
}
async function changeAccount(uid: string) {
  if (locked.value) return;
  await act(async () => {
    const login = await switchTikTokAccount(uid);
    resetAccountView();
    account.value = login.account;
    accountsOpen.value = false;
  });
}
async function disableAccount(row: TikTokStoredAccount) {
  await act(async () => {
    await tikTokAccounts.disable(row.account.uid, row.version);
    if (account.value?.uid === row.account.uid) {
      await logoutTikTok();
      resetAccountView();
      account.value = null;
    }
    await loadAccounts();
  });
}
async function migrateLegacy() {
  if (!legacy.value) return;
  updatingUid.value = undefined;
  updatingVersion.value = undefined;
  cookieText.value = legacy.value.cookie;
  userAgent.value = legacy.value.userAgent;
  accountLabel.value = legacy.value.account.nickname;
  await cookieLogin();
  legacy.value = legacyTikTokLogin();
}
async function preview(file: TikTokVideoFile) {
  const current = directory.value;
  if (!current) return;
  await act(async () => {
    previewUrl.value = await tiktok.preview(file.id, current.revision);
    previewName.value = file.name;
    previewOpen.value = true;
  });
}
const directory = ref<null | TikTokDirectory>(null);
const account = ref<null | TikTokAccount>(null);
const selected = ref<string[]>([]);
const busy = ref(false);
const errorText = ref('');
const pauseRequested = ref(false);
const confirmOpen = ref(false);
const cookieOpen = ref(false);
const cookieText = ref('');
const userAgent = ref('');
const firstTime = ref(
  localDateTime(Math.ceil((Date.now() / 1000 + 86_400) / 300) * 300),
);
const intervalMinutes = ref(60);
const edits = ref<
  Record<
    string,
    {
      caption: string;
      time: string;
      visibility: number;
      allowComment: boolean;
      copyrightCheck: boolean;
      contentCheck: boolean;
    }
  >
>({});
const reviewIds = ref<Record<string, string>>({});
const running = computed(
  () => directory.value?.files.some(isTikTokRunning) ?? false,
);
const review = computed(
  () =>
    directory.value?.files.some((file) => file.status === 'review') ?? false,
);
const locked = computed(() => busy.value || running.value);
const chosen = computed(
  () =>
    directory.value?.files.filter((file) => selected.value.includes(file.id)) ??
    [],
);
const completed = computed(
  () =>
    directory.value?.files.filter((file) => file.status === 'scheduled')
      .length ?? 0,
);
const dirty = computed(() =>
  chosen.value.some((file) => {
    const edit = edits.value[file.id];
    const saved = file.schedule;
    return (
      !saved ||
      !edit ||
      edit.caption !== saved.caption ||
      edit.time !== localDateTime(saved.scheduledAt) ||
      edit.visibility !== saved.visibility ||
      edit.allowComment !== saved.allowComment ||
      edit.copyrightCheck !== (saved.copyrightCheck ?? false) ||
      edit.contentCheck !== (saved.contentCheck ?? false)
    );
  }),
);
const accountMismatch = computed(
  () => !account.value || directory.value?.account?.uid !== account.value.uid,
);
const canSubmit = computed(
  () =>
    chosen.value.length > 0 &&
    !dirty.value &&
    !locked.value &&
    !review.value &&
    !accountMismatch.value,
);
const visibilityOptions = [
  { label: '公开（私密账号为关注者）', value: 0 },
  { label: '朋友', value: 2 },
];
const labels: Record<string, string> = {
  checking: '等待检测结果',
  failed: '失败 / 可重试',
  pending: '待上传',
  ready: '素材已上传',
  review: '预约结果待核对',
  scheduled: '已预约',
  scheduling: '提交预约中',
  transferring: '读取文件',
  uploading: 'API 上传中',
  legacy_draft: '旧版草稿记录',
};
let stopped = false;
let timer: ReturnType<typeof setTimeout> | undefined;
function setSelected(keys: (number | string)[]) {
  const visible = new Set(visibleFiles.value.map((file) => file.id));
  selected.value = [
    ...new Set([
      ...selected.value.filter((id) => !visible.has(id)),
      ...keys.map(String),
    ]),
  ];
}
function size(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
function fileEdit(file: TikTokVideoFile) {
  return (edits.value[file.id] ||= {
    caption: file.schedule?.caption || file.name.replace(/\.[^.]+$/, ''),
    time: file.schedule ? localDateTime(file.schedule.scheduledAt) : '',
    visibility: file.schedule?.visibility ?? 0,
    allowComment: file.schedule?.allowComment ?? true,
    copyrightCheck: file.schedule?.copyrightCheck ?? false,
    contentCheck: file.schedule?.contentCheck ?? false,
  });
}
function initializeEdits(value: TikTokDirectory) {
  for (const file of value.files) fileEdit(file);
}
async function refresh() {
  const epoch = accountEpoch;
  const next = await tiktok.list();
  if (stopped || epoch !== accountEpoch) return;
  if (
    next &&
    directory.value &&
    next.files[0]?.id === directory.value.files[0]?.id &&
    next.revision < directory.value.revision
  )
    return;
  directory.value = next;
  if (next) initializeEdits(next);
  selected.value = selected.value.filter((id) =>
    next?.files.some((file) => file.id === id && canUploadTikTok(file)),
  );
}
async function act(action: () => Promise<unknown>) {
  busy.value = true;
  errorText.value = '';
  try {
    await action();
  } catch (error) {
    errorText.value = String(error);
  } finally {
    try {
      await refresh();
    } catch (error) {
      errorText.value ||= String(error);
    }
    busy.value = false;
  }
}
async function checkAccount() {
  await act(async () => {
    account.value = await tiktok.account();
  });
}
async function cookieLogin() {
  await act(async () => {
    if (updatingUid.value && !cookieText.value.trim()) {
      const saved = accounts.value.find(
        (a) => a.account.uid === updatingUid.value,
      );
      if (!saved) throw new Error('账号已变化，请刷新');
      await tikTokAccounts.rename(
        saved.account.uid,
        accountLabel.value,
        updatingVersion.value ?? saved.version,
      );
      await loadAccounts();
      cookieOpen.value = false;
      return;
    }
    const login = await importTikTokCookie(
      cookieText.value,
      userAgent.value,
      accountLabel.value,
      updatingUid.value,
      updatingVersion.value,
    );
    resetAccountView();
    await loadAccounts();
    account.value = login.account;
    cookieText.value = '';
    userAgent.value = '';
    cookieOpen.value = false;
    message.success('账号已保存到KX数据库并登录');
  });
}
async function logout() {
  await act(async () => {
    await logoutTikTok();
    resetAccountView();
    account.value = null;
  });
}
async function chooseDirectory() {
  await act(async () => {
    const next = await tiktok.pickDirectory();
    if (next) {
      directory.value = next;
      edits.value = {};
      initializeEdits(next);
      selected.value = next.files
        .filter(canUploadTikTok)
        .map((file) => file.id);
    }
  });
}
function applyInterval() {
  errorText.value = '';
  try {
    const first = scheduleTimestamp(firstTime.value);
    if (
      !Number.isInteger(intervalMinutes.value) ||
      intervalMinutes.value < 5 ||
      intervalMinutes.value % 5 !== 0
    )
      throw new Error('发布间隔须为 5 分钟的整数倍');
    chosen.value.forEach((file, index) => {
      const edit = edits.value[file.id];
      if (edit)
        edit.time = localDateTime(first + index * intervalMinutes.value * 60);
    });
  } catch (error) {
    errorText.value = String(error);
  }
}
async function savePlan() {
  const current = directory.value;
  const owner = account.value;
  if (!current || !owner) return;
  await act(async () => {
    const items = chosen.value.map((file) => {
      const edit = edits.value[file.id];
      if (!edit) throw new Error('视频计划缺失');
      const schedule: TikTokSchedule = {
        caption: edit.caption,
        scheduledAt: scheduleTimestamp(edit.time),
        visibility: edit.visibility,
        allowComment: edit.allowComment,
        copyrightCheck: edit.copyrightCheck,
        contentCheck: edit.contentCheck,
      };
      return { id: file.id, schedule };
    });
    directory.value = await tiktok.plan(current, owner, items);
    message.success('预约计划已保存，请核对后提交');
  });
}
async function submit() {
  const current = directory.value;
  const owner = account.value;
  if (!current || !owner || !canSubmit.value) {
    confirmOpen.value = false;
    return;
  }
  const ids = [...selected.value];
  confirmOpen.value = false;
  pauseRequested.value = false;
  await act(async () => {
    await tiktok.upload(ids, current.revision, owner.uid, concurrency.value);
    await refresh();
    const files =
      directory.value?.files.filter((file) => ids.includes(file.id)) ?? [];
    if (
      files.length === ids.length &&
      files.every((file) => file.status === 'scheduled')
    )
      message.success(`TikTok 已接收 ${files.length} 条预约`);
    else message.info('队列已停止，请检查每条视频状态');
  });
}
async function pause() {
  try {
    await tiktok.pause();
    pauseRequested.value = true;
  } catch (error) {
    errorText.value = String(error);
  }
}
async function reconcile(file: TikTokVideoFile, exists: boolean) {
  const current = directory.value;
  if (!current) return;
  await act(async () => {
    const itemId = exists ? reviewIds.value[file.id]?.trim() : null;
    if (exists && !itemId)
      throw new Error('请填写在 TikTok 作品列表核实的视频 ID');
    await tiktok.reconcile(file.id, current.revision, itemId ?? null);
  });
}
async function remove() {
  const current = directory.value;
  if (current) await act(() => tiktok.remove(current.revision));
}
async function resetMedia(file: TikTokVideoFile) {
  const current = directory.value;
  if (current) await act(() => tiktok.resetMedia(file.id, current.revision));
}
async function poll() {
  try {
    await refresh();
  } catch (error) {
    if (!stopped) errorText.value = String(error);
  }
  if (!stopped) timer = setTimeout(poll, 1500);
}
onMounted(() => {
  if (desktop) {
    void poll();
    void act(async () => {
      await loadAccounts();
      const login = await restoreTikTokLogin();
      account.value = login?.account ?? null;
    });
  }
});
onUnmounted(() => {
  stopped = true;
  if (timer) clearTimeout(timer);
});
</script>
<template>
  <section class="mx-auto w-full max-w-screen-2xl space-y-4 p-4 sm:p-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">TikTok 批量预约发布</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          登录账号 → 选择视频 → 安排发布时间 → 确认提交
        </p>
      </div>
    </header>
    <Alert
      v-if="!desktop"
      type="warning"
      message="请使用 KX ADM 的 Tauri 桌面版打开此工作台。"
    />
    <Alert v-if="errorText" type="error" :message="errorText" />
    <template v-if="desktop">
      <div class="flex flex-wrap gap-2">
        <Select
          :value="account?.uid"
          :options="accountOptions"
          :disabled="locked"
          placeholder="选择TikTok账号"
          aria-label="当前TikTok账号"
          class="min-w-64"
          @change="changeAccount"
        />
        <Button :disabled="locked" @click="accountsOpen = true">
          账号管理
        </Button>
        <Button
          v-if="canManage"
          type="primary"
          :disabled="locked"
          @click="openCookie()"
        >
          添加账号
        </Button>
        <Button :disabled="locked" @click="checkAccount"> 读取当前账号 </Button>
        <Button :disabled="locked || !account" @click="chooseDirectory">
          选择本地视频目录
        </Button>
        <Button v-if="account" :disabled="locked" @click="logout">
          退出当前账号
        </Button>
      </div>
      <Alert
        v-if="legacy && canManage"
        type="info"
        message="检测到旧版本本机账号"
        description="迁移成功后将清除旧localStorage中的Cookie，账号保存到当前KX用户的后端数据库。"
      >
        <template #action>
          <Button :disabled="locked" @click="migrateLegacy">
            迁移旧账号
          </Button>
        </template>
      </Alert>
      <Alert
        v-if="account"
        type="info"
        :message="`当前账号：${account.nickname} · UID ${account.uid}`"
        :description="`时区：${account.timezone}。至少提前 ${Math.ceil(account.minDelaySeconds / 60)} 分钟，最远 ${Math.floor(account.maxDelaySeconds / 86400)} 天。预约成功后由 TikTok 到时发布。`"
      />
      <Alert
        v-else
        type="info"
        message="从数据库账号列表选择账号，或添加Cookie登录；同一KX用户可在不同设备使用已保存账号。"
      />
      <p class="text-sm text-muted-foreground">
        支持 MP4、MOV、WebM，含子目录；每批最多 50 个、单个最多 30
        GB。视频分片直传，处理结果自动保存。
      </p>
      <Alert
        v-if="review"
        type="warning"
        message="存在结果待核对的预约"
        description="请在 TikTok 作品列表核实。已预约的录入对应视频 ID；确认没有创建预约后才能重试，避免重复发布。"
      />
      <TikTokOverview
        v-if="directory"
        :files="directory.files"
        :filter="statusFilter"
        @filter="statusFilter = $event"
      />
      <div v-if="directory" class="space-y-3 rounded border p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="font-semibold">
            {{ directory.name }} · 已预约 {{ completed }}/{{
              directory.files.length
            }}
            · 已选 {{ chosen.length }}
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              :disabled="locked || !account || !chosen.length || review"
              @click="savePlan"
            >
              保存预约计划
            </Button>
            <Button
              type="primary"
              :disabled="!canSubmit"
              @click="confirmOpen = true"
            >
              确认批量预约
            </Button>
            <Button :disabled="!locked || pauseRequested" @click="pause">
              {{ pauseRequested ? '暂停请求已发出' : '暂停队列' }}
            </Button>
            <Popconfirm
              title="移除本地清单？不会删除视频，也不会取消已提交的 TikTok 预约。"
              @confirm="remove"
            >
              <Button danger :disabled="locked"> 移除清单 </Button>
            </Popconfirm>
          </div>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label for="tiktok-first-time">首条发布时间</label>
            <Input
              id="tiktok-first-time"
              v-model:value="firstTime"
              type="datetime-local"
              :step="300"
              :disabled="locked"
              aria-label="首条发布时间"
            />
          </div>
          <div>
            <label for="tiktok-interval">间隔（分钟）</label>
            <InputNumber
              id="tiktok-interval"
              v-model:value="intervalMinutes"
              :min="5"
              :step="5"
              :precision="0"
              :disabled="locked"
              aria-label="发布间隔"
            />
          </div>
          <div>
            <label for="tiktok-concurrency">同时上传视频数</label>
            <InputNumber
              id="tiktok-concurrency"
              v-model:value="concurrency"
              :min="1"
              :max="8"
              :precision="0"
              :disabled="locked"
              aria-label="同时上传视频数"
            />
          </div>
          <Button :disabled="locked || !chosen.length" @click="applyInterval">
            应用到勾选视频
          </Button>
          <p v-if="dirty" class="text-sm text-muted-foreground">
            清单有未保存的修改
          </p>
        </div>
        <Alert
          v-if="directory.account && accountMismatch"
          type="warning"
          :message="`计划绑定 ${directory.account.nickname}，请读取并使用同一 TikTok 账号`"
        />
        <p class="text-sm text-muted-foreground">
          两项发布前检测默认关闭；开启后等待结果通过再提交。检测失败、未通过或超过
          15 分钟会停止队列，可调整计划后重试。
        </p>
        <Table
          row-key="id"
          :data-source="visibleFiles"
          :pagination="false"
          :scroll="{ x: 1600 }"
          size="small"
          :row-selection="{
            selectedRowKeys: selected,
            onChange: setSelected,
            getCheckboxProps: (file: TikTokVideoFile) => ({
              disabled: locked || !canUploadTikTok(file),
            }),
          }"
          :columns="[
            { title: '文件', key: 'name', width: 170, fixed: 'left' },
            { title: '视频描述', key: 'caption', width: 220 },
            { title: '发布时间（本机时区）', key: 'schedule', width: 230 },
            { title: '可见范围', key: 'visibility', width: 210 },
            { title: '发布前检测', key: 'checks', width: 170 },
            { title: '状态 / 回执', key: 'status', width: 300 },
            { title: '核对', key: 'actions', width: 250 },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <div v-if="column.key === 'name'">
              <span>{{ record.relative }}</span>
              <Button size="small" :disabled="locked" @click="preview(record)">
                预览
              </Button>
              <p class="text-sm text-muted-foreground">
                {{ size(record.size) }}
              </p>
            </div>
            <Input
              v-else-if="column.key === 'caption'"
              v-model:value="fileEdit(record).caption"
              :maxlength="4000"
              :disabled="locked || !canUploadTikTok(record)"
              :aria-label="`${record.name} 视频描述`"
            />
            <Input
              v-else-if="column.key === 'schedule'"
              v-model:value="fileEdit(record).time"
              type="datetime-local"
              :step="300"
              :disabled="locked || !canUploadTikTok(record)"
              :aria-label="`${record.name} 发布时间`"
            />
            <div v-else-if="column.key === 'visibility'" class="space-y-2">
              <Select
                v-model:value="fileEdit(record).visibility"
                :options="visibilityOptions"
                :disabled="locked || !canUploadTikTok(record)"
                class="w-full"
                :aria-label="`${record.name} 可见范围`"
              />
              <Checkbox
                v-model:checked="fileEdit(record).allowComment"
                :disabled="locked || !canUploadTikTok(record)"
              >
                允许评论
              </Checkbox>
            </div>
            <div
              v-else-if="column.key === 'checks'"
              class="flex flex-col gap-2"
            >
              <Checkbox
                v-model:checked="fileEdit(record).copyrightCheck"
                :disabled="locked || !canUploadTikTok(record)"
                :aria-label="`${record.name} 音乐版权检测`"
              >
                音乐版权
              </Checkbox>
              <Checkbox
                v-model:checked="fileEdit(record).contentCheck"
                :disabled="locked || !canUploadTikTok(record)"
                :aria-label="`${record.name} 内容检测`"
              >
                内容检测
              </Checkbox>
            </div>
            <div v-else-if="column.key === 'status'">
              <span>{{ labels[record.status] || record.status }}</span>
              <Progress
                v-if="record.status === 'uploading'"
                :percent="record.uploadPercent"
                size="small"
              />
              <p class="text-sm text-muted-foreground">{{ record.message }}</p>
              <p v-if="record.itemId" class="break-all text-sm">
                视频 ID：{{ record.itemId }}
              </p>
            </div>
            <Popconfirm
              v-else-if="
                column.key === 'actions' &&
                record.media &&
                canUploadTikTok(record)
              "
              title="清除已上传素材的引用，下次提交重新上传源文件？"
              @confirm="resetMedia(record)"
            >
              <Button size="small" :disabled="locked"> 重新上传源文件 </Button>
            </Popconfirm>
            <div
              v-else-if="column.key === 'actions' && record.status === 'review'"
              class="space-y-2"
            >
              <Input
                v-model:value="reviewIds[record.id]"
                placeholder="官方视频 ID"
                aria-label="官方视频 ID"
              />
              <Popconfirm
                title="已在 TikTok 核实这条预约且视频 ID 一致？"
                @confirm="reconcile(record, true)"
              >
                <Button size="small" :disabled="locked"> 确认已预约 </Button>
              </Popconfirm>
              <Popconfirm
                title="确认 TikTok 中没有创建此次预约？重试可能造成重复发布，请先核实。"
                @confirm="reconcile(record, false)"
              >
                <Button size="small" :disabled="locked"> 确认未预约 </Button>
              </Popconfirm>
            </div>
          </template>
        </Table>
      </div>
      <Empty v-else description="请选择本地视频目录" />
      <p class="text-sm text-muted-foreground">
        暂停会停止未提交的操作，已发出的发布请求仍等待回执；退出应用后不会自动重试未知结果。移除本地清单不取消远端预约。
      </p>
      <Modal
        v-model:open="confirmOpen"
        title="确认预约发布清单"
        :width="900"
        ok-text="提交这些预约"
        cancel-text="返回修改"
        :ok-button-props="{ disabled: !canSubmit }"
        @ok="submit"
      >
        <p class="mb-3">
          账号：{{ account?.nickname }}（{{ account?.uid }}） · 时区：{{
            account?.timezone
          }}
          · {{ chosen.length }} 个视频 · 同时处理 {{ concurrency }} 个视频
        </p>
        <Table
          :data-source="chosen"
          row-key="id"
          :pagination="false"
          :scroll="{ x: 700 }"
          size="small"
          :columns="[
            { title: '视频描述', key: 'caption' },
            { title: '发布时间', key: 'time' },
            { title: '可见范围', key: 'visibility' },
            { title: '发布前检测', key: 'checks' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <span v-if="column.key === 'caption'">{{
              record.schedule?.caption
            }}</span>
            <span v-else-if="column.key === 'time'">{{
              record.schedule
                ? localDateTime(record.schedule.scheduledAt).replace('T', ' ')
                : ''
            }}</span>
            <span v-else-if="column.key === 'checks'">{{
              [
                record.schedule?.copyrightCheck ? '音乐版权' : '',
                record.schedule?.contentCheck ? '内容检测' : '',
              ]
                .filter(Boolean)
                .join('、') || '全部关闭'
            }}</span>
            <span v-else-if="column.key === 'visibility'">{{
              record.schedule?.visibility === 2
                ? '朋友'
                : '公开（私密账号为关注者）'
            }}</span>
          </template>
        </Table>
      </Modal>
      <Modal
        v-model:open="accountsOpen"
        title="TikTok账号管理"
        :footer="null"
        :width="800"
      >
        <p class="mb-3 text-sm text-muted-foreground">
          账号由KX后端保存。切换账号同时恢复此设备上的专属视频清单；执行中请先暂停队列。
        </p>
        <Button :disabled="locked" @click="act(loadAccounts)">
          刷新账号
        </Button>
        <Table
          :data-source="accounts"
          :pagination="false"
          :row-key="(row: TikTokStoredAccount) => row.account.uid"
          :columns="[
            { title: '账号', key: 'account' },
            { title: '状态', key: 'state' },
            { title: '操作', key: 'actions' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <div v-if="column.key === 'account'">
              <strong>{{ record.label }}</strong>
              <p>{{ record.account.nickname }} · {{ record.account.uid }}</p>
            </div>
            <span v-else-if="column.key === 'state'">{{
              !record.enabled
                ? '已停用'
                : record.account.uid === account?.uid
                  ? '当前账号'
                  : '可切换'
            }}</span>
            <div v-else class="flex flex-wrap gap-2">
              <Button
                :disabled="locked || !record.enabled"
                @click="changeAccount(record.account.uid)"
              >
                切换
              </Button>
              <Button
                v-if="canManage"
                :disabled="locked"
                @click="openCookie(record.account.uid)"
              >
                {{ record.enabled ? '更新Cookie / 备注' : '重新登录启用' }}
              </Button>
              <Popconfirm
                v-if="canManage && record.enabled"
                title="停用此账号？会同步到其他设备，不会取消TikTok已创建的预约。"
                @confirm="disableAccount(record)"
              >
                <Button danger :disabled="locked"> 停用 </Button>
              </Popconfirm>
            </div>
          </template>
        </Table>
      </Modal>
      <Modal
        v-model:open="previewOpen"
        :title="previewName"
        :footer="null"
        :width="800"
        destroy-on-hidden
        @after-close="previewUrl = ''"
      >
        <video
          v-if="previewOpen && previewUrl"
          :src="previewUrl"
          controls
          preload="metadata"
          class="max-h-[65vh] w-full"
          @error="errorText = '当前视频编码无法预览，请确认源文件格式'"
        >
          当前格式不支持预览
        </video>
      </Modal>
      <Modal
        v-model:open="cookieOpen"
        :title="updatingUid ? '更新TikTok账号Cookie' : '添加TikTok账号'"
        ok-text="验证并保存账号"
        cancel-text="取消"
        :confirm-loading="busy"
        :ok-button-props="{
          disabled: !cookieText.trim() && !(updatingUid && accountLabel.trim()),
        }"
        @ok="cookieLogin"
        @cancel="cookieText = ''"
      >
        <p class="mb-3">
          从已登录的 tiktok.com 请求中复制 Cookie
          请求头值。系统直接请求用户信息，成功后加密保存到KX后端数据库，供当前KX用户跨设备使用。
        </p>
        <label for="tiktok-account-label">账号备注（可选）</label>
        <Input
          id="tiktok-account-label"
          v-model:value="accountLabel"
          :maxlength="100"
          class="mb-3"
        />
        <label for="tiktok-cookie">Cookie 请求头</label>
        <Input.TextArea
          id="tiktok-cookie"
          v-model:value="cookieText"
          :auto-size="{ minRows: 5, maxRows: 12 }"
          :spellcheck="false"
          autocomplete="off"
          placeholder="sessionid=...; ..."
          class="mb-3 font-mono"
        />
        <label for="tiktok-user-agent">User-Agent（可选）</label>
        <Input
          id="tiktok-user-agent"
          v-model:value="userAgent"
          :maxlength="2048"
          autocomplete="off"
          placeholder="不填写时使用默认桌面浏览器标识"
        />
        <Alert
          v-if="errorText"
          class="mt-3"
          type="error"
          :message="errorText"
        />
      </Modal>
    </template>
  </section>
</template>
