<script setup lang="ts">
import type { ClientRelease, ReleaseWrite } from '#/api/system/client-releases';

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
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { ClientReleaseApi } from '#/api/system/client-releases';
import { Times } from '#/times';

import {
  parseReleaseManifest,
  platforms,
  validateRelease,
} from './release-form';

const { hasAccessByCodes } = useAccess();
const canEdit = computed(() => hasAccessByCodes(['client-releases:edit']));
const rows = ref<ClientRelease[]>([]);
const loading = ref(false);
const loadError = ref('');
const page = ref(1);
const total = ref(0);
const keyword = ref('');
const status = ref<string>();
const labels = { draft: '草稿', published: '已发布', withdrawn: '已撤回' };
const open = ref(false);
const saving = ref(false);
const selected = ref<ClientRelease>();
const form = ref<ReleaseWrite>({ version: '', notes: '', artifacts: [] });
const readOnly = computed(
  () => !canEdit.value || (selected.value && selected.value.status !== 'draft'),
);
const formError = ref('');
const columns = [
  { title: '版本', key: 'version', width: 130 },
  { title: '状态', key: 'status', width: 100 },
  { title: '支持平台', key: 'platforms' },
  { title: '发布时间', key: 'published', width: 175 },
  { title: '操作', key: 'actions', width: 200 },
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
async function save() {
  if (saving.value || readOnly.value) return;
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
    title: `${names[action]} ${row.version}？`,
    content: {
      publish:
        '发布后客户端可以更新，安装包和说明不可修改。请确认安装包与签名匹配，并已完成安装验证。',
      withdraw: '撤回后停止分发。已更新的客户端不会降级；修复请发布更高版本。',
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
async function signature(event: Event, index: number) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  try {
    if (!file) return;
    if (file.size > 4096) throw new Error('签名文件不能超过 4 KB');
    const artifact = form.value.artifacts[index];
    const content = await file.text();
    if (artifact) artifact.signature = content.trim();
  } catch (error) {
    formError.value = String(error);
  } finally {
    input.value = '';
  }
}
async function manifest(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  try {
    if (!file) return;
    if (file.size > 100_000) throw new Error('发行清单不能超过 100 KB');
    const parsed = parseReleaseManifest(await file.text());
    if (selected.value && selected.value.version !== parsed.version)
      throw new Error('清单版本与当前草稿不一致');
    form.value = parsed;
    formError.value = '';
  } catch (error) {
    formError.value = String(error);
  } finally {
    input.value = '';
  }
}
onMounted(load);
</script>
<template>
  <Page
    title="客户端版本"
    description="管理 KX ADM 桌面端发行版本；发布后客户端会自动检查更新。"
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
      <Button @click="search">查询</Button><Button :loading="loading" @click="load">刷新</Button>
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
      row-key="version"
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
          {{
            record.artifacts
              .map(
                (a: { target: string }) =>
                  platforms.find((p) => p.value === a.target)?.label ||
                  a.target,
              )
              .join('、')
          }}
        </template>
        <template v-else-if="column.key === 'published'">
          {{
            record.published_at
              ? Times.formatUnix(Number(record.published_at))
              : '—'
          }}
        </template>
        <Space v-else-if="column.key === 'actions'">
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
      :title="selected ? `客户端版本 ${selected.version}` : '新建客户端版本'"
      :width="760"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :cancel-button-props="{ disabled: saving }"
      :ok-button-props="{ disabled: !!readOnly }"
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
      <Form layout="vertical" :disabled="!!readOnly || saving">
        <FormItem v-if="!readOnly" label="导入发行清单（可选）">
          <input
            aria-label="导入发行清单"
            type="file"
            accept=".json"
            :disabled="saving"
            @change="manifest"
          />
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
            <Select v-model:value="artifact.target" :options="platforms" />
          </FormItem>
          <FormItem label="更新包地址" required>
            <Input
              v-model:value="artifact.url"
              placeholder="https://…（macOS .app.tar.gz / Windows 安装程序 / Linux AppImage）"
            />
          </FormItem>
          <FormItem label="签名文件" required>
            <template v-if="!readOnly">
              <input
                :aria-label="`平台 ${index + 1} 签名文件`"
                type="file"
                accept=".sig"
                :disabled="saving"
                @change="signature($event, index)"
              />
            </template>
            <span class="ml-2">{{
              artifact.signature ? '已载入签名' : '请选择对应更新包的 .sig 文件'
            }}</span>
          </FormItem>
          <Button
            v-if="!readOnly"
            danger
            @click="form.artifacts.splice(index, 1)"
          >
            移除此平台
          </Button>
        </div>
        <Button
          v-if="!readOnly && form.artifacts.length < 8"
          class="mb-4"
          @click="form.artifacts.push({ target: '', url: '', signature: '' })"
        >
          添加平台更新包
        </Button>
      </Form>
      <p class="text-muted-foreground">
        安装包需托管在稳定的 HTTPS
        地址。发布后内容固定，发现问题请撤回并发布更高版本。
      </p>
    </Modal>
  </Page>
</template>
