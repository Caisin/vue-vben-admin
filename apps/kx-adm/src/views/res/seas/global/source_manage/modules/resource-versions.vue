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

import NovelImport from './novel-import.vue';
import NovelReader from './novel-reader.vue';
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
const novel = computed(() => props.resource?.res_type === 'novel');
const textResource = computed(
  () => novel.value || props.resource?.res_type === 'script',
);
const reader = ref<InstanceType<typeof NovelReader>>();
const versionSearch = ref('');
const chapterSearch = ref('');
const visibleVersions = computed(() =>
  versions.value.filter((v) =>
    `${v.name} ${v.remark}`.includes(versionSearch.value.trim()),
  ),
);
const visibleItems = computed(() =>
  (detail.value?.items ?? []).filter((item) =>
    `${item.seq_no} ${item.title} ${item.remark}`.includes(
      chapterSearch.value.trim(),
    ),
  ),
);
const textCount = computed(() =>
  (detail.value?.items ?? []).reduce(
    (sum, item) => sum + item.content.length,
    0,
  ),
);
function date(value: number) {
  return value ? new Date(Number(value) * 1000).toLocaleDateString() : '—';
}
watch(
  () => detail.value?.version.id,
  () => {
    chapterSearch.value = '';
  },
);

let requestId = 0;
watch(
  () => [open.value, props.resource?.id] as const,
  () => {
    requestId++;
    detail.value = undefined;
    versions.value = [];
    versionSearch.value = '';
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
    :width="1280"
    :style="{ top: '4vh' }"
    :styles="{ body: { maxHeight: '80vh', overflowY: 'auto' } }"
    :z-index="900"
    :footer="null"
    :closable="!busy"
    :mask-closable="!busy"
    @cancel="open = false"
  >
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <header class="resource-overview">
      <div>
        <span class="resource-kicker">{{
          drama ? '短剧素材' : novel ? '小说内容' : '剧本内容'
        }}</span>
        <h2>{{ resource?.res_name }}</h2>
        <p>按版本管理内容与差异，预览当前版本的完整作品。</p>
      </div>
      <div class="resource-metrics">
        <div>
          <strong>{{ versions.length }}</strong><span>内容版本</span>
        </div>
        <div>
          <strong>{{ detail?.items.length ?? 0 }}</strong><span>{{ drama ? '当前分集' : '当前章节' }}</span>
        </div>
        <div v-if="!drama">
          <strong>{{ textCount.toLocaleString() }}</strong><span>正文字符</span>
        </div>
      </div>
    </header>
    <div class="workspace-actions">
      <NovelImport
        v-if="textResource && resource"
        :key="String(resource.id)"
        :res="resource.id"
        :resource-type="String(resource.res_type)"
        @complete="refresh($event)"
      />
      <Button
        :type="novel ? 'default' : 'primary'"
        :disabled="loading || busy"
        @click="editVersion()"
      >
        新增版本
      </Button>
      <Button :loading="loading" :disabled="busy" @click="refresh()">
        刷新版本
      </Button>
    </div>
    <Spin :spinning="loading">
      <div class="version-layout">
        <aside class="version-sidebar">
          <div class="sidebar-heading">
            <strong>全部版本</strong><span>{{ versions.length }}</span>
          </div>
          <Input
            v-model:value="versionSearch"
            placeholder="搜索版本或差异备注"
            allow-clear
            class="mb-3"
          />
          <nav aria-label="资源版本" class="version-list">
            <button
              v-for="(v, index) in visibleVersions"
              :key="v.id"
              type="button"
              :aria-pressed="String(detail?.version.id) === String(v.id)"
              :disabled="busy || loading"
              class="version-option"
              @click="select(v)"
            >
              <div class="version-option-title">
                <span class="version-mark">{{ index + 1 }}</span><strong>{{ v.name }}</strong>
              </div>
              <p>{{ v.remark || '暂无差异备注' }}</p>
              <time>{{ date(v.updated_at) }} 更新</time>
            </button>
            <p
              v-if="!visibleVersions.length"
              class="py-4 text-center text-muted-foreground"
            >
              暂无匹配版本
            </p>
          </nav>
        </aside>
        <section v-if="detail" class="version-content" aria-label="版本内容">
          <header class="version-heading">
            <div>
              <span class="resource-kicker">当前版本</span>
              <h3>{{ detail.version.name }}</h3>
              <p>
                {{ detail.items.length }} {{ drama ? '集' : '章' }} ·
                {{ date(detail.version.updated_at) }} 更新
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                :disabled="busy || loading"
                @click="editVersion(detail.version)"
              >
                修改版本信息
              </Button>
              <Popconfirm
                :title="`删除版本「${detail.version.name}」及其 ${detail.items.length} 个章节？`"
                @confirm="removeVersion"
              >
                <Button danger :disabled="busy || loading"> 删除版本 </Button>
              </Popconfirm>
            </div>
          </header>
          <div class="version-remark">
            <span>版本差异</span>
            <p>
              {{
                detail.version.remark ||
                '暂无差异备注，可记录本版的修订范围和内容变化。'
              }}
            </p>
          </div>
          <div class="content-actions">
            <DirectoryUpload
              v-if="drama && resource"
              :res="String(resource.id)"
              :version="String(detail.version.id)"
              :version-name="detail.version.name"
              @complete="refresh()"
            />
            <VersionPreview
              v-if="drama && resource"
              :detail="detail"
              :resource-name="resource.res_name || '资源'"
              @refresh="refresh()"
            />
            <NovelReader
              v-if="!drama && resource"
              ref="reader"
              :detail="detail"
              :resource-name="resource.res_name || '资源'"
            />
            <Button :disabled="busy || loading" @click="editItem()">
              {{ drama ? '手动添加分集' : '添加章节' }}
            </Button>
          </div>
          <div class="chapter-heading">
            <strong>{{ drama ? '分集清单' : '章节清单' }}</strong><Input
              v-model:value="chapterSearch"
              placeholder="搜索序号、标题或备注"
              allow-clear
              class="chapter-search"
            />
          </div>
          <Table
            :data-source="visibleItems"
            row-key="id"
            :scroll="{ x: 650 }"
            :pagination="{ pageSize: 10, showSizeChanger: true }"
            :columns="[
              { title: '序号', dataIndex: 'seq_no', width: 70 },
              { title: '章节标题', key: 'title' },
              ...(!drama
                ? [{ title: '字符数', key: 'characters', width: 90 }]
                : []),
              { title: '章节备注', dataIndex: 'remark' },
              { title: '操作', key: 'actions', width: drama ? 170 : 260 },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <Button
                  v-if="!drama"
                  type="link"
                  class="chapter-title"
                  @click="reader?.show(record.id)"
                >
                  {{ record.title }}
</Button><span v-else>{{ record.title }}</span>
              </template>
              <span v-else-if="column.key === 'characters'">{{
                record.content.length.toLocaleString()
              }}</span>
              <div
                v-else-if="column.key === 'actions'"
                class="flex flex-wrap gap-1"
              >
                <Button
                  v-if="!drama"
                  type="link"
                  @click="reader?.show(record.id)"
                >
                  预览章节
                </Button>
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
              </div>
            </template>
          </Table>
        </section>
        <Empty
          v-else-if="!loading"
          description="暂无版本，请新增版本或导入 TXT 后开始管理内容"
          class="version-empty"
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
.resource-overview {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 22px;
  border-bottom: 1px solid hsl(var(--border));
}

.resource-kicker {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 1px;
}

.resource-overview h2 {
  margin: 6px 0;
  font-size: 22px;
  font-weight: 650;
}

.resource-overview p,
.version-heading p {
  margin-top: 6px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.resource-metrics {
  display: flex;
  flex-shrink: 0;
  gap: 24px;
}

.resource-metrics div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 60px;
}

.resource-metrics strong {
  font-size: 24px;
  font-weight: 600;
}

.resource-metrics span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.workspace-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 0;
}

.version-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 24px;
  min-height: 500px;
}

.version-sidebar {
  min-width: 0;
  padding: 16px;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.sidebar-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sidebar-heading span {
  color: hsl(var(--muted-foreground));
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 57vh;
  overflow: auto;
}

.version-option {
  padding: 14px;
  text-align: left;
  overflow-wrap: anywhere;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.version-option[aria-pressed='true'] {
  background: hsl(var(--accent));
  border-color: hsl(var(--primary));
}

.version-option-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.version-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 26px;
  height: 26px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 6px;
}

.version-option p {
  display: -webkit-box;
  margin-top: 10px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
}

.version-option time {
  display: block;
  margin-top: 12px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.version-content {
  min-width: 0;
}

.version-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.version-heading h3 {
  margin-top: 6px;
  font-size: 21px;
  font-weight: 600;
}

.version-remark {
  display: flex;
  gap: 16px;
  padding: 14px 16px;
  margin: 18px 0;
  background: hsl(var(--muted) / 40%);
  border-radius: 8px;
}

.version-remark span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.version-remark p {
  font-size: 13px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.content-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.chapter-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.chapter-search {
  max-width: 260px;
}

.chapter-title {
  max-width: 100%;
  height: auto;
  padding: 0;
  text-align: left;
  white-space: normal;
}

.version-empty {
  align-self: center;
}

@media (max-width: 767px) {
  .resource-overview {
    flex-direction: column;
    gap: 14px;
    align-items: flex-start;
  }

  .resource-metrics {
    gap: 24px;
  }

  .resource-metrics strong {
    font-size: 20px;
  }

  .version-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .version-list {
    max-height: 180px;
  }

  .version-sidebar {
    padding: 12px;
  }

  .version-heading {
    flex-direction: column;
  }

  .version-remark {
    flex-direction: column;
    gap: 6px;
  }

  .chapter-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .chapter-search {
    max-width: none;
  }
}
</style>
