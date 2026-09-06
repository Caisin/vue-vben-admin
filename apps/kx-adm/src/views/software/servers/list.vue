<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ServerWrite,
  SoftwareInstallation,
  SoftwareServer,
} from '#/api/software';

import { nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Drawer,
  Empty,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Segmented,
  Select,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { SoftwareApi } from '#/api/software';
import { CredentialSelect } from '#/components/credential';

import DetectSoftware from '../installations/detect-software.vue';
import { useColumns, useGridFormSchema, useInstallationColumns } from './data';

const saving = ref(false);
const open = ref(false);
const editing = ref<SoftwareServer>();
const distributionServer = ref<SoftwareServer>();
const distributionLoading = ref(false);
const viewMode = ref('cards');
const cardRows = ref<SoftwareServer[]>([]);
const cardPage = ref(1);
const cardTotal = ref(0);
const cardKeyword = ref('');
const cardLoading = ref(false);
const ServerIcon = createIconifyIcon('lucide:server');
let cardRequest = 0;
async function loadCards() {
  const request = ++cardRequest;
  cardLoading.value = true;
  try {
    const result = await SoftwareApi.servers({
      page: cardPage.value,
      size: 12,
      keyword: cardKeyword.value || undefined,
    });
    if (request === cardRequest) {
      cardRows.value = result.items;
      cardTotal.value = result.total;
    }
  } finally {
    if (request === cardRequest) cardLoading.value = false;
  }
}
onMounted(loadCards);
const form = reactive<ServerWrite>({
  access_kind: 'local',
  code: '',
  credential_code: '',
  host: '',
  name: '',
  port: 0,
  state: 'enabled',
});

const [Grid, gridApi] = useVbenVxeGrid<SoftwareServer>({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          SoftwareApi.servers({
            ...formValues,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SoftwareServer>,
});

const [InstallationGrid, installationGridApi] =
  useVbenVxeGrid<SoftwareInstallation>({
    gridOptions: {
      columns: useInstallationColumns(),
      height: 520,
      pagerConfig: { enabled: false },
      rowConfig: { keyField: 'id' },
      toolbarConfig: {
        custom: false,
        export: false,
        refresh: false,
        search: false,
        zoom: false,
      },
    } as VxeTableGridOptions<SoftwareInstallation>,
  });

function edit(row?: SoftwareServer) {
  editing.value = row;
  Object.assign(
    form,
    row
      ? {
          access_kind: row.access_kind,
          code: row.code,
          credential_code: row.credential_code,
          expected_version: row.version,
          host: row.host,
          host_key_fingerprint: row.host_key_fingerprint,
          name: row.name,
          port: row.port,
          state: row.state,
        }
      : {
          access_kind: 'local',
          code: '',
          credential_code: '',
          expected_version: undefined,
          host: '',
          host_key_fingerprint: '',
          name: '',
          port: 0,
          state: 'enabled',
        },
  );
  open.value = true;
}

async function save() {
  saving.value = true;
  try {
    await (editing.value
      ? SoftwareApi.updateServer(editing.value.id, form)
      : SoftwareApi.createServer(form));
    open.value = false;
    message.success('服务器已保存');
    await gridApi.query();
    await loadCards();
  } finally {
    saving.value = false;
  }
}

function changeAccessKind(value: ServerWrite['access_kind']) {
  if (value === 'local') {
    form.host = '';
    form.port = 0;
    form.credential_code = '';
    form.host_key_fingerprint = '';
  } else if (form.port === 0) {
    form.port = 22;
  }
}

async function probe(row: SoftwareServer, trustHostKey = false) {
  const result = await SoftwareApi.probeServer(row.id, trustHostKey);
  if (!result.trusted) {
    Modal.confirm({
      content: result.host_key_fingerprint,
      okText: '信任并保存',
      title: '确认主机密钥指纹',
      onOk: () => probe(row, true),
    });
    return;
  }
  message.success(
    `${row.access_kind === 'local' ? '本机环境' : '连接'}探测成功：${result.os}/${result.arch}，运行用户 ${result.run_user}`,
  );
  await gridApi.query();
  await loadCards();
}

async function showInstallations(row: SoftwareServer) {
  distributionServer.value = row;
  distributionLoading.value = true;
  try {
    const page = await SoftwareApi.serverInstallations(row.id);
    await nextTick();
    await installationGridApi.grid.reloadData(page.items);
  } finally {
    distributionLoading.value = false;
  }
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="服务器管理"
  >
    <div class="software-card-toolbar">
      <Segmented
        v-model:value="viewMode"
        :options="[
          { label: '卡片', value: 'cards' },
          { label: '表格', value: 'table' },
        ]"
        aria-label="服务器展示方式"
      />
      <template v-if="viewMode === 'cards'">
        <Input.Search
          v-model:value="cardKeyword"
          class="max-w-80"
          placeholder="搜索服务器"
          @search="
            cardPage = 1;
            loadCards();
          "
        />
        <Button
          v-access:code="'software:server:edit'"
          type="primary"
          @click="edit()"
        >
          <Plus class="size-4" />新增服务器
        </Button>
      </template>
    </div>
    <div
      v-if="viewMode === 'cards'"
      class="software-card-grid"
      :aria-busy="cardLoading"
    >
      <article
        v-for="row in cardRows"
        :key="row.id"
        class="software-resource-card"
      >
        <header>
          <ServerIcon class="size-8 text-emerald-600" />
          <div class="min-w-0 flex-1">
            <h3>{{ row.name }}</h3>
            <div class="resource-code">{{ row.code }}</div>
          </div>
          <Tag :color="row.state === 'enabled' ? 'success' : 'default'">
            {{ row.state === 'enabled' ? '启用' : '停用' }}
          </Tag>
        </header>
        <dl>
          <dt>连接</dt>
          <dd>
            {{
              row.access_kind === 'local' ? '本机' : `${row.host}:${row.port}`
            }}
          </dd>
          <dt>平台</dt>
          <dd>{{ row.os ? `${row.os} / ${row.arch}` : '未探测' }}</dd>
          <dt>服务管理</dt>
          <dd>{{ row.service_manager || '-' }}</dd>
          <dt>连接校验</dt>
          <dd>
            {{
              row.access_kind === 'local'
                ? '本地执行'
                : row.host_key_fingerprint
                  ? '指纹已确认'
                  : '待确认指纹'
            }}
          </dd>
        </dl>
        <footer>
          <Button
            v-access:code="'software:server:probe'"
            size="small"
            @click="probe(row)"
          >
            连接测试
</Button><Button size="small" @click="showInstallations(row)">已装应用</Button><Button
            v-access:code="'software:server:edit'"
            size="small"
            @click="edit(row)"
          >
            编辑
          </Button>
        </footer>
      </article>
      <Empty v-if="!cardLoading && !cardRows.length" description="暂无服务器" />
    </div>
    <div v-if="viewMode === 'cards'" class="software-card-pagination">
      <Pagination
        :current="cardPage"
        :page-size="12"
        :total="cardTotal"
        :show-size-changer="false"
        @change="
          cardPage = $event;
          loadCards();
        "
      />
    </div>
    <Grid
      v-show="viewMode === 'table'"
      class="management-grid"
      table-title="服务器管理"
    >
      <template #toolbar-tools>
        <Button
          v-access:code="'software:server:edit'"
          type="primary"
          @click="edit()"
        >
          <Plus class="size-5" />
          新增服务器
        </Button>
      </template>
      <template #server="{ row }">
        <div class="font-medium">{{ row.name }}</div>
        <div class="text-xs text-muted-foreground">{{ row.code }}</div>
      </template>
      <template #host="{ row }">
        <template v-if="row.access_kind === 'local'">
          <Tag color="processing">本机</Tag>
          当前系统
        </template>
        <template v-else>{{ row.host }}:{{ row.port }}</template>
      </template>
      <template #platform="{ row }">
        {{ row.os ? `${row.os} ${row.arch}` : '未探测' }}
      </template>
      <template #state="{ row }">
        <Tag :color="row.state === 'enabled' ? 'success' : 'default'">
          {{ row.state === 'enabled' ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              auth: ['software:server:probe'],
              icon: 'lucide:plug-zap',
              onClick: () => probe(row),
              tooltip: row.access_kind === 'local' ? '环境探测' : '连接测试',
            },
            {
              icon: 'lucide:package-open',
              onClick: () => showInstallations(row),
              tooltip: '已装应用',
            },
          ]"
          :dropdown-actions="[
            {
              auth: ['software:server:edit'],
              icon: 'lucide:edit',
              onClick: () => edit(row),
              text: '编辑',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      :title="editing ? '编辑服务器' : '新增服务器'"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="编码" required>
          <Input v-model:value="form.code" :disabled="Boolean(editing)" />
        </FormItem>
        <FormItem label="名称" required>
          <Input v-model:value="form.name" />
        </FormItem>
        <FormItem label="连接方式" required>
          <Select
            v-model:value="form.access_kind"
            :options="[
              { label: '本机', value: 'local' },
              { label: 'SSH', value: 'ssh' },
            ]"
            @change="changeAccessKind"
          />
        </FormItem>
        <div
          v-if="form.access_kind === 'ssh'"
          class="grid grid-cols-[1fr_120px] gap-3"
        >
          <FormItem label="主机" required>
            <Input v-model:value="form.host" />
          </FormItem>
          <FormItem label="SSH 端口" required>
            <InputNumber
              v-model:value="form.port"
              class="w-full"
              :max="65535"
              :min="1"
            />
          </FormItem>
        </div>
        <FormItem v-if="form.access_kind === 'ssh'" label="SSH 凭证" required>
          <CredentialSelect
            v-model="form.credential_code"
            kind="ssh_key"
            placeholder="选择 active SSH 凭证"
          />
        </FormItem>
        <FormItem v-else label="执行身份">
          <Input disabled value="后端进程用户" />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="form.state"
            :options="[
              { label: '启用', value: 'enabled' },
              { label: '停用', value: 'disabled' },
            ]"
          />
        </FormItem>
      </Form>
    </Modal>

    <Drawer
      :loading="distributionLoading"
      :open="Boolean(distributionServer)"
      :title="`${distributionServer?.name ?? ''} · 已装应用`"
      :size="820"
      @close="distributionServer = undefined"
    >
      <div v-access:code="'software:server:probe'" class="mb-5">
        <DetectSoftware
          v-if="distributionServer"
          :server-id="distributionServer.id"
        />
      </div>
      <InstallationGrid table-title="已装应用">
        <template #application="{ row }">
          <div class="font-medium">{{ row.application_name }}</div>
          <div class="text-xs text-muted-foreground">
            {{ row.application_code }}
          </div>
        </template>
        <template #version="{ row }">
          {{ row.observed_version || '未安装' }}
        </template>
      </InstallationGrid>
    </Drawer>
  </Page>
</template>

<style src="../resource-cards.css"></style>
