<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type { NotifyInboxItem } from '#/api/notify';

import {
  computed,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { RotateCw, UserRoundPen } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useTabbarStore, useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { USER_OVERVIEW_PATH } from '#/router/routes/core';
import { useAuthStore, useNotifyInboxStore } from '#/store';
import { Times } from '#/times';
import LoginForm from '#/views/_core/authentication/login.vue';

const { setMenuList } = useTabbarStore();
const router = useRouter();
setMenuList([
  'close',
  'affix',
  'maximize',
  'reload',
  'open-in-new-window',
  'close-left',
  'close-right',
  'close-other',
  'close-all',
]);

const userStore = useUserStore();
const authStore = useAuthStore();
const notifyInboxStore = useNotifyInboxStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();

const avatar = computed(
  () => userStore.userInfo?.avatar ?? preferences.app.defaultAvatar,
);
const permissionRefreshing = ref(false);
const userMenus = computed(() => [
  {
    handler: () => router.push(USER_OVERVIEW_PATH),
    icon: UserRoundPen,
    text: '我的信息',
  },
  {
    handler: handleRefreshPermissions,
    icon: RotateCw,
    text: permissionRefreshing.value ? '权限刷新中...' : '刷新权限',
  },
]);

interface HeaderNotificationItem extends NotificationItem {
  source_id: number | string;
  source_type: NotifyInboxItem['source_type'];
}

const notifications = computed<HeaderNotificationItem[]>(() =>
  notifyInboxStore.items.slice(0, 20).map((item) => ({
    avatar: avatar.value,
    date: Times.formatUnix(item.event_at),
    id: `${item.source_type}:${item.source_id}`,
    isRead: item.read,
    link: item.link ?? undefined,
    message: item.content,
    source_id: item.source_id,
    source_type: item.source_type,
    title: item.title,
  })),
);

let inboxPollTimer: number | undefined;

function refreshInbox() {
  if (document.hidden) return;
  void notifyInboxStore.load().catch(() => undefined);
}

async function markNotificationRead(item: NotificationItem) {
  if (!isHeaderNotificationItem(item)) return;
  if (item.isRead) return;
  await notifyInboxStore.markRead(item.source_type, item.source_id);
}

function isHeaderNotificationItem(
  item: NotificationItem,
): item is HeaderNotificationItem {
  return (
    (item.source_type === 'task_run' ||
      item.source_type === 'delivery_recipient') &&
    (typeof item.source_id === 'number' || typeof item.source_id === 'string')
  );
}

async function handleNotificationClick(item: NotificationItem) {
  if (!isHeaderNotificationItem(item)) return;
  await markNotificationRead(item);
  if (item.link) await router.push(item.link);
}

async function dismissNotification(item: NotificationItem) {
  if (!isHeaderNotificationItem(item)) return;
  await notifyInboxStore.dismiss(item.source_type, item.source_id);
}

async function markAllNotificationsRead() {
  await notifyInboxStore.markAllRead();
}

async function clearNotifications() {
  await notifyInboxStore.clear();
}

async function viewAllNotifications() {
  await router.push('/notifications');
}

async function handleLogout() {
  await authStore.logout(false);
}

async function handleRefreshPermissions() {
  if (permissionRefreshing.value) return;
  permissionRefreshing.value = true;
  try {
    // 延迟加载可避免基础布局与动态路由生成模块形成静态循环依赖。
    const { refreshCurrentAccess } = await import('#/router/access');
    await refreshCurrentAccess(router);
    message.success('权限已刷新');
  } finally {
    permissionRefreshing.value = false;
  }
}

watch(
  () => ({
    content: preferences.app.watermarkContent,
    enable: preferences.app.watermark,
    isDark: isDark.value,
  }),
  async ({ content, enable, isDark: isDarkValue }) => {
    if (!enable) {
      destroyWatermark();
      return;
    }

    const color = isDarkValue
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.12)';
    await updateWatermark({
      advancedStyle: {
        colorStops: [
          { color, offset: 0 },
          { color, offset: 1 },
        ],
        type: 'linear',
      },
      content:
        content ||
        `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
    });
  },
  { immediate: true },
);

onBeforeMount(() => {
  if (preferences.app.watermark) destroyWatermark();
});

onMounted(() => {
  refreshInbox();
  inboxPollTimer = window.setInterval(refreshInbox, 30_000);
});

onBeforeUnmount(() => {
  if (inboxPollTimer !== undefined) window.clearInterval(inboxPollTimer);
});
</script>

<template>
  <BasicLayout
    :avatar
    :text="userStore.userInfo?.realName"
    @clear-preferences-and-logout="handleLogout"
    @logout="handleLogout"
  >
    <template #notification>
      <Notification
        :dot="notifyInboxStore.unreadCount > 0"
        :notifications="notifications"
        class="mr-1"
        @clear="clearNotifications"
        @make-all="markAllNotificationsRead"
        @on-click="handleNotificationClick"
        @read="markNotificationRead"
        @remove="dismissNotification"
        @view-all="viewAllNotifications"
      />
    </template>
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus="userMenus"
        :text="userStore.userInfo?.realName"
        :description="userStore.userInfo?.desc"
        :notification-dot="notifyInboxStore.unreadCount > 0"
        :notifications="notifications"
        trigger="both"
        @logout="handleLogout"
        @clear-preferences-and-logout="handleLogout"
        @notification-clear="clearNotifications"
        @notification-click="handleNotificationClick"
        @notification-make-all="markAllNotificationsRead"
        @notification-read="markNotificationRead"
        @notification-remove="dismissNotification"
        @notification-view-all="viewAllNotifications"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-if="!authStore.isLoggingOut"
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
