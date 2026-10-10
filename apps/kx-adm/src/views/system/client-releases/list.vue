<script setup lang="ts">
import type { FileUploadView, StorageOptionView } from '#/api/storage';
import type { ClientRelease, ReleaseWrite } from '#/api/system/client-releases';
import type { ReleaseUploadProgress } from '#/desktop/release-upload';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { plaintextRequestClient } from '#/api/request';
import { ClientReleaseApi } from '#/api/system/client-releases';
import { desktop } from '#/desktop';
import { uploadDesktopRelease } from '#/desktop/release-upload';
import { Times } from '#/times';

import { parseReleaseBundle, platforms, validateRelease } from './release-form';

const { hasAccessByCodes } = useAccess();
const canEdit = computed(() => hasAccessByCodes(['client-releases:edit']));
const rows = ref<ClientRelease[]>([]);
const loading = ref(false);
const loadError = ref('');
const page = ref(1);
const total = ref(0);
const keyword = ref('');
const status = ref<string>();
const target = ref<string>();
const labels = { draft: '草稿', published: '已发布', withdrawn: '已撤回' };
const open = ref(false);
const saving = ref(false);
const uploading = ref(false);
const uploadProgress = ref<ReleaseUploadProgress>();
const uploadStages: Record<string, string> = {
  extracting: '解压发行包',
  hashing: '计算校验值',
  preparing: '准备直传',
  uploading: '上传对象存储',
  registering: '登记文件',
  completed: '上传完成',
};
const storageCode = ref<string>();
const storages = ref<StorageOptionView[]>([]);
const uploadStorages = computed(() =>
  desktop
    ? storages.value.filter((item) =>
        ['ali', 'cos', 's3', 'tos'].includes(item.storage_type),
      )
    : storages.value,
);
const selected = ref<ClientRelease>();
const form = ref<ReleaseWrite>({ version: '', notes: '', artifacts: [] });
const readOnly = computed(
  () => !canEdit.value || (selected.value && selected.value.status !== 'draft'),
);
const formError = ref('');
const columns = [
  { title: '版本', key: 'version', width: 130 },
  { title: '状态', key: 'status', width: 100 },
  { title: '平台', key: 'platforms' },
  { title: '发布时间', key: 'published', width: 175 },
  { title: '操作', key: 'actions', width: 260 },
];
let generation = 0;
async function load() {
  const request = ++generation;
  loading.value = true;
  loadError.value = '';
  try {
    const data = await ClientReleaseApi.page({
      page: page.value,
      size: 20,
      keyword: keyword.value,
      status: status.value,
      target: target.value,
    });
    if (request === generation) {
      rows.value = data.items;
      total.value = Number(data.total);
    }
  } catch (error) {
    if (request === generation) loadError.value = String(error);
  } finally {
    if (request === generation) loading.value = false;
  }
}
function search() {
  page.value = 1;
  void load();
}
function edit(row?: ClientRelease) {
  if (canEdit.value)
    void ClientReleaseApi.storageOptions()
      .then((items) => {
        storages.value = items;
        storageCode.value ??= uploadStorages.value[0]?.code;
      })
      .catch((error) => {
        formError.value = String(error);
      });
  selected.value = row;
  form.value = row
    ? {
        version: row.version,
        notes: row.notes,
        artifacts: row.artifacts.map((a) => ({ ...a })),
      }
    : { version: '', notes: '', artifacts: [] };
  formError.value = '';
  open.value = true;
}
function addPlatform(row: ClientRelease) {
  edit();
  form.value.version = row.version;
  form.value.notes = row.notes;
}
function platformName(value: string) {
  return platforms.find((p) => p.value === value)?.label ?? value;
}
async function save() {
  if (saving.value || uploading.value || readOnly.value) return;
  formError.value = '';
  try {
    validateRelease(form.value);
    saving.value = true;
    await (selected.value
      ? ClientReleaseApi.edit(selected.value, form.value)
      : ClientReleaseApi.create(form.value));
    open.value = false;
    message.success('版本草稿已保存');
    await load();
  } catch (error) {
    formError.value = String(error);
  } finally {
    saving.value = false;
  }
}
function action(row: ClientRelease, action: 'delete' | 'publish' | 'withdraw') {
  const names = {
    delete: '删除草稿',
    publish: '发布版本',
    withdraw: '撤回版本',
  };
  Modal.confirm({
    title: `${names[action]} ${row.version} · ${platformName(row.target)}？`,
    content: {
      publish:
        '仅发布当前平台，其他平台状态不变。发布后此平台安装包和说明不可修改。',
      withdraw:
        '仅停止当前平台分发，其他平台继续发布。已更新的客户端不会降级。',
      delete: '此操作只删除草稿记录，不删除托管的安装包。',
    }[action],
    async onOk() {
      await (action === 'delete'
        ? ClientReleaseApi.remove(row)
        : ClientReleaseApi.action(row, action));
      message.success(`${names[action]}成功`);
      await load();
    },
  });
}
async function uploadBundle(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || uploading.value) return;
  uploading.value = true;
  formError.value = '';
  try {
    if (form.value.artifacts.length > 0)
      throw new Error('每条记录只维护一个平台，请新建其它平台版本');
    if (!storageCode.value) throw new Error('请选择系统存储');
    const bundle = await parseReleaseBundle(file);
    if (form.value.version && form.value.version !== bundle.release.version)
      throw new Error('发行包版本与当前版本不一致');
    const artifact = bundle.release.artifacts[0];
    if (selected.value && artifact?.target !== selected.value.target)
      throw new Error('平台不匹配，请新建其它平台版本');
    if (!artifact) throw new Error('发行包缺少平台');
    if (form.value.artifacts.some((a) => a.target === artifact.target))
      throw new Error('此平台已存在，请先移除后重新上传');
    // 使用原始上传响应，避免本地 storage 为预览再次下载整个安装包。
    const uploaded = await plaintextRequestClient.upload<FileUploadView[]>(
      `/storage/file/upload/${encodeURIComponent(storageCode.value)}`,
      { file: bundle.file },
      { timeout: 30 * 60 * 1000 },
    );
    const stored = uploaded[0];
    if (!stored) throw new Error('上传未返回文件，请重试');
    form.value.version = bundle.release.version;
    form.value.notes ||= bundle.release.notes;
    form.value.artifacts.push({
      target: artifact.target,
      signature: artifact.signature,
      url: '',
      file_id: stored.file.file_id,
    });
    message.success('更新包已上传到系统存储');
  } catch (error) {
    formError.value = String(error);
  } finally {
    uploading.value = false;
    input.value = '';
  }
}
async function uploadNative() {
  if (uploading.value || saving.value || readOnly.value) return;
  formError.value = '';
  uploadProgress.value = undefined;
  uploading.value = true;
  try {
    if (
      !storageCode.value ||
      !uploadStorages.value.some((item) => item.code === storageCode.value)
    )
      throw new Error('请选择支持客户端直传的对象存储');
    if (form.value.artifacts.length > 0)
      throw new Error('每条记录只维护一个平台，请新建其它平台版本');
    const release = await uploadDesktopRelease(
      storageCode.value,
      form.value,
      (progress) => {
        uploadProgress.value = progress;
      },
    );
    if (!release) return;
    if (
      selected.value &&
      release.artifacts[0]?.target !== selected.value.target
    )
      throw new Error('平台不匹配，请新建其它平台版本');
    form.value.version = release.version;
    form.value.notes ||= release.notes;
    form.value.artifacts.push(...release.artifacts);
    message.success('发行包已直接上传到对象存储');
  } catch (error) {
    formError.value = String(error);
  } finally {
    uploading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page
    title="客户端版本"
    description="每个版本按平台独立发布，新增或撤回 Windows 不影响 macOS。"
  >
    <Space class="mb-4" wrap>
      <Input
        v-model:value="keyword"
        placeholder="搜索版本号"
        allow-clear
        @press-enter="search"
      />
      <Select
        v-model:value="status"
        class="w-32"
        placeholder="全部状态"
        allow-clear
        :options="
          Object.entries(labels).map(([value, label]) => ({ value, label }))
        "
        @change="search"
      />
      <Select
        v-model:value="target"
        :options="platforms"
        class="w-48"
        placeholder="全部平台"
        allow-clear
        @change="search"
      />
      <Button @click="search">查询</Button>
      <Button :loading="loading" @click="load">刷新</Button>
      <Button v-if="canEdit" type="primary" @click="edit()">新建版本</Button>
    </Space>
    <Alert
      v-if="loadError"
      class="mb-4"
      type="error"
      :message="loadError"
      show-icon
    />
    <Table
      :row-key="(row: ClientRelease) => `${row.version}:${row.target}`"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :scroll="{ x: 900 }"
      :pagination="{
        current: page,
        pageSize: 20,
        total,
        showSizeChanger: false,
        onChange: (value: number) => {
          page = value;
          load();
        },
      }"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'version'"
          type="link"
          @click="edit(record)"
        >
          {{ record.version }}
        </Button>
        <Tag
          v-else-if="column.key === 'status'"
          :color="record.status === 'published' ? 'success' : 'default'"
        >
          {{ labels[record.status as keyof typeof labels] }}
        </Tag>
        <template v-else-if="column.key === 'platforms'">
          {{ platformName(record.target) }}
        </template>
        <template v-else-if="column.key === 'published'">
          {{
            record.published_at
              ? Times.formatUnix(Number(record.published_at))
              : '—'
          }}
        </template>
        <Space v-else-if="column.key === 'actions'">
          <Button v-if="canEdit" type="link" @click="addPlatform(record)">
            新增其它平台
          </Button>
          <Button
            v-if="
              record.status === 'draft' &&
              hasAccessByCodes(['client-releases:publish'])
            "
            type="link"
            @click="action(record, 'publish')"
          >
            发布
          </Button>
          <Button
            v-if="
              record.status === 'published' &&
              hasAccessByCodes(['client-releases:withdraw'])
            "
            type="link"
            danger
            @click="action(record, 'withdraw')"
          >
            撤回
          </Button>
          <Button
            v-if="record.status === 'draft' && canEdit"
            type="link"
            danger
            @click="action(record, 'delete')"
          >
            删除草稿
          </Button>
        </Space>
      </template>
    </Table>
    <Modal
      v-model:open="open"
      :title="
        selected
          ? `${selected.version} · ${platformName(selected.target)}`
          : '新建平台版本'
      "
      :width="760"
      :confirm-loading="saving"
      :closable="!saving && !uploading"
      :mask-closable="!saving && !uploading"
      :keyboard="!saving && !uploading"
      :cancel-button-props="{ disabled: saving || uploading }"
      :ok-button-props="{ disabled: !!readOnly || uploading }"
      ok-text="保存草稿"
      @ok="save"
    >
      <Alert
        v-if="formError"
        class="mb-4"
        type="error"
        :message="formError"
        show-icon
      />
      <Alert
        v-if="!selected"
        class="mb-4"
        type="info"
        message="相同版本号可分别创建 macOS、Windows 等平台记录，各自发布或撤回。"
      />
      <Form layout="vertical" :disabled="!!readOnly || saving || uploading">
        <FormItem v-if="!readOnly" label="系统存储" required>
          <Select
            v-model:value="storageCode"
            :options="
              uploadStorages.map((item) => ({
                value: item.code,
                label: item.storage_name,
              }))
            "
            placeholder="请选择存储"
          />
        </FormItem>
        <FormItem v-if="!readOnly" label="上传发行包" required>
          <Button
            v-if="desktop"
            :loading="uploading"
            :disabled="saving || uploading"
            @click="uploadNative"
          >
            选择发行包并直传
          </Button>
          <Progress
            v-if="desktop && uploadProgress"
            :percent="
              uploadProgress.total
                ? Math.min(
                    100,
                    Math.floor(
                      (uploadProgress.bytes / uploadProgress.total) * 100,
                    ),
                  )
                : 0
            "
          />
          <p v-if="desktop && uploadProgress">
            {{ uploadStages[uploadProgress.stage] ?? uploadProgress.stage }}
          </p>
          <input
            v-if="!desktop"
            aria-label="上传发行包"
            type="file"
            accept=".tgz"
            :disabled="saving || uploading"
            @change="uploadBundle"
          />
          <p>
            {{
              desktop
                ? '客户端流式直传对象存储，不经过后台文件上传接口。'
                : uploading
                  ? '正在上传，请勿关闭…'
                  : '选择单个 .tgz 发行包（安装包不超过 512 MiB），无需单独上传校验文件。'
            }}
          </p>
        </FormItem>
        <FormItem label="版本号" required>
          <Input
            v-model:value="form.version"
            placeholder="例如 0.1.1"
            :disabled="!!selected || saving"
          />
        </FormItem>
        <FormItem label="更新说明">
          <Input.TextArea
            v-model:value="form.notes"
            :rows="4"
            :maxlength="10000"
          />
        </FormItem>
        <div
          v-for="(artifact, index) in form.artifacts"
          :key="index"
          class="mb-4 border-t pt-4"
        >
          <FormItem label="平台" required>
            <Select
              v-model:value="artifact.target"
              :options="platforms"
              disabled
            />
          </FormItem>
          <p class="mb-3">
            {{ artifact.file_id ? '已上传至系统存储' : artifact.url }}
          </p>
          <Button
            v-if="!readOnly"
            danger
            @click="form.artifacts.splice(index, 1)"
          >
            移除此平台
          </Button>
        </div>
      </Form>
      <p class="text-muted-foreground">
        更新包存放于所选系统存储。发布后内容固定，发现问题请撤回并发布更高版本。
      </p>
    </Modal>
  </Page>
</template>
