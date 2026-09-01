<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DingtalkKnowledgeTargetCfg,
  NotifyChannel,
  SystemDept,
  SystemUser,
  WeeklyReportNotificationStyle,
  WeeklyReportParticipant,
  WeeklyReportPublish,
} from '#/api';
import type { StatusValue } from '#/api/system/shared';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page, Tree, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Download, Plus, RotateCw } from '@vben/icons';
import { useUserStore } from '@vben/stores';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Form as AForm,
  Button,
  Card,
  DatePicker,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  InputSearch,
  message,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
} from 'antdv-next';
import dayjs from 'dayjs';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  DingtalkNotifyApi,
  NotifyChannelApi,
  SystemDeptApi,
  SystemUserApi,
} from '#/api';
import { $t } from '#/locales';
import { Times } from '#/times';

import { useColumns, useGridFormSchema } from './data';
import { collectDeptIdsIncludingDescendants } from './dept-descendants';
import Detail from './modules/detail.vue';
import UserForm from './modules/form.vue';
import PopupModal from './modules/popup-modal.vue';
import WeeklyReportRepublish from './modules/weekly-report-republish.vue';

interface UserSearchFormValues extends Record<string, unknown> {
  createTime?: [Dayjs, Dayjs];
}

interface WeeklyReportFormState {
  current_week_end: Dayjs;
  current_week_start: Dayjs;
  next_week_end: Dayjs;
  next_week_start: Dayjs;
  report_date: Dayjs;
  reporter: string;
  week_no: number;
}

const userSearchCodec = Times.createDateRangeCodec<UserSearchFormValues>()({
  endField: 'endTime',
  rangeField: 'createTime',
  startField: 'startTime',
});

type UserSearchSubmitValues = ReturnType<typeof userSearchCodec.encode>;

const userStore = useUserStore();
const route = useRoute();
const allDeptList = ref<SystemDept[]>([]);
const deptList = ref<SystemDept[]>([]);
const inputSearchValue = ref('');
const selectedDeptId = ref<string>();
const selectedDeptIds = ref<string[]>([]);
const selectedDeptName = ref('');
let suppressNextDeptQuery = false;
const weeklyReportOpen = ref(false);
const weeklyReportLoading = ref(false);
const weeklyReportDingTalkOpen = ref(false);
const weeklyReportDingTalkLoading = ref(false);
const weeklyReportForm = ref(defaultWeeklyReportForm());
const weeklyReportKnowledgeTargetId = ref<number>();
const weeklyReportChannelId = ref<number>();
const weeklyReportNotificationStyle =
  ref<WeeklyReportNotificationStyle>('link_card');
const weeklyReportKnowledgeTargets = ref<DingtalkKnowledgeTargetCfg[]>([]);
const weeklyReportChannels = ref<NotifyChannel[]>([]);
const weeklyReportPublishOpen = ref(false);
const weeklyReportPublishLoading = ref(false);
const weeklyReportParticipantLoading = ref(false);
const weeklyReportPublishes = ref<WeeklyReportPublish[]>([]);
const weeklyReportParticipants = ref<WeeklyReportParticipant[]>([]);
let weeklyReportParticipantRequest = 0;
const weeklyReportNotificationStyleOptions = [
  { label: '链接卡片', value: 'link_card' },
  { label: '按钮卡片', value: 'action_card' },
  { label: 'Markdown', value: 'markdown' },
] satisfies Array<{ label: string; value: WeeklyReportNotificationStyle }>;
const selectedWeeklyReportPublishId = ref<number | string>();
const reindexingSearch = ref(false);
const resetPasswordOpen = ref(false);
const resetPasswordLoading = ref(false);
const resetPasswordValue = ref('');
const resetPasswordUser = ref<SystemUser>();
const passwordResultOpen = ref(false);
const passwordResult = ref({ password: '', userName: '' });
const selectedWeeklyReportPublish = computed(() =>
  weeklyReportPublishes.value.find(
    (item) => String(item.id) === String(selectedWeeklyReportPublishId.value),
  ),
);
function canRefreshWeeklyReport(publish?: WeeklyReportPublish) {
  return Boolean(
    publish &&
    (publish.status === 'content_written' ||
      publish.status === 'message_queued' ||
      (publish.status === 'failed' && publish.sheet_id)),
  );
}

const canRemindSelectedWeeklyReport = computed(() => {
  return canRefreshWeeklyReport(selectedWeeklyReportPublish.value);
});

const [WeeklyReportRepublishModal, weeklyReportRepublishModalApi] =
  useVbenModal({
    connectedComponent: WeeklyReportRepublish,
    destroyOnClose: false,
  });

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: UserForm,
  destroyOnClose: true,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

async function reindexSearch() {
  reindexingSearch.value = true;
  try {
    const result = await SystemUserApi.reindexSearch();
    message.success(`用户搜索索引已重建，共 ${result.indexed} 条`);
    await gridApi.query();
  } finally {
    reindexingSearch.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    codec: userSearchCodec,
    handleReset: () => {
      const hadSelection = Boolean(selectedDeptId.value);
      suppressNextDeptQuery = hadSelection;
      selectedDeptId.value = undefined;
      selectedDeptIds.value = [];
      selectedDeptName.value = '';
    },
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: UserSearchSubmitValues) => {
          return await SystemUserApi.list({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            deptIds: selectedDeptIds.value,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },

    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemUser>,
});

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(newStatus: number, row: SystemUser) {
  const status: Recordable<string> = {
    0: '禁用',
    1: '启用',
  };
  try {
    await confirm(
      `你要将${row.name}的状态切换为 【${status[newStatus.toString()]}】 吗？`,
      `切换状态`,
    );
    await SystemUserApi.update(row.id, { status: newStatus as StatusValue });
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemUser) {
  formDrawerApi.setData(row).open();
}

function onDetail(row: SystemUser) {
  detailDrawerApi.setData(row).open();
}

function onResetMfa(row: SystemUser) {
  Modal.confirm({
    async onOk() {
      await SystemUserApi.reset_totp(row.id);
      message.success(`已重置用户「${row.name}」的 TOTP 二次验证`);
    },
    okText: '重置',
    okType: 'danger',
    title: `确认重置用户「${row.name}」的 TOTP 二次验证？`,
  });
}

function onResetPassword(row: SystemUser) {
  resetPasswordUser.value = row;
  resetPasswordValue.value = '';
  resetPasswordOpen.value = true;
}

async function submitResetPassword() {
  const password = resetPasswordValue.value;
  if (password && [...password].length < 8) {
    message.warning('密码至少需要 8 位');
    return;
  }
  const user = resetPasswordUser.value;
  if (!user) return;
  resetPasswordLoading.value = true;
  try {
    const result = await SystemUserApi.reset_password(user.id, password);
    resetPasswordOpen.value = false;
    showPasswordResult(result.user_name, result.password);
  } finally {
    resetPasswordLoading.value = false;
  }
}

function showPasswordResult(userName: string, password: string) {
  passwordResult.value = { password, userName };
  passwordResultOpen.value = true;
}

async function copyLoginInfo() {
  try {
    await navigator.clipboard.writeText(
      `用户名：${passwordResult.value.userName}\n密码：${passwordResult.value.password}`,
    );
    message.success('登录信息已复制');
  } catch {
    message.error('复制失败，请手动复制用户名和密码');
  }
}

async function onUserSaved(user?: SystemUser) {
  await onRefresh();
  if (user?.initialPassword) {
    showPasswordResult(user.name, user.initialPassword);
  }
}

function onDelete(row: SystemUser) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  SystemUserApi.remove(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

async function loadDeptList() {
  try {
    const res = await SystemDeptApi.list();
    allDeptList.value = res;
    deptList.value = res;
  } catch (error) {
    console.error('Failed to load department list:', error);
  }
}

function applyDeptSelection(value?: number | string) {
  const deptId = value === undefined ? '' : String(value);
  selectedDeptIds.value = collectDeptIdsIncludingDescendants(
    allDeptList.value,
    deptId,
  );
  selectedDeptName.value = findDeptName(allDeptList.value, deptId);
  if (suppressNextDeptQuery) {
    suppressNextDeptQuery = false;
    return;
  }
  gridApi.query();
}

function findDeptName(nodes: SystemDept[], id: string): string {
  if (!id) return '';
  for (const node of nodes) {
    if (String(node.id) === id) return node.name;
    const child = findDeptName(node.children ?? [], id);
    if (child) return child;
  }
  return '';
}

function defaultWeeklyReportForm(): WeeklyReportFormState {
  const reportDate = dayjs();
  const weekday = reportDate.day() || 7;
  const currentStart = reportDate.subtract(weekday - 1, 'day');
  const currentEnd = currentStart.add(5, 'day');
  const nextStart = currentStart.add(7, 'day');
  const nextEnd = nextStart.add(5, 'day');
  return {
    current_week_end: currentEnd,
    current_week_start: currentStart,
    next_week_end: nextEnd,
    next_week_start: nextStart,
    report_date: reportDate,
    reporter:
      userStore.userInfo?.realName || userStore.userInfo?.username || '',
    week_no: Math.ceil(reportDate.date() / 7),
  };
}

function sanitizeFileNamePart(value: string) {
  const sanitized = value
    .replaceAll(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return sanitized || '部门';
}

function weeklyReportFileName() {
  const form = weeklyReportForm.value;
  return `${sanitizeFileNamePart(selectedDeptName.value)}${form.report_date.format('YYYY年MM月')}第${form.week_no}周 工作汇报.xlsx`;
}

function openWeeklyReportExport() {
  if (!selectedDeptId.value) {
    message.warning('请先选择部门');
    return;
  }
  weeklyReportForm.value = defaultWeeklyReportForm();
  weeklyReportOpen.value = true;
}

async function exportWeeklyReport() {
  if (!selectedDeptId.value) {
    message.warning('请先选择部门');
    return;
  }
  const form = weeklyReportForm.value;
  const deptId = Number(selectedDeptId.value);
  if (!Number.isSafeInteger(deptId) || deptId <= 0) {
    message.error('部门 ID 无效');
    return;
  }
  weeklyReportLoading.value = true;
  try {
    const blob = await SystemUserApi.weekly_report_template({
      current_week_end: form.current_week_end.format('YYYY-MM-DD'),
      current_week_start: form.current_week_start.format('YYYY-MM-DD'),
      dept_id: deptId,
      next_week_end: form.next_week_end.format('YYYY-MM-DD'),
      next_week_start: form.next_week_start.format('YYYY-MM-DD'),
      report_date: form.report_date.format('YYYY-MM-DD'),
      reporter: form.reporter.trim(),
      week_no: form.week_no,
    });
    downloadFileFromBlob({ fileName: weeklyReportFileName(), source: blob });
    message.success('周报模板已生成');
    weeklyReportOpen.value = false;
  } finally {
    weeklyReportLoading.value = false;
  }
}

function weeklyReportRequestBase() {
  const form = weeklyReportForm.value;
  const deptId = Number(selectedDeptId.value);
  if (!Number.isSafeInteger(deptId) || deptId <= 0) {
    throw new Error('部门 ID 无效');
  }
  return {
    current_week_end: form.current_week_end.format('YYYY-MM-DD'),
    current_week_start: form.current_week_start.format('YYYY-MM-DD'),
    dept_id: deptId,
    next_week_end: form.next_week_end.format('YYYY-MM-DD'),
    next_week_start: form.next_week_start.format('YYYY-MM-DD'),
    report_date: form.report_date.format('YYYY-MM-DD'),
    reporter: form.reporter.trim(),
    week_no: form.week_no,
  };
}

async function loadWeeklyReportDingTalkOptions() {
  const [targets, customRobotChannels, groupBotChannels] = await Promise.all([
    DingtalkNotifyApi.knowledge_targets({
      page: 1,
      size: 100,
      status: 'enabled',
    }),
    NotifyChannelApi.list({
      channel_type: 'dingtalk_custom_robot',
      page: 1,
      size: 100,
      status: 'enabled',
    }),
    NotifyChannelApi.list({
      channel_type: 'dingtalk_group_bot',
      page: 1,
      size: 100,
      status: 'enabled',
    }),
  ]);
  weeklyReportKnowledgeTargets.value = targets.items;
  weeklyReportChannels.value = [
    ...customRobotChannels.items,
    ...groupBotChannels.items,
  ];
  const selectedTarget = targets.items.find(
    (item) => Number(item.id) === weeklyReportKnowledgeTargetId.value,
  );
  const selectedChannel = weeklyReportChannels.value.find(
    (item) => Number(item.id) === weeklyReportChannelId.value,
  );
  weeklyReportKnowledgeTargetId.value = Number(
    selectedTarget?.id ?? targets.items[0]?.id,
  );
  weeklyReportChannelId.value = Number(
    selectedChannel?.id ?? weeklyReportChannels.value[0]?.id,
  );
}

async function openWeeklyReportDingTalk() {
  if (!selectedDeptId.value) {
    message.warning('请先选择部门');
    return;
  }
  weeklyReportForm.value = defaultWeeklyReportForm();
  weeklyReportNotificationStyle.value = 'link_card';
  weeklyReportDingTalkOpen.value = true;
  weeklyReportDingTalkLoading.value = true;
  try {
    await loadWeeklyReportDingTalkOptions();
  } finally {
    weeklyReportDingTalkLoading.value = false;
  }
}

async function publishWeeklyReportDingTalk() {
  if (!weeklyReportKnowledgeTargetId.value || !weeklyReportChannelId.value) {
    message.warning('请选择钉钉知识库目标和消息通道');
    return;
  }
  weeklyReportDingTalkLoading.value = true;
  try {
    const task = await SystemUserApi.weekly_report_dingtalk({
      ...weeklyReportRequestBase(),
      channel_id: Number(weeklyReportChannelId.value),
      knowledge_target_id: Number(weeklyReportKnowledgeTargetId.value),
      notification_style: weeklyReportNotificationStyle.value,
    });
    message.success(`周报发布执行已提交：#${task.id}`);
    weeklyReportDingTalkOpen.value = false;
  } finally {
    weeklyReportDingTalkLoading.value = false;
  }
}

async function openWeeklyReportPublishes() {
  weeklyReportPublishOpen.value = true;
  await loadWeeklyReportPublishes();
}

async function loadWeeklyReportPublishes(
  preferredId:
    | number
    | string
    | undefined = selectedWeeklyReportPublishId.value,
) {
  weeklyReportPublishLoading.value = true;
  try {
    const page = await SystemUserApi.weekly_report_publishes({
      page: 1,
      pageSize: 20,
    });
    weeklyReportPublishes.value = page.items;
    if (
      preferredId !== undefined &&
      !page.items.some((item) => String(item.id) === String(preferredId))
    ) {
      const publish = await SystemUserApi.weekly_report_publish(preferredId);
      weeklyReportPublishes.value = [publish, ...page.items];
    }
    const selected =
      weeklyReportPublishes.value.find(
        (item) => String(item.id) === String(preferredId),
      ) ?? weeklyReportPublishes.value[0];
    if (selected) {
      await selectWeeklyReportPublish(selected.id);
    } else {
      selectedWeeklyReportPublishId.value = undefined;
      weeklyReportParticipants.value = [];
    }
  } finally {
    weeklyReportPublishLoading.value = false;
  }
}

async function selectWeeklyReportPublish(id: number | string) {
  const request = ++weeklyReportParticipantRequest;
  selectedWeeklyReportPublishId.value = id;
  const publish = selectedWeeklyReportPublish.value;
  if (!canRefreshWeeklyReport(publish)) {
    weeklyReportParticipants.value = [];
    weeklyReportParticipantLoading.value = false;
    return;
  }
  weeklyReportParticipantLoading.value = true;
  try {
    const participants = await SystemUserApi.weekly_report_preview_missing(id);
    if (request === weeklyReportParticipantRequest) {
      weeklyReportParticipants.value = participants;
    }
  } finally {
    if (request === weeklyReportParticipantRequest) {
      weeklyReportParticipantLoading.value = false;
    }
  }
}

async function remindWeeklyReportMissing() {
  if (!selectedWeeklyReportPublishId.value) return;
  const publishId = selectedWeeklyReportPublishId.value;
  const task = await SystemUserApi.weekly_report_remind_missing(publishId);
  message.success(`周报填写检查已提交：#${task.id}`);
  await loadWeeklyReportPublishes(publishId);
}

async function republishWeeklyReport() {
  if (!selectedWeeklyReportPublishId.value) return;
  const publish = selectedWeeklyReportPublish.value;
  if (!publish) return;
  if (weeklyReportChannels.value.length === 0) {
    weeklyReportPublishLoading.value = true;
    try {
      await loadWeeklyReportDingTalkOptions();
    } finally {
      weeklyReportPublishLoading.value = false;
    }
  }
  weeklyReportRepublishModalApi
    .setData({ channels: weeklyReportChannels.value, publish })
    .open();
}

async function onWeeklyReportRepublished(publishId: number | string) {
  await loadWeeklyReportPublishes(publishId);
}

function openWeeklyReportDocument() {
  const url = selectedWeeklyReportPublish.value?.doc_url;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function searchDept(value: string) {
  const keyword = value.trim().toLowerCase();
  deptList.value = keyword
    ? filterDeptTree(allDeptList.value, keyword)
    : allDeptList.value;
}

function filterDeptTree(nodes: SystemDept[], keyword: string): SystemDept[] {
  const filtered: SystemDept[] = [];
  for (const node of nodes) {
    const children = filterDeptTree(node.children ?? [], keyword);
    if (node.name.toLowerCase().includes(keyword) || children.length > 0) {
      filtered.push({ ...node, children });
    }
  }
  return filtered;
}

onMounted(async () => {
  await loadDeptList();
  const publishId = route.query.weekly_report_publish_id;
  if (typeof publishId === 'string' && publishId.trim()) {
    weeklyReportPublishOpen.value = true;
    await loadWeeklyReportPublishes(publishId);
  }
});

watch(inputSearchValue, (value) => {
  searchDept(value);
});

watch(selectedDeptId, (value) => {
  applyDeptSelection(value);
});
</script>
<template>
  <Page
    auto-content-height
    class="management-page user-page"
    content-class="management-content user-content"
  >
    <FormDrawer @success="onUserSaved" />
    <DetailDrawer @success="onRefresh" />
    <WeeklyReportRepublishModal @success="onWeeklyReportRepublished" />
    <PopupModal
      v-model:open="resetPasswordOpen"
      :confirm-loading="resetPasswordLoading"
      title="重置登录密码"
      width="520px"
      @ok="submitResetPassword"
    >
      <AForm layout="vertical">
        <FormItem label="用户">
          <Input :value="resetPasswordUser?.name" disabled />
        </FormItem>
        <FormItem
          extra="留空则由服务端生成 12 位随机密码。重置后旧密码立即失效。"
          label="新密码"
        >
          <InputPassword
            v-model:value="resetPasswordValue"
            allow-clear
            autocomplete="new-password"
            placeholder="至少 8 位，或留空自动生成"
          />
        </FormItem>
      </AForm>
    </PopupModal>
    <PopupModal
      v-model:open="passwordResultOpen"
      :footer="null"
      title="登录信息"
      width="520px"
    >
      <p class="mb-4 text-sm text-muted-foreground">
        密码明文仅本次展示，请立即交给用户并妥善保存。
      </p>
      <AForm layout="vertical">
        <FormItem label="用户名">
          <Input :value="passwordResult.userName" readonly />
        </FormItem>
        <FormItem label="密码">
          <InputPassword :value="passwordResult.password" readonly />
        </FormItem>
      </AForm>
      <Button block type="primary" @click="copyLoginInfo">复制登录信息</Button>
    </PopupModal>
    <PopupModal
      v-model:open="weeklyReportOpen"
      :confirm-loading="weeklyReportLoading"
      title="导出周报模板"
      width="640px"
      @ok="exportWeeklyReport"
    >
      <AForm layout="vertical">
        <FormItem label="部门">
          <Input :value="selectedDeptName" disabled />
        </FormItem>
        <div class="weekly-report-grid">
          <FormItem label="报告日期">
            <DatePicker
              v-model:value="weeklyReportForm.report_date"
              class="w-full"
            />
          </FormItem>
          <FormItem label="月内周次">
            <InputNumber
              v-model:value="weeklyReportForm.week_no"
              class="w-full"
              :max="6"
              :min="1"
            />
          </FormItem>
          <FormItem label="本周开始">
            <DatePicker
              v-model:value="weeklyReportForm.current_week_start"
              class="w-full"
            />
          </FormItem>
          <FormItem label="本周结束">
            <DatePicker
              v-model:value="weeklyReportForm.current_week_end"
              class="w-full"
            />
          </FormItem>
          <FormItem label="下周开始">
            <DatePicker
              v-model:value="weeklyReportForm.next_week_start"
              class="w-full"
            />
          </FormItem>
          <FormItem label="下周结束">
            <DatePicker
              v-model:value="weeklyReportForm.next_week_end"
              class="w-full"
            />
          </FormItem>
        </div>
        <FormItem label="汇报人">
          <Input v-model:value="weeklyReportForm.reporter" />
        </FormItem>
      </AForm>
    </PopupModal>
    <PopupModal
      v-model:open="weeklyReportDingTalkOpen"
      :confirm-loading="weeklyReportDingTalkLoading"
      title="发布周报到钉钉"
      width="680px"
      @ok="publishWeeklyReportDingTalk"
    >
      <AForm layout="vertical">
        <FormItem label="部门">
          <Input :value="selectedDeptName" disabled />
        </FormItem>
        <div class="weekly-report-grid">
          <FormItem label="报告日期">
            <DatePicker
              v-model:value="weeklyReportForm.report_date"
              class="w-full"
            />
          </FormItem>
          <FormItem label="月内周次">
            <InputNumber
              v-model:value="weeklyReportForm.week_no"
              class="w-full"
              :max="6"
              :min="1"
            />
          </FormItem>
          <FormItem label="本周开始">
            <DatePicker
              v-model:value="weeklyReportForm.current_week_start"
              class="w-full"
            />
          </FormItem>
          <FormItem label="本周结束">
            <DatePicker
              v-model:value="weeklyReportForm.current_week_end"
              class="w-full"
            />
          </FormItem>
          <FormItem label="下周开始">
            <DatePicker
              v-model:value="weeklyReportForm.next_week_start"
              class="w-full"
            />
          </FormItem>
          <FormItem label="下周结束">
            <DatePicker
              v-model:value="weeklyReportForm.next_week_end"
              class="w-full"
            />
          </FormItem>
        </div>
        <FormItem label="汇报人">
          <Input v-model:value="weeklyReportForm.reporter" />
        </FormItem>
        <FormItem label="钉钉知识库目标">
          <Select
            v-model:value="weeklyReportKnowledgeTargetId"
            :options="
              weeklyReportKnowledgeTargets.map((item) => ({
                label: `${item.target_name} (${item.target_code})`,
                value: Number(item.id),
              }))
            "
            placeholder="请选择知识库目标"
          />
        </FormItem>
        <FormItem label="消息推送通道">
          <Select
            v-model:value="weeklyReportChannelId"
            :options="
              weeklyReportChannels.map((item) => ({
                label: `${item.channel_name} / ${
                  item.channel_type === 'dingtalk_custom_robot'
                    ? '自定义群机器人'
                    : '企业群机器人'
                } (${item.channel_code})`,
                value: Number(item.id),
              }))
            "
            placeholder="请选择钉钉消息通道"
          />
        </FormItem>
        <FormItem label="消息样式">
          <Segmented
            v-model:value="weeklyReportNotificationStyle"
            block
            :options="weeklyReportNotificationStyleOptions"
          />
        </FormItem>
      </AForm>
    </PopupModal>
    <PopupModal
      v-model:open="weeklyReportPublishOpen"
      :confirm-loading="weeklyReportPublishLoading"
      title="周报发布记录"
      width="900px"
    >
      <div class="weekly-publish-layout">
        <div class="weekly-publish-list">
          <Button block class="mb-2" @click="() => loadWeeklyReportPublishes()">
            刷新记录
          </Button>
          <button
            v-for="item in weeklyReportPublishes"
            :key="item.id"
            class="weekly-publish-item"
            :class="{
              active: String(selectedWeeklyReportPublishId) === String(item.id),
            }"
            type="button"
            @click="selectWeeklyReportPublish(item.id)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.status }} / {{ item.reminder_status }}</span>
            <span>{{ Times.formatOptionalUnix(item.updated_at) }}</span>
          </button>
        </div>
        <div class="weekly-participant-list">
          <Space class="mb-2">
            <Button
              :disabled="!canRemindSelectedWeeklyReport"
              :loading="weeklyReportParticipantLoading"
              type="primary"
              @click="remindWeeklyReportMissing"
            >
              {{
                selectedWeeklyReportPublish?.reminder_round
                  ? '重新提醒未写人员'
                  : '提醒未写人员'
              }}
            </Button>
            <Button
              :disabled="!selectedWeeklyReportPublishId"
              :loading="weeklyReportParticipantLoading"
              @click="
                selectedWeeklyReportPublishId &&
                selectWeeklyReportPublish(selectedWeeklyReportPublishId)
              "
            >
              <template #icon><RotateCw /></template>
              刷新名单
            </Button>
            <Button
              v-if="selectedWeeklyReportPublish?.doc_url"
              @click="openWeeklyReportDocument"
            >
              打开钉钉文档
            </Button>
            <Button
              :disabled="!selectedWeeklyReportPublishId"
              @click="republishWeeklyReport"
            >
              <template #icon><RotateCw /></template>
              重新推送周报
            </Button>
          </Space>
          <Spin :spinning="weeklyReportParticipantLoading">
            <div
              v-for="(participant, index) in weeklyReportParticipants"
              :key="participant.id"
              class="weekly-participant-item"
            >
              <span>{{ index + 1 }}. {{ participant.display_name }}</span>
              <span>未填写</span>
              <span>{{
                Times.formatOptionalUnix(participant.last_checked_at)
              }}</span>
              <span>提醒 {{ participant.reminder_count }} 次</span>
            </div>
            <div
              v-if="
                !weeklyReportParticipantLoading &&
                !weeklyReportParticipants.length
              "
              class="weekly-empty"
            >
              {{
                canRemindSelectedWeeklyReport
                  ? '当前没有未填写人员'
                  : '周报文档内容尚未生成'
              }}
            </div>
          </Spin>
        </div>
      </div>
      <template #footer>
        <Button @click="weeklyReportPublishOpen = false">关闭</Button>
      </template>
    </PopupModal>
    <div class="user-layout">
      <Card class="dept-panel">
        <InputSearch
          v-model:value="inputSearchValue"
          allow-clear
          :placeholder="$t('system.user.placeholder')"
        />
        <Tree
          v-model="selectedDeptId"
          allow-clear
          class="dept-tree"
          label-field="name"
          value-field="id"
          :tree-data="deptList"
          :default-expanded-level="2"
        />
      </Card>

      <div class="user-main">
        <Grid :table-title="$t('system.user.list')">
          <template #toolbar-tools>
            <Space size="small">
              <Button
                v-access:code="'user:search-reindex'"
                :loading="reindexingSearch"
                @click="reindexSearch"
              >
                <RotateCw class="size-5" />
                重建搜索索引
              </Button>
              <Button
                v-access:code="'user:weekly-report-export'"
                :disabled="!selectedDeptId"
                @click="openWeeklyReportExport"
              >
                <Download class="size-5" />
                导出周报模板
              </Button>
              <Button
                v-access:code="'user:weekly-report-dingtalk'"
                :disabled="!selectedDeptId"
                @click="openWeeklyReportDingTalk"
              >
                发布到钉钉
              </Button>
              <Button
                v-access:code="'user:weekly-report-dingtalk'"
                @click="openWeeklyReportPublishes"
              >
                周报发布记录
              </Button>
              <Button type="primary" @click="onCreate">
                <Plus class="size-5" />
                {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
              </Button>
            </Space>
          </template>
          <template #createTime="{ row }">
            {{ Times.formatUnix(row.createTime) }}
          </template>
          <template #action="{ row }">
            <VbenTableAction
              :actions="[
                {
                  text: $t('common.detail'),
                  icon: 'lucide:eye',
                  onClick: () => onDetail(row),
                },
                {
                  text: $t('common.edit'),
                  icon: 'lucide:edit',
                  onClick: () => onEdit(row),
                },
              ]"
              :dropdown-actions="[
                {
                  text: '重置二次验证',
                  icon: 'lucide:shield-off',
                  danger: true,
                  onClick: () => onResetMfa(row),
                  auth: ['user:mfa:reset'],
                },
                {
                  text: '重置登录密码',
                  icon: 'lucide:key-round',
                  onClick: () => onResetPassword(row),
                },
                {
                  text: $t('common.delete'),
                  icon: 'lucide:trash-2',
                  danger: true,
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                    confirm: () => onDelete(row),
                  },
                  auth: ['AC_100100'],
                },
              ]"
              align="center"
            />
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.user-page {
  min-height: 0;
}

.user-page :deep(.user-content) {
  min-height: 0;
}

.user-layout {
  display: flex;
  gap: 16px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.dept-panel {
  flex: 0 0 260px;
  min-width: 220px;
  min-height: 0;
}

.dept-panel :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.dept-tree {
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  overflow: auto;
}

.user-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.weekly-report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.weekly-publish-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
}

.weekly-publish-list,
.weekly-participant-list {
  max-height: 520px;
  overflow: auto;
}

.weekly-publish-item,
.weekly-participant-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  text-align: left;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.weekly-publish-item.active {
  border-color: hsl(var(--primary));
}

.weekly-participant-item {
  grid-template-columns: minmax(0, 1fr) 110px 170px 90px;
}

.weekly-empty {
  color: hsl(var(--muted-foreground));
}

@media (max-width: 960px) {
  .user-layout {
    flex-direction: column;
  }

  .dept-panel {
    flex: 0 0 auto;
    min-height: 260px;
  }

  .weekly-report-grid,
  .weekly-publish-layout,
  .weekly-participant-item {
    grid-template-columns: 1fr;
  }
}
</style>
