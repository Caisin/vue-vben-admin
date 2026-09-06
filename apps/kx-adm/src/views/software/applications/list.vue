<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ApplicationWrite,
  SoftwareApplication,
  SoftwareInstallation,
  SoftwareVersion,
} from '#/api/software';
import type { FileInputValue } from '#/components/file-picker/file-ref';

import { nextTick, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Pagination,
  Segmented, Select, Tag,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { SoftwareApi } from '#/api/software';
import { FileUrlInput } from '#/components/file-picker';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import { normalizeArtifactFileId } from './artifact-upload';
import { customSourceFrom } from './custom-source';
import CustomSourceForm from './custom-source-form.vue';
import {
  providerOptions,
  useColumns,
  useGridFormSchema,
  useInstallationColumns,
  useVersionColumns,
} from './data';

const open = ref(false);
const saving = ref(false);
const editing = ref<SoftwareApplication>();
const detailApplication = ref<SoftwareApplication>();
const detailLoading = ref(false);
const sourceJson = ref('{}');
const customSource = ref(customSourceFrom());
const artifactOpen = ref(false);
const artifactSaving = ref(false);
const artifactVersion = ref<SoftwareVersion>();
const artifactFile = ref<FileInputValue>('');
const artifactPlatform = ref('linux');
const artifactArch = ref('x86_64');
const viewMode = ref('cards');
const cardRows = ref<SoftwareApplication[]>([]);
const cardPage = ref(1);
const cardTotal = ref(0);
const cardKeyword = ref('');
const cardLoading = ref(false);
const AppIcon = createIconifyIcon('lucide:package');
let cardRequest = 0;
async function loadCards() {
  const request = ++cardRequest; cardLoading.value = true;
  try { const result = await SoftwareApi.applications({ page:cardPage.value,size:12,keyword:cardKeyword.value || undefined });
    if(request===cardRequest){cardRows.value=result.items;cardTotal.value=result.total;}
  } finally {if(request===cardRequest)cardLoading.value=false;}
}
onMounted(loadCards);
let refreshTarget: undefined | { app: SoftwareApplication; taskId: number | string };
const refreshPolling = useTaskPolling({
  load: () => SoftwareApi.versionTask(refreshTarget?.app.id ?? '', refreshTarget?.taskId ?? ''),
  accept: async (task) => {
    if (['queued','retrying','running'].includes(task.status)) return;
    if (task.status === 'succeeded') {
      message.success('版本已刷新');
      if (refreshTarget && detailApplication.value?.id === refreshTarget.app.id) await showDetail(refreshTarget.app);
    } else message.error(task.error_message || task.message || '版本刷新失败');
  },
  done: (task) => !['queued','retrying','running'].includes(task.status),
});
const form = reactive<ApplicationWrite>({
  code: '',
  install_root: '/opt/kx',
  name: '',
  provider: 'github_release',
  source: {},
  state: 'enabled',
});

const [Grid, gridApi] = useVbenVxeGrid<SoftwareApplication>({
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
          SoftwareApi.applications({
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
  } as VxeTableGridOptions<SoftwareApplication>,
});

const [VersionGrid, versionGridApi] = useVbenVxeGrid<SoftwareVersion>({
  gridOptions: {
    columns: useVersionColumns(),
    height: 300,
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const id = detailApplication.value?.id;
          if (id === undefined) return { items: [], total: 0 };
          return SoftwareApi.versions(id, {
            page: page.currentPage,
            size: page.pageSize,
          });
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions<SoftwareVersion>,
});

const [InstallationGrid, installationGridApi] =
  useVbenVxeGrid<SoftwareInstallation>({
    gridOptions: {
      columns: useInstallationColumns(),
      height: 300,
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

function edit(row?: SoftwareApplication) {
  editing.value = row;
  Object.assign(
    form,
    row
      ? {
          application_kind: row.application_kind,
          code: row.code,
          description: row.description,
          driver_kind: row.driver_kind,
          expected_version: row.version,
          install_root: row.install_root,
          name: row.name,
          provider: row.provider,
          service_name: row.service_name,
          source: { ...row.source },
          source_kind: row.source_kind,
          state: row.state,
        }
      : {
          application_kind: 'application',
          code: '',
          description: '',
          driver_kind: 'archive_service',
          expected_version: undefined,
          install_root: '/opt/kx',
          name: '',
          provider: 'github_release',
          service_name: '',
          source: {},
          source_kind: 'github_releases',
          state: 'enabled',
        },
  );
  sourceJson.value = JSON.stringify(row?.source ?? {}, null, 2);
  customSource.value = customSourceFrom(row?.source);
  open.value = true;
}

async function save() {
  let source: Record<string, unknown>;
  if (form.provider === 'custom') {
    source = { ...customSource.value };
  } else if (['mysql', 'postgres', 'redis'].includes(form.provider)) {
    source = {};
  } else if (form.provider === 'meilisearch') {
    source = { owner: 'meilisearch', repo: 'meilisearch' };
  } else {
  try {
    const parsed = JSON.parse(sourceJson.value || '{}') as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new TypeError('source must be an object');
    }
    source = parsed as Record<string, unknown>;
    } catch {
      message.error('来源配置必须是有效的 JSON 对象');
      return;
    }
  }
  saving.value = true;
  try {
    form.source = source;
    await (editing.value
      ? SoftwareApi.updateApplication(editing.value.id, form)
      : SoftwareApi.createApplication(form));
    open.value = false;
    message.success('应用已保存');
    await gridApi.query();
    await loadCards();
  } finally {
    saving.value = false;
  }
}

function openArtifactUpload(version: SoftwareVersion) {
  artifactVersion.value = version;
  artifactFile.value = '';
  artifactPlatform.value = 'linux';
  artifactArch.value = 'x86_64';
  artifactOpen.value = true;
}

async function uploadArtifact() {
  const application = detailApplication.value;
  const version = artifactVersion.value;
  const fileId = normalizeArtifactFileId(artifactFile.value);
  if (!application || !version || !fileId) {
    message.warning('请选择已上传的版本文件');
    return;
  }
  artifactSaving.value = true;
  try {
    await SoftwareApi.uploadVersionArtifact(application.id, version.id, {
      arch: artifactArch.value,
      file_id: fileId,
      platform: artifactPlatform.value,
    });
    artifactOpen.value = false;
    message.success('上传制品已设为该平台当前安装来源');
  } catch (error) {
    message.error(requestErrorMessage(error, '平台制品登记失败，请检查文件和目标平台'));
  } finally {
    artifactSaving.value = false;
  }
}

watch(
  () => form.provider,
  (provider) => {
    if (provider === 'meilisearch') {
      sourceJson.value = JSON.stringify(
        { owner: 'meilisearch', repo: 'meilisearch' },
        null,
        2,
      );
    }
  },
);

async function refreshVersions(row: SoftwareApplication) {
  const task = await SoftwareApi.refreshVersions(row.id);
  refreshTarget = { app: row, taskId: task.id };
  message.success(`版本刷新任务 #${task.id} 已提交`);
  refreshPolling.start();
}

async function showDetail(row: SoftwareApplication) {
  detailApplication.value = row;
  detailLoading.value = true;
  try {
    const installationPage = await SoftwareApi.applicationInstallations(row.id);
    await nextTick();
    await versionGridApi.query();
    installationGridApi.setGridOptions({ data: installationPage.items });
  } finally {
    detailLoading.value = false;
  }
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="应用管理"
  >
    <div class="software-card-toolbar">
      <Segmented v-model:value="viewMode" :options="[{label:'卡片',value:'cards'},{label:'表格',value:'table'}]" aria-label="应用展示方式" />
      <template v-if="viewMode === 'cards'">
        <Input.Search v-model:value="cardKeyword" class="max-w-80" placeholder="搜索应用" @search="cardPage = 1;loadCards()" />
        <Button v-access:code="'software:application:edit'" type="primary" @click="edit()"><Plus class="size-4" />新增应用</Button>
      </template>
    </div>
    <div v-if="viewMode === 'cards'" class="software-card-grid" :aria-busy="cardLoading">
      <article v-for="row in cardRows" :key="row.id" class="software-resource-card">
        <header><AppIcon class="size-8 text-cyan-600" /><div class="min-w-0 flex-1"><h3>{{ row.name }}</h3><div class="resource-code">{{ row.code }}</div></div><Tag :color="row.state === 'enabled' ? 'success' : 'default'">{{ row.state === 'enabled' ? '启用' : '停用' }}</Tag></header>
        <dl><dt>安装实现</dt><dd>{{ providerOptions.find(item=>item.value === row.provider)?.label || row.provider }}</dd><dt>来源</dt><dd>{{ row.source_kind }}</dd><dt>默认目录</dt><dd>{{ row.install_root }}</dd><dt>说明</dt><dd>{{ row.description || '-' }}</dd></dl>
        <footer><Button v-access:code="'software:version:refresh'" size="small" @click="refreshVersions(row)">刷新版本</Button><Button size="small" @click="showDetail(row)">版本与部署</Button><Button v-access:code="'software:application:edit'" size="small" @click="edit(row)">编辑</Button></footer>
      </article>
      <Empty v-if="!cardLoading && !cardRows.length" description="暂无应用" />
    </div>
    <div v-if="viewMode === 'cards'" class="software-card-pagination"><Pagination :current="cardPage" :page-size="12" :total="cardTotal" :show-size-changer="false" @change="cardPage = $event;loadCards()" /></div>
    <Grid v-show="viewMode === 'table'" class="management-grid" table-title="应用管理">
      <template #toolbar-tools>
        <Button
          v-access:code="'software:application:edit'"
          type="primary"
          @click="edit()"
        >
          <Plus class="size-5" />
          新增应用
        </Button>
      </template>
      <template #application="{ row }">
        <div class="font-medium">{{ row.name }}</div>
        <div class="text-xs text-muted-foreground">{{ row.code }}</div>
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
              auth: ['software:version:refresh'],
              icon: 'lucide:refresh-cw',
              onClick: () => refreshVersions(row),
              tooltip: '刷新版本',
            },
            {
              icon: 'lucide:boxes',
              onClick: () => showDetail(row),
              tooltip: '版本与分布',
            },
          ]"
          :dropdown-actions="[
            {
              auth: ['software:application:edit'],
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
      :title="editing ? '编辑应用' : '新增应用'"
      centered
      :width="760"
      :styles="{ body: { maxHeight: 'calc(100dvh - 190px)', overflowY: 'auto' } }"
      @ok="save"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-3">
          <FormItem label="编码" required>
            <Input v-model:value="form.code" :disabled="Boolean(editing)" />
          </FormItem>
          <FormItem label="名称" required>
            <Input v-model:value="form.name" />
          </FormItem>
        </div>
        <FormItem label="实现">
          <Select
            v-model:value="form.provider"
            :disabled="Boolean(editing)"
            :options="providerOptions"
          />
        </FormItem>
        <Alert
          v-if="form.provider === 'meilisearch'"
          class="mb-4"
          message="版本固定从 Meilisearch 官方 GitHub Releases 获取；网络受限时可在版本详情上传对应平台二进制。"
          show-icon
          type="info"
        />
        <CustomSourceForm v-else-if="form.provider === 'custom'" v-model="customSource" />
        <FormItem v-else-if="!['mysql','postgres','redis'].includes(form.provider)" label="来源配置 JSON">
          <Input.TextArea
            v-model:value="sourceJson"
            :rows="7"
            placeholder="{&quot;owner&quot;:&quot;acme&quot;,&quot;repo&quot;:&quot;app&quot;,&quot;assets&quot;:[{&quot;platform&quot;:&quot;linux&quot;,&quot;arch&quot;:&quot;x86_64&quot;,&quot;pattern&quot;:&quot;app-{version}-linux-amd64.tar.gz&quot;}]}"
          />
        </FormItem>
        <FormItem label="安装根目录" required>
          <Input v-model:value="form.install_root" />
        </FormItem>
        <FormItem label="说明">
          <Input v-model:value="form.description" />
        </FormItem>
      </Form>
    </Modal>

    <Drawer
      :loading="detailLoading"
      :open="Boolean(detailApplication)"
      :title="`${detailApplication?.name ?? ''} · 版本与安装分布`"
      :size="920"
      @close="detailApplication = undefined"
    >
      <div class="flex flex-col gap-5">
        <VersionGrid table-title="已发现版本">
          <template #operation="{ row }">
            <Button
              v-if="['meilisearch', 'custom'].includes(detailApplication?.provider ?? '')"
              size="small"
              type="link"
              @click="openArtifactUpload(row)"
            >
              上传制品
            </Button>
          </template>
        </VersionGrid>
        <InstallationGrid table-title="服务器安装分布">
          <template #server="{ row }">
            <div class="font-medium">{{ row.server_name }}</div>
            <div class="text-xs text-muted-foreground">
              {{ row.server_code }}
            </div>
          </template>
          <template #observedVersion="{ row }">
            {{ row.observed_version || '未安装' }}
          </template>
          <template #availableVersion="{ row }">
            {{ row.available_version || '-' }}
          </template>
        </InstallationGrid>
      </div>
    </Drawer>

    <Modal
      v-model:open="artifactOpen"
      :confirm-loading="artifactSaving"
      title="上传平台制品"
      @ok="uploadArtifact"
    >
      <Form layout="vertical">
        <Alert
          class="mb-4"
          :message="`为 ${artifactVersion?.display_version ?? '-'} 登记浏览器上传文件；安装时优先使用该文件。`"
          show-icon
          type="info"
        />
        <div class="grid grid-cols-2 gap-3">
          <FormItem label="目标平台" required>
            <Select
              v-model:value="artifactPlatform"
              :options="[
                { label: 'Linux', value: 'linux' },
                { label: 'macOS', value: 'darwin' },
              ]"
            />
          </FormItem>
          <FormItem label="目标架构" required>
            <Select
              v-model:value="artifactArch"
              :options="[
                { label: 'x86_64 / AMD64', value: 'x86_64' },
                { label: 'ARM64 / AArch64', value: 'aarch64' },
              ]"
            />
          </FormItem>
        </div>
        <FormItem label="版本文件" required>
          <FileUrlInput
            v-model="artifactFile"
            button-text="选择或上传文件"
            placeholder="从文件库选择对应版本和平台的制品"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>

<style src="../resource-cards.css"></style>
