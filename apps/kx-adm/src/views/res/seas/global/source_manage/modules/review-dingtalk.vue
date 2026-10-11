<script setup lang="ts">
import type {
  ReviewGroupConfig,
  ReviewGroupView,
} from '#/api/res/review-group';
import type { Id } from '#/api/res/versions';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
} from 'antdv-next';

import { reviewGroupApi as api } from '#/api/res/review-group';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{ res: Id; name: string }>();
const open = ref(false);
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const success = ref('');
const view = ref<ReviewGroupView>();
const page = ref(1);
const apps = ref<{ value: string; label: string }[]>([]);
const owners = ref<{ value: string; label: string }[]>([]);
const form = reactive<ReviewGroupConfig>({
  expected_revision: 0,
  app_key: '',
  template_id: '',
  robot_code: '',
  owner_uid: 0,
  title: '',
  enabled: true,
});
let generation = 0;
let alive = true;
let poll: ReturnType<typeof setTimeout> | undefined;
function scheduleRefresh() {
  if (poll) clearTimeout(poll);
  if (alive && open.value)
    poll = setTimeout(() => {
      if (busy.value) scheduleRefresh();
      else void load();
    }, 10_000);
}
watch(open, (value) => {
  if (!value) {
    generation++;
    if (poll) clearTimeout(poll);
  }
});
const labels: Record<string, string> = {
  unconfigured: '尚未配置',
  pending: '等待后台任务',
  running: '正在同步',
  ready: '群已就绪',
  failed: '失败，等待重试',
  blocked: '需要修复配置',
};
const messageLabels = {
  pending: '待发送',
  sending: '发送中',
  sent: '已发送',
  uncertain: '结果待核对',
};
const locked = computed(
  () => view.value?.configured && !view.value.can_reconfigure,
);
async function load(resetForm = false) {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await api.get(props.res, page.value);
    if (ticket !== generation || !alive) return;
    view.value = result;
    if (resetForm) {
      Object.assign(form, {
        expected_revision: result.revision,
        app_key: result.app_key,
        template_id: result.template_id,
        robot_code: result.robot_code,
        owner_uid: String(result.owner_uid),
        title: result.title,
        enabled: result.configured ? result.enabled : true,
      });
    }
    if (result.can_manage && resetForm) {
      const options = await api.options(props.res);
      if (ticket !== generation || !alive) return;
      apps.value = options.apps;
      owners.value = options.owners;
      if (!form.app_key && options.apps.length === 1)
        form.app_key = options.apps[0]?.value || '';
    }
  } catch (error) {
    if (ticket === generation && alive)
      errorText.value = requestErrorMessage(error, '读取钉钉协作状态失败');
  } finally {
    if (ticket === generation) {
      loading.value = false;
      scheduleRefresh();
    }
  }
}
async function show() {
  open.value = true;
  page.value = 1;
  success.value = '';
  await load(true);
}
async function save() {
  if (busy.value || loading.value) return;
  busy.value = true;
  errorText.value = '';
  success.value = '';
  try {
    await api.save(props.res, { ...form });
    await load(true);
    success.value =
      '配置已保存，后台通常在下一分钟开始建群或同步；请点击刷新查看实际结果。';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存配置失败');
  } finally {
    busy.value = false;
  }
}
async function retry(id?: Id) {
  if (!view.value || busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.retry(props.res, view.value.revision, id);
    await load();
    success.value = '已登记重试，等待后台任务处理。';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '重试失败，请刷新核对');
  } finally {
    busy.value = false;
  }
}
function changePage(value: { current?: number }) {
  page.value = value.current || 1;
  void load();
}
onBeforeUnmount(() => {
  alive = false;
  generation++;
  if (poll) clearTimeout(poll);
});
</script>
<template>
  <Button @click="show">钉钉协作</Button>
  <Modal
    v-model:open="open"
    :title="`${name} · 钉钉协作群`"
    :width="900"
    :z-index="1060"
    :footer="null"
    :mask-closable="!busy"
    :closable="!busy"
    :styles="{ body: { maxHeight: '78vh', overflowY: 'auto' } }"
  >
    <Alert
      v-if="errorText"
      type="error"
      :message="errorText"
      show-icon
      class="mb-3"
    /><Alert v-if="success" type="success" :message="success" class="mb-3" />
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <Tag>
          {{
            view?.enabled
              ? labels[view.state]
              : view?.configured
                ? '已暂停'
                : '尚未配置'
          }}
</Tag><span v-if="view?.group_created">本剧协作群已创建，所有版本共用</span>
      </div>
      <Button :loading="loading" :disabled="busy" @click="load(false)">
        刷新群与通知状态
      </Button>
    </div>
    <Alert
      v-if="view?.error"
      type="warning"
      :message="view.error"
      show-icon
      class="mb-3"
    />
    <Alert
      v-if="view && !view.can_manage && !view.configured"
      message="请作品负责人在此配置钉钉应用与群模板，启用本剧自动协作群。"
      type="info"
      class="mb-3"
    />
    <section v-if="view?.can_manage">
      <Alert
        type="info"
        show-icon
        class="mb-4"
        message="首次配置：选择已有企业内部应用，填写已发布的场景群模板和企业机器人编码。应用需具备钉钉群基础信息管理权限，群主在应用可见范围内，并在群模板中安装该机器人。后台会按本剧协作者自动建群、加人并发送审核通知。"
      />
      <Form layout="vertical" class="dingtalk-config">
        <FormItem label="钉钉企业内部应用">
          <Select
            v-model:value="form.app_key"
            :options="apps"
            :disabled="locked || busy"
            placeholder="选择系统已配置的钉钉应用"
          />
        </FormItem>
        <FormItem label="群主">
          <Select
            v-model:value="form.owner_uid"
            :options="owners"
            :disabled="locked || busy"
            placeholder="选择负责人或本剧协作者"
          />
        </FormItem>
        <FormItem label="群名称">
          <Input
            v-model:value="form.title"
            :maxlength="30"
            :disabled="locked || busy"
          />
        </FormItem>
        <FormItem label="场景群模板 ID">
          <Input
            v-model:value="form.template_id"
            :disabled="locked || busy"
            placeholder="从钉钉开发者后台 · 场景群 · 群模板复制"
          />
        </FormItem>
        <FormItem label="企业机器人编码">
          <Input
            v-model:value="form.robot_code"
            :disabled="busy"
            placeholder="群模板中已安装的企业机器人 robotCode"
          />
        </FormItem>
        <FormItem label="自动建群、成员同步与审核通知">
          <Switch
            v-model:checked="form.enabled"
            :disabled="busy"
            aria-label="启用自动钉钉协作"
          />
          <p class="mt-2 text-xs text-muted-foreground">
            暂停保留现有群和待发记录；暂停期间不新增通知。
          </p>
        </FormItem>
      </Form>
      <p v-if="locked" class="mb-3 text-sm text-muted-foreground">
        已发起建群，应用、模板、群主和群名保持固定以避免重复建群。可修复应用授权、机器人配置后重试。
      </p>
      <div class="mb-5 flex flex-wrap gap-2">
        <Button
          type="primary"
          :loading="busy"
          :disabled="
            loading ||
            !form.app_key ||
            !form.template_id.trim() ||
            !form.robot_code.trim() ||
            !form.title.trim() ||
            !form.owner_uid
          "
          @click="save"
        >
          {{ view.configured ? '保存配置' : '启用并自动建群' }}
</Button><Button
          v-if="view.configured"
          :disabled="
            busy || loading || !view.enabled || view.state === 'running'
          "
          @click="retry()"
        >
          重试建群 / 成员同步
        </Button>
        <Button
          v-if="view.configured"
          :disabled="busy || loading"
          @click="load(true)"
        >
          重新读取配置
        </Button>
      </div>
    </section>
    <p v-if="view" class="mb-3">
      通知待发 {{ view.pending_count }} 条 · 结果待核对
      {{ view.uncertain_count }} 条
    </p>
    <Table
      v-if="view"
      :loading="loading"
      :data-source="view.deliveries"
      row-key="id"
      :pagination="{
        current: page,
        pageSize: 10,
        total: Number(view.delivery_total),
        showSizeChanger: false,
      }"
      :scroll="{ x: 600 }"
      :columns="[
        { title: '审核动态', dataIndex: 'content' },
        { title: '发送状态', key: 'state', width: 130 },
        { title: '结果 / 操作', key: 'result', width: 230 },
      ]"
      @change="changePage"
    >
      <template #emptyText>暂无通知，启用后新的审核动态会在这里显示。</template>
      <template #bodyCell="{ column, record }">
        <Tag
          v-if="column.key === 'state'"
          :color="
            record.state === 'sent'
              ? 'green'
              : record.state === 'uncertain'
                ? 'orange'
                : 'blue'
          "
        >
          {{ messageLabels[record.state as keyof typeof messageLabels] }}
        </Tag>
        <div v-if="column.key === 'result'">
          <p>{{ record.error }}</p>
          <Popconfirm
            v-if="record.state === 'uncertain' && view.can_manage"
            title="请先核对钉钉群记录。继续重试可能重复发送，确认群内未收到该通知？"
            @confirm="retry(record.id)"
          >
            <Button
              size="small"
              :disabled="busy || !view.enabled || view.state === 'running'"
            >
              核对后重新发送
            </Button>
          </Popconfirm>
        </div>
      </template>
    </Table>
    <p class="mt-4 text-sm text-muted-foreground">
      新增协作者自动同步；未绑定该企业钉钉账号会显示原因。群中手动添加的人不会被自动移除。交片、建议处理、视频替换、定版和上架通知在审核保存成功后后台投递。
    </p>
  </Modal>
</template>
<style scoped>
.dingtalk-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 20px;
}

@media (max-width: 650px) {
  .dingtalk-config {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
