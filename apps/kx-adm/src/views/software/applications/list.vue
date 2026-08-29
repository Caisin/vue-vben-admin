<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ApplicationWrite,
  SoftwareApplication,
  SoftwareInstallation,
  SoftwareVersion,
} from '#/api/software';

import { nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
  Drawer,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { SoftwareApi } from '#/api/software';

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
  open.value = true;
}

async function save() {
  let source: Record<string, unknown>;
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
  saving.value = true;
  try {
    form.source = source;
    await (editing.value
      ? SoftwareApi.updateApplication(editing.value.id, form)
      : SoftwareApi.createApplication(form));
    open.value = false;
    message.success('应用已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function refreshVersions(row: SoftwareApplication) {
  await SoftwareApi.refreshVersions(row.id);
  message.success('版本已刷新');
  if (detailApplication.value?.id === row.id) {
    await showDetail(row);
  }
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
    <Grid class="management-grid" table-title="应用管理">
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
        <FormItem label="来源配置 JSON">
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
        <VersionGrid table-title="已发现版本" />
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
  </Page>
</template>
