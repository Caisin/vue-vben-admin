<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DingtalkAppOption,
  DingtalkCustomRobotCfg,
  DingtalkCustomRobotWrite,
  DingtalkGroupBotCfg,
  DingtalkGroupBotWrite,
  DingtalkKnowledgeTargetCfg,
  DingtalkKnowledgeTargetStatus,
  DingtalkKnowledgeTargetWrite,
} from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { ExternalLink, Eye, Plus, RotateCw } from '@vben/icons';

import {
  Form as AForm,
  Button,
  FormItem,
  Input,
  message,
  Select,
  Space,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
  TreeSelect,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DingtalkNotifyApi } from '#/api/param/dingtalk-notify';
import { CredentialSelect } from '#/components/credential';
import { ConfigGuide, FieldHelp } from '#/components/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  customRobotGuide,
  DINGTALK_OPEN_CONVERSATION_ID_DOC,
  groupRobotGuide,
  knowledgeTargetGuide,
} from '../config-guides';
import {
  customRobotColumns,
  groupBotColumns,
  knowledgeTargetColumns,
  knowledgeTargetStatusOptions,
  useCustomFormSchema,
  useGroupFormSchema,
  useKnowledgeFormSchema,
} from './data';
import { useKnowledgeTargetOptions } from './knowledge-target-options';
import CustomRobotReveal from './modules/custom-robot-reveal.vue';
import PopupDrawer from './modules/popup-drawer.vue';

type ActiveTab = 'custom' | 'group' | 'knowledge';
type FormKind = 'custom' | 'group' | 'knowledge';

const activeTab = ref<ActiveTab>('custom');
const route = useRoute();
const router = useRouter();
const apps = ref<DingtalkAppOption[]>([]);
const appsLoading = ref(false);
const drawerOpen = ref(false);
const drawerSaving = ref(false);
const formKind = ref<FormKind>('custom');
const editingId = ref<number | string>();

const groupForm = reactive<DingtalkGroupBotWrite>({
  app_key: '',
  bot_code: '',
  bot_name: '',
  open_conversation_id: '',
  robot_code: '',
});
const customForm = reactive<DingtalkCustomRobotWrite>({
  keyword: null,
  open_conversation_id: '',
  robot_code: '',
  robot_name: '',
  secret_credential_code: '',
  webhook_credential_code: '',
});
const knowledgeForm = reactive<DingtalkKnowledgeTargetWrite>({
  app_key: '',
  operator_union_id: '',
  parent_node_id: '',
  parent_node_path: '',
  status: 'enabled',
  target_code: '',
  target_name: '',
  workspace_id: '',
});
const {
  loadTreeChildren: loadKnowledgeTreeChildren,
  loadTreeRoots: loadKnowledgeTreeRoots,
  onAppChange: onKnowledgeAppChange,
  onOperatorChange: onKnowledgeOperatorChange,
  operatorLoading: knowledgeOperatorLoading,
  operatorOptions: knowledgeOperatorOptions,
  prepare: prepareKnowledgeTargetOptions,
  refreshOperators: refreshKnowledgeOperators,
  searchOperators: searchKnowledgeOperators,
  selectTreeNode: selectKnowledgeTreeNode,
  treeLoading: knowledgeTreeLoading,
  treeNodes: knowledgeTreeNodes,
  treeValue: knowledgeTreeValue,
} = useKnowledgeTargetOptions({ editingId, form: knowledgeForm });

const appOptions = computed(() =>
  apps.value.map((item) => ({
    label: `${item.app_name} (${item.app_key})`,
    value: item.app_key,
  })),
);
const currentConfigGuide = computed(() => {
  if (formKind.value === 'custom') return customRobotGuide;
  if (formKind.value === 'group') return groupRobotGuide;
  return knowledgeTargetGuide;
});
const groupSortFields = [
  'id',
  'bot_code',
  'bot_name',
  'app_key',
  'open_conversation_id',
  'created_at',
  'updated_at',
];
const customSortFields = [
  'id',
  'robot_code',
  'robot_name',
  'created_at',
  'updated_at',
];
const knowledgeSortFields = [
  'id',
  'target_code',
  'target_name',
  'app_key',
  'workspace_id',
  'last_verified_at',
  'created_at',
  'updated_at',
];

const [GroupGrid, groupGridApi] = useVbenVxeGrid<DingtalkGroupBotCfg>({
  formOptions: { schema: useGroupFormSchema([]), submitOnChange: true },
  gridOptions: {
    columns: groupBotColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await DingtalkNotifyApi.group_bots({
            app_key: String(formValues.app_key ?? '') || undefined,
            bot_code_prefix:
              String(formValues.bot_code_prefix ?? '').trim() || undefined,
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
  } as VxeTableGridOptions<DingtalkGroupBotCfg>,
});

const [CustomGrid, customGridApi] = useVbenVxeGrid<DingtalkCustomRobotCfg>({
  formOptions: { schema: useCustomFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: customRobotColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await DingtalkNotifyApi.custom_robots({
            page: page.currentPage,
            robot_code_prefix:
              String(formValues.robot_code_prefix ?? '').trim() || undefined,
            size: page.pageSize,
            ...vxeSortParams(params, customSortFields),
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
  } as VxeTableGridOptions<DingtalkCustomRobotCfg>,
});

const [CustomRobotRevealModal, customRobotRevealModalApi] = useVbenModal({
  connectedComponent: CustomRobotReveal,
  destroyOnClose: false,
});

const [KnowledgeGrid, knowledgeGridApi] =
  useVbenVxeGrid<DingtalkKnowledgeTargetCfg>({
    formOptions: { schema: useKnowledgeFormSchema([]), submitOnChange: true },
    gridOptions: {
      columns: knowledgeTargetColumns(onKnowledgeStatusChange),
      height: 'auto',
      pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
      proxyConfig: {
        ajax: {
          query: async (params, formValues) => {
            const { page } = params;
            const result = await DingtalkNotifyApi.knowledge_targets({
              app_key: String(formValues.app_key ?? '') || undefined,
              page: page.currentPage,
              size: page.pageSize,
              target_code_prefix:
                String(formValues.target_code_prefix ?? '').trim() || undefined,
              status: formValues.status as
                | DingtalkKnowledgeTargetStatus
                | undefined,
              ...vxeSortParams(params, knowledgeSortFields),
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
    } as VxeTableGridOptions<DingtalkKnowledgeTargetCfg>,
  });

async function loadApps() {
  appsLoading.value = true;
  try {
    apps.value = await DingtalkNotifyApi.apps();
    await Promise.all([
      groupGridApi.formApi.updateSchema(useGroupFormSchema(appOptions.value)),
      knowledgeGridApi.formApi.updateSchema(
        useKnowledgeFormSchema(appOptions.value),
      ),
    ]);
  } finally {
    appsLoading.value = false;
  }
}

onMounted(async () => {
  const requestedTab = String(route.query.tab ?? '');
  if (
    requestedTab === 'custom' ||
    requestedTab === 'group' ||
    requestedTab === 'knowledge'
  ) {
    activeTab.value = requestedTab;
  }
  await loadApps();
});

function openDingtalkAppManagement() {
  const href = router.resolve({
    path: '/param/login-apps',
    query: { tab: 'dingtalk' },
  }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
}

async function refreshDingtalkApps() {
  await loadApps();
  message.success('钉钉应用列表已刷新');
}

function openOrgSyncManagement() {
  const href = router.resolve({ path: '/system/org-sync' }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
}

function openGroup(row?: DingtalkGroupBotCfg) {
  formKind.value = 'group';
  editingId.value = row?.id;
  Object.assign(groupForm, {
    app_key: row?.app_key ?? apps.value[0]?.app_key ?? '',
    bot_code: row?.bot_code ?? '',
    bot_name: row?.bot_name ?? '',
    open_conversation_id: row?.open_conversation_id ?? '',
    robot_code: row?.robot_code ?? '',
  });
  drawerOpen.value = true;
}
function openCustom(row?: DingtalkCustomRobotCfg) {
  formKind.value = 'custom';
  editingId.value = row?.id;
  Object.assign(customForm, {
    keyword: row?.keyword ?? null,
    open_conversation_id: row?.open_conversation_id ?? '',
    robot_code: row?.robot_code ?? '',
    robot_name: row?.robot_name ?? '',
    secret_credential_code: row?.secret_credential_code ?? '',
    webhook_credential_code: row?.webhook_credential_code ?? '',
  });
  drawerOpen.value = true;
}
function openCustomReveal(row: DingtalkCustomRobotCfg) {
  customRobotRevealModalApi.setData(row).open();
}
function openKnowledge(row?: DingtalkKnowledgeTargetCfg) {
  formKind.value = 'knowledge';
  editingId.value = row?.id;
  Object.assign(knowledgeForm, {
    app_key: row?.app_key ?? apps.value[0]?.app_key ?? '',
    operator_union_id: row?.operator_union_id ?? '',
    parent_node_id: row?.parent_node_id ?? '',
    parent_node_path: row?.parent_node_path ?? '',
    status: row?.status ?? 'enabled',
    target_code: row?.target_code ?? '',
    target_name: row?.target_name ?? '',
    workspace_id: row?.workspace_id ?? '',
  });
  prepareKnowledgeTargetOptions(row);
  drawerOpen.value = true;
}
async function save() {
  drawerSaving.value = true;
  try {
    if (formKind.value === 'group') {
      const payload = trimGroup();
      editingId.value
        ? await DingtalkNotifyApi.update_group_bot(editingId.value, payload)
        : await DingtalkNotifyApi.create_group_bot(payload);
      await groupGridApi.reload();
    } else if (formKind.value === 'custom') {
      const payload = trimCustom();
      editingId.value
        ? await DingtalkNotifyApi.update_custom_robot(editingId.value, payload)
        : await DingtalkNotifyApi.create_custom_robot(payload);
      await customGridApi.reload();
    } else {
      const payload = trimKnowledge();
      editingId.value
        ? await DingtalkNotifyApi.update_knowledge_target(
            editingId.value,
            payload,
          )
        : await DingtalkNotifyApi.create_knowledge_target(payload);
      await knowledgeGridApi.reload();
    }
    message.success('钉钉推送配置已保存');
    drawerOpen.value = false;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '钉钉推送配置无效');
  } finally {
    drawerSaving.value = false;
  }
}
function trimGroup(): DingtalkGroupBotWrite {
  return {
    app_key: groupForm.app_key.trim(),
    bot_code: groupForm.bot_code.trim(),
    bot_name: groupForm.bot_name.trim(),
    open_conversation_id: groupForm.open_conversation_id.trim(),
    robot_code: groupForm.robot_code.trim(),
  };
}
function trimCustom(): DingtalkCustomRobotWrite {
  const webhookCredentialCode = customForm.webhook_credential_code.trim();
  if (!webhookCredentialCode && !editingId.value) {
    throw new Error('请选择钉钉群机器人 Webhook 凭证');
  }
  return {
    keyword: customForm.keyword?.trim() || null,
    open_conversation_id: customForm.open_conversation_id.trim(),
    robot_code: customForm.robot_code.trim(),
    robot_name: customForm.robot_name.trim(),
    secret_credential_code: customForm.secret_credential_code?.trim() || '',
    webhook_credential_code: webhookCredentialCode,
  };
}
function trimKnowledge(): DingtalkKnowledgeTargetWrite {
  return {
    app_key: knowledgeForm.app_key.trim(),
    operator_union_id: knowledgeForm.operator_union_id.trim(),
    parent_node_id: knowledgeForm.parent_node_id.trim(),
    parent_node_path: knowledgeForm.parent_node_path.trim(),
    status: knowledgeForm.status,
    target_code: knowledgeForm.target_code.trim(),
    target_name: knowledgeForm.target_name.trim(),
    workspace_id: knowledgeForm.workspace_id.trim(),
  };
}
async function onKnowledgeStatusChange(
  status: DingtalkKnowledgeTargetStatus,
  row: DingtalkKnowledgeTargetCfg,
) {
  await DingtalkNotifyApi.update_knowledge_target(row.id, {
    app_key: row.app_key,
    operator_union_id: row.operator_union_id,
    parent_node_id: row.parent_node_id,
    parent_node_path: row.parent_node_path,
    status,
    target_code: row.target_code,
    target_name: row.target_name,
    workspace_id: row.workspace_id,
  });
  return true;
}
async function verifyKnowledge(row: DingtalkKnowledgeTargetCfg) {
  await DingtalkNotifyApi.verify_knowledge_target(row.id);
  message.success('知识库目标已校验');
  await knowledgeGridApi.reload();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>钉钉推送配置</h1>
        <p>维护机器人、知识库目标及其引用的钉钉应用</p>
      </div>
      <Space size="small">
        <Button size="small" type="link" @click="openDingtalkAppManagement">
          <template #icon><ExternalLink /></template>
          维护钉钉应用
        </Button>
        <Tooltip title="刷新钉钉应用列表">
          <Button
            aria-label="刷新钉钉应用列表"
            size="small"
            type="text"
            :loading="appsLoading"
            @click="refreshDingtalkApps"
          >
            <template #icon><RotateCw /></template>
          </Button>
        </Tooltip>
      </Space>
    </header>
    <Tabs v-model:active-key="activeTab" destroy-inactive-tab-pane>
      <TabPane key="custom" tab="自定义群机器人">
        <ConfigGuide v-bind="customRobotGuide" />
        <CustomGrid class="management-grid" table-title="钉钉自定义群机器人">
          <template #toolbar-tools>
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              type="primary"
              @click="openCustom()"
            >
              <template #icon><Plus /></template>创建自定义机器人
            </Button>
          </template>
          <template #customRobotName="{ row }">
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              class="px-0"
              type="link"
              @click.stop="openCustom(row)"
            >
              {{ row.robot_name }}
            </Button>
          </template>
          <template #secretConfigured="{ row }">
            <Space>
              <Tag :color="row.secret_configured ? 'success' : 'default'">
                {{ row.secret_configured ? '已配置' : '未配置' }}
              </Tag>
              <Button
                v-access:code="'notify:dingtalk-provider:reveal'"
                size="small"
                title="查看机器人隐私配置"
                type="text"
                @click.stop="openCustomReveal(row)"
              >
                <template #icon><Eye /></template>
              </Button>
            </Space>
          </template>
          <template #updatedAt="{ row }">
            {{ Times.formatOptionalUnix(row.updated_at) }}
          </template>
        </CustomGrid>
      </TabPane>
      <TabPane key="group" tab="企业群机器人">
        <ConfigGuide v-bind="groupRobotGuide" />
        <GroupGrid class="management-grid" table-title="钉钉企业群机器人">
          <template #toolbar-tools>
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              type="primary"
              @click="openGroup()"
            >
              <template #icon><Plus /></template>创建企业群机器人
            </Button>
          </template>
          <template #groupBotName="{ row }">
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              class="px-0"
              type="link"
              @click.stop="openGroup(row)"
            >
              {{ row.bot_name }}
            </Button>
          </template>
          <template #updatedAt="{ row }">
            {{ Times.formatOptionalUnix(row.updated_at) }}
          </template>
        </GroupGrid>
      </TabPane>
      <TabPane key="knowledge" tab="知识库目标">
        <ConfigGuide v-bind="knowledgeTargetGuide" />
        <KnowledgeGrid class="management-grid" table-title="钉钉知识库目标">
          <template #toolbar-tools>
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              type="primary"
              @click="openKnowledge()"
            >
              <template #icon><Plus /></template>创建知识库目标
            </Button>
          </template>
          <template #knowledgeTargetName="{ row }">
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              class="px-0"
              type="link"
              @click.stop="openKnowledge(row)"
            >
              {{ row.target_name }}
            </Button>
          </template>
          <template #lastVerifiedAt="{ row }">
            {{ Times.formatOptionalUnix(row.last_verified_at) }}
          </template>
          <template #updatedAt="{ row }">
            {{ Times.formatOptionalUnix(row.updated_at) }}
          </template>
          <template #knowledgeTargetOperation="{ row }">
            <Button
              v-access:code="'notify:dingtalk-provider:write'"
              size="small"
              type="link"
              @click.stop="verifyKnowledge(row)"
            >
              校验
            </Button>
          </template>
        </KnowledgeGrid>
      </TabPane>
    </Tabs>

    <PopupDrawer
      v-model:open="drawerOpen"
      destroy-on-close
      :title="
        formKind === 'group'
          ? '企业群机器人配置'
          : formKind === 'custom'
            ? '自定义群机器人配置'
            : '钉钉知识库目标配置'
      "
      width="760"
    >
      <AForm layout="vertical">
        <ConfigGuide v-bind="currentConfigGuide" />
        <div v-if="formKind === 'group'" class="form-grid">
          <FormItem>
            <template #label>
              <FieldHelp
                help="供消息通道 provider_code 引用的稳定编码，创建后不要随名称修改。"
                label="配置编码"
              />
            </template>
            <Input v-model:value="groupForm.bot_code" />
          </FormItem>
          <FormItem label="显示名称">
            <Input v-model:value="groupForm.bot_name" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="选择提供 access token 和机器人身份的已启用钉钉应用。"
                label="钉钉应用"
              />
            </template>
            <div class="compact-row">
              <Select
                v-model:value="groupForm.app_key"
                class="flex-1"
                :loading="appsLoading"
                :options="appOptions"
              />
              <Tooltip title="维护钉钉应用">
                <Button
                  aria-label="维护钉钉应用"
                  size="small"
                  type="text"
                  @click="openDingtalkAppManagement"
                >
                  <template #icon><ExternalLink /></template>
                </Button>
              </Tooltip>
              <Tooltip title="刷新钉钉应用列表">
                <Button
                  aria-label="刷新钉钉应用列表"
                  size="small"
                  type="text"
                  :loading="appsLoading"
                  @click="refreshDingtalkApps"
                >
                  <template #icon><RotateCw /></template>
                </Button>
              </Tooltip>
            </div>
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="钉钉开放平台中企业机器人对应的 robot_code。"
                label="机器人编码"
              />
            </template>
            <Input v-model:value="groupForm.robot_code" />
          </FormItem>
          <FormItem class="full-row">
            <template #label>
              <FieldHelp
                help="目标群的 open_conversation_id；群内 @企业机器人后可从消息回调的 conversationId 获取，也可按官方文档由 chatId 转换。"
                label="群会话 ID"
                link-label="查看群会话 ID 获取文档"
                :link-url="DINGTALK_OPEN_CONVERSATION_ID_DOC"
              />
            </template>
            <Input v-model:value="groupForm.open_conversation_id" />
          </FormItem>
        </div>
        <div v-else-if="formKind === 'custom'" class="form-grid">
          <FormItem>
            <template #label>
              <FieldHelp
                help="供消息通道 provider_code 引用的稳定编码，创建后不要随名称修改。"
                label="配置编码"
              />
            </template>
            <Input v-model:value="customForm.robot_code" />
          </FormItem>
          <FormItem label="显示名称">
            <Input v-model:value="customForm.robot_name" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="可选。填写目标群的 open_conversation_id 后自动给周报文档授予群可编辑权限；留空时仍发送周报通知但跳过授权。钉钉不提供普通内部群全量列表，请按官方文档获取。"
                label="群会话 ID"
                link-label="查看群会话 ID 获取文档"
                :link-url="DINGTALK_OPEN_CONVERSATION_ID_DOC"
              />
            </template>
            <Input
              v-model:value="customForm.open_conversation_id"
              placeholder="选填；留空时跳过群文档授权"
            />
          </FormItem>
          <FormItem class="full-row">
            <template #label>
              <FieldHelp
                help="选择保存钉钉机器人 access_token 的密码凭证。"
                label="Webhook 凭证"
              />
            </template>
            <CredentialSelect
              v-model="customForm.webhook_credential_code"
              create-kind="password"
              kind="password"
              placeholder="选择 access_token 凭证"
              profile="generic"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="可选。选择保存 SEC 开头加签密钥的密码凭证。"
                label="加签密钥凭证"
              />
            </template>
            <CredentialSelect
              v-model="customForm.secret_credential_code"
              create-kind="password"
              kind="password"
              placeholder="选择加签密钥凭证"
              profile="generic"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="机器人启用关键字安全校验时填写，发送正文必须包含该关键字。"
                label="关键字提醒"
              />
            </template>
            <Input v-model:value="customForm.keyword" />
          </FormItem>
        </div>
        <div v-else class="form-grid">
          <FormItem>
            <template #label>
              <FieldHelp
                help="业务任务引用知识库目标时使用的稳定编码。"
                label="目标编码"
              />
            </template>
            <Input v-model:value="knowledgeForm.target_code" />
          </FormItem>
          <FormItem label="目标名称">
            <Input v-model:value="knowledgeForm.target_name" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="创建或校验在线文档时使用该应用的授权身份。"
                label="钉钉应用"
              />
            </template>
            <div class="compact-row">
              <Select
                v-model:value="knowledgeForm.app_key"
                class="flex-1"
                :loading="appsLoading"
                :options="appOptions"
                @change="(value) => onKnowledgeAppChange(String(value))"
              />
              <Tooltip title="维护钉钉应用">
                <Button
                  aria-label="维护钉钉应用"
                  size="small"
                  type="text"
                  @click="openDingtalkAppManagement"
                >
                  <template #icon><ExternalLink /></template>
                </Button>
              </Tooltip>
              <Tooltip title="刷新钉钉应用列表">
                <Button
                  aria-label="刷新钉钉应用列表"
                  size="small"
                  type="text"
                  :loading="appsLoading"
                  @click="refreshDingtalkApps"
                >
                  <template #icon><RotateCw /></template>
                </Button>
              </Tooltip>
            </div>
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="停用后业务任务不能再选择该知识库目标，但历史发布记录保留。"
                label="状态"
              />
            </template>
            <Select
              v-model:value="knowledgeForm.status"
              :options="knowledgeTargetStatusOptions"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="从所选应用最近一次组织同步的在职人员中选择；该人员必须对目标知识库和目录有创建文档权限。"
                label="操作人"
              />
            </template>
            <div class="compact-row">
              <Select
                v-model:value="knowledgeForm.operator_union_id"
                allow-clear
                class="flex-1"
                :filter-option="false"
                :loading="knowledgeOperatorLoading"
                :options="knowledgeOperatorOptions"
                placeholder="请选择或搜索在职人员"
                show-search
                @change="onKnowledgeOperatorChange"
                @search="searchKnowledgeOperators"
              />
              <Tooltip title="维护并执行组织同步">
                <Button
                  aria-label="维护并执行组织同步"
                  size="small"
                  type="text"
                  @click="openOrgSyncManagement"
                >
                  <template #icon><ExternalLink /></template>
                </Button>
              </Tooltip>
              <Tooltip title="刷新操作人列表">
                <Button
                  aria-label="刷新操作人列表"
                  size="small"
                  type="text"
                  :loading="knowledgeOperatorLoading"
                  @click="refreshKnowledgeOperators"
                >
                  <template #icon><RotateCw /></template>
                </Button>
              </Tooltip>
            </div>
          </FormItem>
          <FormItem class="full-row">
            <template #label>
              <FieldHelp
                help="知识库是根节点；展开有下级的目录会按需继续加载。根目录和任意文件夹均可作为周报文档目标。"
                label="知识库 / 目标目录"
              />
            </template>
            <div class="compact-row">
              <TreeSelect
                v-model:value="knowledgeTreeValue"
                class="flex-1"
                :dropdown-style="{ maxHeight: '420px', overflow: 'auto' }"
                :load-data="loadKnowledgeTreeChildren"
                :loading="knowledgeTreeLoading"
                placeholder="请选择知识库或目标目录"
                show-search
                :tree-data="knowledgeTreeNodes"
                tree-line
                tree-node-filter-prop="path"
                tree-node-label-prop="path"
                @select="selectKnowledgeTreeNode"
              />
              <Button
                :loading="knowledgeTreeLoading"
                @click="loadKnowledgeTreeRoots"
              >
                刷新
              </Button>
            </div>
          </FormItem>
        </div>
      </AForm>
      <template #footer>
        <Space>
          <Button @click="drawerOpen = false"> 取消 </Button>
          <Button :loading="drawerSaving" type="primary" @click="save">
            保存
          </Button>
        </Space>
      </template>
    </PopupDrawer>
    <CustomRobotRevealModal />
  </Page>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.full-row {
  grid-column: 1 / -1;
}

.compact-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.compact-row .flex-1 {
  flex: 1;
}

.webhook-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

.parse-error {
  font-size: 12px;
  color: rgb(220 38 38);
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
