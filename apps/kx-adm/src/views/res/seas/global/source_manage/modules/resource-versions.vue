<script setup lang="ts">
import type { ResRecord } from '#/api/res/seas/global/source_manage';
import type {
  Id,
  ItemWrite,
  ResourceVersion,
  VersionDetail,
  VersionItem,
} from '#/api/res/versions';

import { computed, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Form,
  FormItem,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Spin,
  Table,
} from 'antdv-next';

import { versionVideoAdapter } from '#/api/res/version-files';
import { ResourceVersionApi as api } from '#/api/res/versions';
import { FileUrlInput } from '#/components/file-picker';
import DirectoryUpload from '#/desktop/directory-upload.vue';
import { requestErrorMessage } from '#/request-errors';

import VersionPreview from './version-preview.vue';
const props = defineProps<{ resource?: ResRecord }>();
const open = defineModel<boolean>('open', { required: true });
const versions = ref<ResourceVersion[]>([]);
const detail = ref<VersionDetail>();
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const editorOpen = ref(false);
const versionOpen = ref(false);
const editingVersion = ref<ResourceVersion>();
const itemId = ref<Id>();
const versionForm = reactive({ name: '', remark: '' });
const itemForm = reactive<ItemWrite>({
  expected_revision: 1,
  seq_no: 1,
  title: '',
  link: '',
  content: '',
  duration: 0,
  remark: '',
});
const videoValue = computed({
  get: () =>
    itemForm.link.startsWith('storage:file:')
      ? itemForm.link.slice(13)
      : itemForm.link,
  set: (value: string) => {
    itemForm.link = /^[1-9]\d*$/.test(value) ? `storage:file:${value}` : value;
  },
});
const videoAdapter = computed(() =>
  props.resource && detail.value
    ? versionVideoAdapter(props.resource.id, detail.value.version.id)
    : undefined,
);
const videoDirectory = computed(() =>
  props.resource && detail.value
    ? `res/${props.resource.id}/versions/${detail.value.version.id}/`
    : '',
);
const drama = computed(() => props.resource?.res_type === 'drama');
let requestId = 0;
watch(
  () => [open.value, props.resource?.id] as const,
  () => {
    requestId++;
    detail.value = undefined;
    versions.value = [];
    editorOpen.value = false;
    versionOpen.value = false;
    errorText.value = '';
    if (open.value && props.resource) void refresh();
  },
);
async function refresh(preferred?: Id) {
  const res = props.resource;
  if (!res) return;
  const request = ++requestId;
  loading.value = true;
  errorText.value = '';
  try {
    const list = await api.list(res.id);
    if (request !== requestId) return;
    versions.value = list;
    const selected =
      list.find(
        (v) => String(v.id) === String(preferred ?? detail.value?.version.id),
      ) ?? list[0];
    const result = selected ? await api.detail(res.id, selected.id) : undefined;
    if (request === requestId) detail.value = result;
  } catch (error) {
    if (request === requestId)
      errorText.value = requestErrorMessage(error, '读取版本失败，请刷新重试');
  } finally {
    if (request === requestId) loading.value = false;
  }
}
async function select(version: ResourceVersion) {
  if (busy.value || loading.value || !props.resource) return;
  detail.value = undefined;
  await refresh(version.id);
}
function editVersion(version?: ResourceVersion) {
  editingVersion.value = version;
  Object.assign(versionForm, {
    name: version?.name ?? '',
    remark: version?.remark ?? '',
  });
  errorText.value = '';
  versionOpen.value = true;
}
async function saveVersion() {
  if (!props.resource || busy.value) return;
  if (!versionForm.name.trim()) {
    errorText.value = '请填写版本名称';
    return;
  }
  busy.value = true;
  errorText.value = '';
  try {
    const old = editingVersion.value;
    const result = old
      ? await api.update(props.resource.id, old.id, {
          ...versionForm,
          expected_revision: old.revision,
        })
      : await api.create(props.resource.id, { ...versionForm });
    versionOpen.value = false;
    await refresh(result.id);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存版本失败');
  } finally {
    busy.value = false;
  }
}
function editItem(item?: VersionItem) {
  if (!detail.value) return;
  itemId.value = item?.id;
  Object.assign(itemForm, {
    expected_revision: detail.value.version.revision,
    seq_no:
      item?.seq_no ??
      Math.max(0, ...detail.value.items.map((v) => Number(v.seq_no))) + 1,
    title: item?.title ?? '',
    link: item?.link ?? '',
    content: item?.content ?? '',
    duration: Number(item?.duration ?? 0),
    remark: item?.remark ?? '',
  });
  errorText.value = '';
  editorOpen.value = true;
}
async function readText(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 1_000_000) {
    errorText.value = '单章文本不能超过 1 MB';
    input.value = '';
    return;
  }
  busy.value = true;
  errorText.value = '';
  try {
    const content = await file.text();
    itemForm.content = content;
    if (!itemForm.title) itemForm.title = file.name.replace(/\.txt$/i, '');
  } catch {
    errorText.value = '读取文本失败，请重试或粘贴章节正文';
  } finally {
    input.value = '';
    busy.value = false;
  }
}
async function saveItem() {
  if (!detail.value || !props.resource || busy.value) return;
  if (
    !itemForm.title.trim() ||
    !(drama.value ? itemForm.link.trim() : itemForm.content.trim())
  ) {
    errorText.value = '请填写章节标题和内容';
    return;
  }
  busy.value = true;
  errorText.value = '';
  try {
    const id = detail.value.version.id;
    await api.saveItem(props.resource.id, id, { ...itemForm }, itemId.value);
    editorOpen.value = false;
    await refresh(id);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存章节失败');
  } finally {
    busy.value = false;
  }
}
async function removeItem(item: VersionItem) {
  if (!props.resource || !detail.value || busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.removeItem(
      props.resource.id,
      detail.value.version.id,
      item.id,
      detail.value.version.revision,
    );
    await refresh();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '删除章节失败');
  } finally {
    busy.value = false;
  }
}
async function removeVersion() {
  if (!props.resource || !detail.value || busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.remove(
      props.resource.id,
      detail.value.version.id,
      detail.value.version.revision,
    );
    detail.value = undefined;
    await refresh();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '删除版本失败');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="`${resource?.res_name || ''} · 版本与内容`"
    :width="1100"
    :z-index="900"
    :footer="null"
    :closable="!busy"
    :mask-closable="!busy"
    @cancel="open = false"
  >
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <div class="mb-3 flex flex-wrap gap-2">
      <Button type="primary" :disabled="loading || busy" @click="editVersion()">
        新增版本
      </Button>
      <Button :loading="loading" :disabled="busy" @click="refresh()">
        刷新版本
      </Button>
    </div>
    <Spin :spinning="loading">
      <div class="version-layout">
        <nav aria-label="资源版本" class="version-list">
          <button
            v-for="v in versions"
            :key="v.id"
            type="button"
            :aria-pressed="detail?.version.id === v.id"
            :disabled="busy || loading"
            class="version-option"
            @click="select(v)"
          >
            <strong>{{ v.name }}</strong>
            <p>{{ v.remark || '暂无差异备注' }}</p>
          </button>
        </nav>
        <section v-if="detail" class="min-w-0" aria-label="版本内容">
          <h3 class="text-lg font-semibold">{{ detail.version.name }}</h3>
          <p class="my-3 whitespace-pre-wrap break-words text-muted-foreground">
            {{ detail.version.remark || '暂无差异备注' }}
          </p>
          <div class="mb-3 flex flex-wrap gap-2">
            <DirectoryUpload
              v-if="drama && resource"
              :res="String(resource.id)"
              :version="String(detail.version.id)"
              :version-name="detail.version.name"
              @complete="refresh()"
            />
            <Button
              :disabled="busy || loading"
              @click="editVersion(detail.version)"
            >
              修改版本信息
            </Button>
            <Button
              type="primary"
              :disabled="busy || loading"
              @click="editItem()"
            >
              {{ drama ? '手动添加分集' : '添加章节' }}
            </Button>
            <Popconfirm
              :title="`删除版本「${detail.version.name}」及其 ${detail.items.length} 个章节？`"
              @confirm="removeVersion"
            >
              <Button danger :disabled="busy || loading"> 删除版本 </Button>
            </Popconfirm>
          </div>
          <VersionPreview
            v-if="drama && resource"
            :detail="detail"
            :resource-name="resource.res_name || '资源'"
            @refresh="refresh()"
          />
          <Table
            :data-source="detail.items"
            row-key="id"
            :scroll="{ x: 580 }"
            :pagination="{ pageSize: 10, showSizeChanger: true }"
            :columns="[
              { title: '序号', dataIndex: 'seq_no', width: 70 },
              { title: '章节标题', dataIndex: 'title' },
              { title: '章节备注', dataIndex: 'remark' },
              { title: '操作', key: 'actions', width: 140 },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'actions'">
                <Button
                  type="link"
                  :disabled="busy || loading"
                  @click="editItem(record)"
                >
                  编辑内容
                </Button>
                <Popconfirm
                  :title="`删除章节「${record.title}」？`"
                  @confirm="removeItem(record)"
                >
                  <Button type="link" danger :disabled="busy || loading">
                    删除
                  </Button>
                </Popconfirm>
              </template>
            </template>
          </Table>
        </section>
        <Empty
          v-else-if="!loading"
          description="暂无版本，请新增版本后添加内容"
        />
      </div>
    </Spin>
  </Modal>
  <Modal
    :open="versionOpen"
    :title="editingVersion ? '修改版本信息' : '新增版本'"
    :width="560"
    :z-index="950"
    :confirm-loading="busy"
    :closable="!busy"
    :mask-closable="!busy"
    @ok="saveVersion"
    @cancel="versionOpen = false"
  >
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <Form layout="vertical">
      <FormItem label="版本名称" required>
        <Input
          v-model:value="versionForm.name"
          :maxlength="100"
          placeholder="例如：原版、海外版、第二次修订"
        />
      </FormItem>
      <FormItem label="差异备注">
        <Input.TextArea
          v-model:value="versionForm.remark"
          :rows="5"
          :maxlength="4000"
          placeholder="填写本版本相对其他版本的内容差异"
        />
      </FormItem>
    </Form>
  </Modal>
  <Modal
    :open="editorOpen"
    :title="`${detail?.version.name || ''} · ${itemId ? '编辑内容' : '新增内容'}`"
    :width="800"
    :z-index="950"
    :confirm-loading="busy"
    :closable="!busy"
    :mask-closable="!busy"
    @ok="saveItem"
    @cancel="editorOpen = false"
  >
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <Form layout="vertical">
      <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
        <FormItem label="章节序号" required>
          <InputNumber
            v-model:value="itemForm.seq_no"
            :min="1"
            :precision="0"
          />
        </FormItem>
        <FormItem label="章节标题" required>
          <Input
            v-model:value="itemForm.title"
            placeholder="章节标题"
            :maxlength="200"
          />
        </FormItem>
      </div>
      <template v-if="drama">
        <p class="mb-3 break-all text-sm text-muted-foreground">
          视频目录：{{ videoDirectory }}（位于所选存储的上传目录下）
        </p>
        <FormItem label="视频文件 / 播放地址" required>
          <FileUrlInput
            :key="detail?.version.id"
            :model-value="videoValue"
            value-mode="id"
            :adapter="videoAdapter"
            storage_locked
            accept="video/*"
            placeholder="填写视频 HTTP/HTTPS 地址，或选择上传的视频"
            @update:model-value="videoValue = String($event || '')"
          />
        </FormItem>
        <FormItem label="视频时长（秒）">
          <InputNumber
            v-model:value="itemForm.duration"
            :min="0"
            :precision="0"
          />
        </FormItem>
      </template>
      <template v-else>
        <FormItem label="导入单章 TXT（UTF-8，最多 1 MB）">
          <input
            type="file"
            accept=".txt,text/plain"
            aria-label="导入章节文本"
            @change="readText"
          />
        </FormItem>
        <FormItem
          :label="resource?.res_type === 'script' ? '剧本正文' : '小说正文'"
          required
        >
          <Input.TextArea
            v-model:value="itemForm.content"
            :rows="14"
            placeholder="填写本版本的章节正文"
          />
        </FormItem>
      </template>
      <FormItem label="章节备注">
        <Input.TextArea
          v-model:value="itemForm.remark"
          :rows="2"
          :maxlength="4000"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
<style scoped>
.version-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 20px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 65vh;
  overflow-y: auto;
}

.version-option {
  padding: 12px;
  text-align: left;
  overflow-wrap: anywhere;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.version-option[aria-pressed='true'] {
  background: hsl(var(--accent));
  border-color: hsl(var(--primary));
}

.version-option p {
  margin-top: 6px;
  color: hsl(var(--muted-foreground));
  white-space: pre-wrap;
}

@media (max-width: 767px) {
  .version-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .version-list {
    max-height: 220px;
  }
}
</style>
