<script setup lang="ts">
import type {
  GenerateOptions,
  GenerateWrite,
  Id,
  StudioKind,
  StudioModel,
  StudioRun,
  StudioSession,
} from '#/api/aigc-gateway/studio';
import type { StorageOptionView } from '#/api/storage';
import type {
  FilePickerAdapter,
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  Select,
  Spin,
  Tag,
  TextArea,
  Tooltip,
} from 'antdv-next';

import { StudioApi } from '#/api/aigc-gateway/studio';
import { StorageFileApi } from '#/api/storage';
import { FilePicker, FileRefPreview } from '#/components/file-picker';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import {
  accepts,
  canResume,
  cleanOptions,
  errorText,
  isActive,
  names,
  runErrorText,
  states,
} from './data';
import Markdown from './markdown.vue';
import ResultFile from './result-file.vue';

const props = defineProps<{ kind: StudioKind }>();
const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const writable = computed(() => hasAccessByCodes(['aigc:studio-write']));
const sessions = ref<StudioSession[]>([]);
const current = ref<StudioSession>();
const runs = ref<StudioRun[]>([]);
const models = ref<StudioModel[]>([]);
const storages = ref<StorageOptionView[]>([]);
const selectedModel = ref<Id>();
const storage = ref('');
const keyword = ref('');
const prompt = ref('');
const instructions = ref('');
const fileIds = ref<Id[]>([]);
const loading = ref(false);
const sending = ref(false);
const pageError = ref('');
const pollingError = ref('');
const hasMore = ref(false);
const moreRuns = ref(false);
const showHistory = ref(false);
const showSettings = ref(false);
const renameOpen = ref(false);
const renameTitle = ref('');
const picker = ref<FilePickerExpose>();
const detailRun = ref<StudioRun>();
const details = computed(
  () =>
    runs.value.find((run) => String(run.id) === String(detailRun.value?.id)) ??
    detailRun.value,
);
const runList = ref<HTMLElement>();
async function scrollLatest() {
  await nextTick();
  if (runList.value) runList.value.scrollTop = runList.value.scrollHeight;
}
const options = reactive<GenerateOptions>({ count: 1, max_tokens: 4096 });
const model = computed(() =>
  models.value.find((item) => String(item.id) === String(selectedModel.value)),
);
const available = computed(() =>
  models.value.filter((item) => item.capabilities.includes(props.kind)),
);
const activeRun = computed(() => runs.value.find((run) => isActive(run.state)));
const unresolved = computed(() =>
  runs.value.find((run) => run.state === 'unknown'),
);
const locked = computed(
  () => sending.value || Boolean(activeRun.value) || Boolean(unresolved.value),
);
const chronological = computed(() => runs.value.toReversed());
const storageOptions = computed(() =>
  storages.value.map((item) => ({
    label: item.storage_name,
    value: item.code,
  })),
);
const modelOptions = computed(() =>
  available.value.map((item) => ({
    label: `${item.name} · ${item.provider}`,
    value: item.id,
  })),
);
let epoch = 0;
let searchEpoch = 0;
let pending: undefined | { id: Id; request: GenerateWrite };
const adapter: FilePickerAdapter = {
  detail: StorageFileApi.detail,
  list: (query) =>
    StorageFileApi.list({ ...query, storage_code: storage.value }),
  upload: (file) => StorageFileApi.upload(storage.value, file),
  urls: StorageFileApi.urls,
  storageOptions: async () =>
    storages.value.map((item) => ({
      label: item.storage_name,
      value: item.code,
      storage_type: item.storage_type,
    })),
};
async function search(more = false) {
  const version = ++searchEpoch;
  try {
    const rows = await StudioApi.sessions(
      props.kind,
      keyword.value,
      more ? sessions.value.at(-1)?.id : undefined,
    );
    if (version !== searchEpoch) return;
    sessions.value = more ? [...sessions.value, ...rows] : rows;
    hasMore.value = rows.length === 50;
  } catch {
    pageError.value = '会话列表加载失败';
  }
}
async function open(session: StudioSession) {
  if (sending.value) return;
  const changing = String(current.value?.id) !== String(session.id);
  const version = ++epoch;
  polling.stop();
  if (changing) pending = undefined;
  loading.value = true;
  pageError.value = '';
  pollingError.value = '';
  runs.value = [];
  current.value = session;
  if (changing) {
    prompt.value = '';
    fileIds.value = [];
  }
  try {
    const [fresh, rows] = await Promise.all([
      StudioApi.session(session.id),
      StudioApi.runs(session.id),
    ]);
    if (version !== epoch) return;
    current.value = fresh;
    runs.value = rows;
    moreRuns.value = rows.length === 50;
    if (changing && rows[0]) restoreSettings(rows[0]);
    if (
      pending &&
      rows.some(
        (row) => row.input.request.request_key === pending?.request.request_key,
      )
    ) {
      pending = undefined;
      prompt.value = '';
      fileIds.value = [];
    }
    showHistory.value = false;
    await router.replace({
      query: { ...route.query, session_id: String(session.id) },
    });
    if (rows.some((row) => isActive(row.state))) polling.start();
    await scrollLatest();
  } catch {
    if (version === epoch) pageError.value = '会话加载失败';
  } finally {
    if (version === epoch) loading.value = false;
  }
}
async function createSession() {
  if (!writable.value || sending.value) return;
  const session = await StudioApi.create(
    props.kind,
    props.kind === 'chat' ? '新对话' : `新的${names[props.kind]}`,
  );
  await search();
  await open(session);
  prompt.value = '';
  fileIds.value = [];
  return session;
}
async function loadMoreRuns() {
  if (!current.value) return;
  const version = epoch;
  const rows = await StudioApi.runs(current.value.id, runs.value.at(-1)?.id);
  if (version !== epoch) return;
  runs.value.push(...rows);
  moreRuns.value = rows.length === 50;
}
const polling = useTaskPolling({
  delay: 1000,
  load: async () => {
    if (!current.value) return [];
    return StudioApi.runs(current.value.id);
  },
  accept: async (rows) => {
    const follow =
      !runList.value ||
      runList.value.scrollHeight -
        runList.value.scrollTop -
        runList.value.clientHeight <
        100;
    pollingError.value = '';
    const known = new Set(rows.map((row) => String(row.id)));
    runs.value = [
      ...rows,
      ...runs.value.filter((row) => !known.has(String(row.id))),
    ];
    if (follow) await scrollLatest();
    if (!rows.some((row) => isActive(row.state)) && current.value) {
      const id = current.value.id;
      const fresh = await StudioApi.session(id);
      if (String(current.value?.id) === String(id)) current.value = fresh;
    }
  },
  done: (rows) => !rows.some((row) => isActive(row.state)),
  onError: () => {
    pollingError.value = '进度暂时无法获取，正在重连';
  },
});
async function send(regenerate?: StudioRun) {
  if (locked.value || !writable.value) return;
  const text = regenerate?.input.request.prompt ?? prompt.value.trim();
  if (!text || !selectedModel.value || !storage.value) {
    message.warning('请选择模型、私有存储并填写内容');
    return;
  }
  sending.value = true;
  try {
    let session = current.value;
    if (!session) {
      session = await StudioApi.create(props.kind, text.slice(0, 40));
      current.value = session;
      runs.value = [];
      await search();
      await router.replace({ query: { session_id: String(session.id) } });
    }
    const request: GenerateWrite = pending?.request ?? {
      request_key: crypto.randomUUID(),
      version: session.version,
      route_id: selectedModel.value,
      prompt: text,
      instructions: instructions.value,
      storage_code: storage.value,
      file_ids: regenerate?.input.request.file_ids ?? [...fileIds.value],
      regenerate_from: props.kind === 'chat' ? regenerate?.id : undefined,
      options: cleanOptions(props.kind, model.value?.protocol ?? '', options),
    };
    if (regenerate && !pending)
      Object.assign(request, regenerate.input.request, {
        request_key: crypto.randomUUID(),
        version: session.version,
        regenerate_from: props.kind === 'chat' ? regenerate.id : undefined,
      });
    pending ??= { id: session.id, request };
    const row = await StudioApi.generate(pending.id, pending.request);
    pending = undefined;
    runs.value = [
      row,
      ...runs.value.filter((item) => String(item.id) !== String(row.id)),
    ];
    current.value = await StudioApi.session(session.id);
    if (!regenerate) {
      prompt.value = '';
      fileIds.value = [];
    }
    pageError.value = '';
    polling.start();
    await scrollLatest();
  } catch (error) {
    const code = requestErrorMessage(error, '');
    // 此错误仅在创建生成记录前拒绝当前附件；网络不确定结果仍保留幂等请求。
    if (code === 'aigc_studio_attachment_unavailable') pending = undefined;
    pageError.value = code
      ? errorText(code)
      : '提交未完成。重试将使用同一请求编号；也可刷新核对任务记录。';
  } finally {
    sending.value = false;
  }
}
async function cancel(row: StudioRun) {
  if (row.state === 'unknown') {
    Modal.confirm({
      title: '结束待核实任务？',
      content:
        '上游可能已生成并计费。结束后可以继续创作，但再次生成会发起新的付费请求。',
      onOk: async () => {
        await StudioApi.cancel(row.id);
        polling.start();
      },
    });
    return;
  }
  await StudioApi.cancel(row.id);
  polling.start();
}
async function resume(row: StudioRun) {
  await StudioApi.resume(row.id);
  polling.start();
}
function reuse(row: StudioRun) {
  prompt.value = row.input.request.prompt;
  fileIds.value = [...row.input.request.file_ids];
  restoreSettings(row);
  showSettings.value = true;
}
function restoreSettings(row: StudioRun) {
  instructions.value = row.input.request.instructions;
  selectedModel.value = row.route_id;
  storage.value = row.input.request.storage_code;
  Object.assign(
    options,
    {
      size: undefined,
      seconds: undefined,
      quality: undefined,
      aspect_ratio: undefined,
    },
    row.input.request.options,
  );
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制');
  } catch {
    message.error('复制失败');
  }
}
function rename() {
  renameTitle.value = current.value?.title ?? '';
  renameOpen.value = true;
}
async function saveTitle() {
  if (!current.value) return;
  current.value = await StudioApi.rename(
    current.value.id,
    renameTitle.value,
    current.value.version,
  );
  renameOpen.value = false;
  await search();
}
function remove() {
  const session = current.value;
  if (!session) return;
  Modal.confirm({
    title: `删除“${session.title}”？`,
    content: '会话将从列表隐藏。已产生的供应商费用不会撤销。',
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      await StudioApi.remove(session.id);
      epoch++;
      polling.stop();
      current.value = undefined;
      runs.value = [];
      pending = undefined;
      await router.replace({ query: {} });
      await search();
    },
  });
}
function selectFiles(files: SelectedStorageFile[]) {
  const next = [
    ...new Set([...fileIds.value, ...files.map((item) => item.file_id)]),
  ];
  if (next.length > (props.kind === 'video' ? 1 : 8)) {
    message.warning(
      props.kind === 'video' ? '视频最多选择一个参考素材' : '最多选择八个附件',
    );
    return;
  }
  fileIds.value = next;
}
function changeModel() {
  options.size = undefined;
  options.seconds = undefined;
  options.quality = undefined;
  options.aspect_ratio = undefined;
}
async function refresh() {
  if (sending.value) return;
  try {
    const [catalog, stores] = await Promise.all([
      StudioApi.models(),
      StudioApi.storages(),
    ]);
    models.value = catalog;
    storages.value = stores;
    selectedModel.value ??= available.value[0]?.id;
    storage.value ||= stores[0]?.code ?? '';
    await search();
    if (current.value) await open(current.value);
    else if (route.query.session_id) {
      const session = await StudioApi.session(String(route.query.session_id));
      if (session.kind === props.kind) await open(session);
    }
  } catch {
    pageError.value = '工作台加载失败，请重试';
  }
}
onMounted(refresh);
watch(
  () => route.query.session_id,
  async (id) => {
    if (
      route.path !== `/aigc-gateway/${props.kind}` ||
      String(current.value?.id ?? '') === String(id ?? '') ||
      sending.value
    )
      return;
    const version = ++epoch;
    try {
      if (!id) {
        polling.stop();
        current.value = undefined;
        runs.value = [];
        return;
      }
      const session = await StudioApi.session(String(id));
      if (version === epoch && session.kind === props.kind) await open(session);
    } catch {
      if (version === epoch) pageError.value = '会话加载失败';
    }
  },
);
onDeactivated(() => polling.stop());
onActivated(() => {
  if (activeRun.value) polling.start();
});
onBeforeUnmount(() => {
  epoch++;
  searchEpoch++;
});
</script>

<template>
  <Page
    :title="names[kind]"
    auto-content-height
    content-class="flex min-h-0 flex-col"
  >
    <div class="studio-toolbar">
      <Button
        @click="
          showHistory = !showHistory;
          showSettings = false;
        "
      >
        <template #icon><IconifyIcon icon="lucide:history" /></template>历史
      </Button>
      <h2>{{ current?.title ?? names[kind] }}</h2>
      <Tooltip title="刷新">
        <Button aria-label="刷新工作台" @click="refresh">
          <IconifyIcon icon="lucide:refresh-cw" />
        </Button>
      </Tooltip>
      <Tooltip title="参数">
        <Button
          aria-label="生成参数"
          @click="
            showSettings = !showSettings;
            showHistory = false;
          "
        >
          <IconifyIcon icon="lucide:sliders-horizontal" />
        </Button>
      </Tooltip>
      <Tooltip v-if="current && writable" title="重命名">
        <Button aria-label="重命名会话" @click="rename">
          <IconifyIcon icon="lucide:pencil" />
        </Button>
      </Tooltip>
      <Tooltip v-if="current && writable" title="删除">
        <Button aria-label="删除会话" :disabled="locked" @click="remove">
          <IconifyIcon icon="lucide:trash-2" />
        </Button>
      </Tooltip>
    </div>
    <Alert v-if="pageError" type="error" :message="pageError" show-icon />
    <Alert
      v-if="pollingError"
      type="warning"
      :message="pollingError"
      show-icon
    />
    <div
      class="studio-layout"
      :class="{ 'show-history': showHistory, 'show-settings': showSettings }"
    >
      <aside class="history-pane">
        <Button v-if="writable" block @click="createSession">
          <template #icon><IconifyIcon icon="lucide:plus" /></template>{{ kind === 'chat' ? '新建对话' : '新建创作' }}
        </Button>
        <Input
          v-model:value="keyword"
          aria-label="搜索会话"
          placeholder="搜索会话"
          allow-clear
          @change="search()"
        />
        <nav aria-label="会话列表">
          <button
            v-for="session in sessions"
            :key="session.id"
            class="session-item"
            :class="{ selected: String(session.id) === String(current?.id) }"
            @click="open(session)"
          >
            <span>{{ session.title }}</span><small>{{
              new Date(Number(session.updated_at) * 1000).toLocaleDateString()
            }}</small>
          </button>
        </nav>
        <Empty
          v-if="!sessions.length"
          description="暂无历史记录"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
        <Button v-if="hasMore" @click="search(true)">加载更多</Button>
      </aside>
      <main class="creation-pane">
        <div ref="runList" class="run-list" aria-live="polite">
          <Spin v-if="loading" />
          <Empty
            v-else-if="!runs.length"
            :description="kind === 'chat' ? '暂无消息' : '暂无生成记录'"
          />
          <Button v-if="moreRuns" @click="loadMoreRuns">加载更早记录</Button>
          <article
            v-for="run in chronological"
            :key="run.id"
            class="generation"
            :data-run-id="run.id"
          >
            <header>
              <span>{{ run.upstream_model }}</span><Tag
                :color="
                  run.state === 'succeeded'
                    ? 'success'
                    : ['failed', 'unknown'].includes(run.state)
                      ? 'error'
                      : 'processing'
                "
              >
                {{ states[run.state] ?? run.state }}
</Tag><time>{{
                new Date(Number(run.created_at) * 1000).toLocaleString()
              }}</time>
            </header>
            <p class="user-prompt">{{ run.input.request.prompt }}</p>
            <div
              v-if="run.input.request.file_ids.length"
              class="attachment-list"
            >
              <FileRefPreview
                v-for="id in run.input.request.file_ids"
                :key="id"
                :value="id"
              />
            </div>
            <Markdown v-if="run.output_text" :text="run.output_text" />
            <div v-if="run.output_files.length" class="output-grid">
              <ResultFile
                v-for="id in run.output_files"
                :id="id"
                :key="id"
                :video="kind === 'video'"
              />
            </div>
            <Progress
              v-if="isActive(run.state) && kind !== 'chat'"
              :percent="run.progress"
              status="active"
            />
            <Spin v-else-if="isActive(run.state)" size="small" />
            <Alert
              v-if="runErrorText(run)"
              type="warning"
              :message="runErrorText(run)"
              show-icon
            />
            <footer class="run-actions">
              <Tooltip v-if="run.output_text" title="复制回答">
                <Button
                  size="small"
                  aria-label="复制回答"
                  @click="copy(run.output_text)"
                >
                  <IconifyIcon icon="lucide:copy" />
                </Button>
              </Tooltip>
              <Button size="small" @click="detailRun = run">
                <template #icon><IconifyIcon icon="lucide:info" /></template>详情
              </Button>
              <Button
                v-if="writable && !isActive(run.state)"
                size="small"
                @click="reuse(run)"
              >
                复用参数
              </Button>
              <Button
                v-if="
                  writable && !isActive(run.state) && run.state !== 'unknown'
                "
                size="small"
                :disabled="locked"
                @click="send(run)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:rotate-cw" />
</template>重新生成
              </Button>
              <Button
                v-if="writable && canResume(run)"
                size="small"
                @click="resume(run)"
              >
                恢复原任务
              </Button>
              <Button
                v-if="writable && isActive(run.state)"
                size="small"
                :disabled="run.cancel_requested"
                @click="cancel(run)"
              >
                <template #icon><IconifyIcon icon="lucide:square" /></template>{{ run.cancel_requested ? '正在停止' : '停止' }}
              </Button>
              <Button
                v-if="writable && run.state === 'unknown'"
                size="small"
                @click="cancel(run)"
              >
                结束待核实任务
              </Button>
              <span v-if="run.usage.total_tokens">{{ run.usage.total_tokens }} tokens</span>
            </footer>
          </article>
        </div>
        <form v-if="writable" class="composer" @submit.prevent="send()">
          <div class="composer-model">
            <Select
              v-model:value="selectedModel"
              aria-label="生成模型"
              show-search
              :options="modelOptions"
              placeholder="选择模型"
              @change="changeModel"
            /><Tag v-if="model?.capabilities.includes('input_image')">
              图片输入
</Tag><Tag v-if="model?.capabilities.includes('input_video')">
              视频输入
            </Tag>
          </div>
          <div v-if="fileIds.length" class="attachment-list">
            <FileRefPreview
              v-for="(id, index) in fileIds"
              :key="id"
              :value="id"
              removable
              @remove="fileIds.splice(index, 1)"
            />
          </div>
          <TextArea
            v-model:value="prompt"
            aria-label="创作内容"
            :maxlength="32000"
            :auto-size="{ minRows: 3, maxRows: 8 }"
            :placeholder="kind === 'chat' ? '输入消息' : '描述希望生成的内容'"
            @keydown.ctrl.enter.prevent="send()"
            @keydown.meta.enter.prevent="send()"
          />
          <div class="composer-actions">
            <Tooltip title="上传或选择图片、视频">
              <Button
                aria-label="添加素材"
                :disabled="!storage || !accepts(model, kind).length || locked"
                @click="picker?.open()"
              >
                <IconifyIcon icon="lucide:paperclip" />
              </Button>
</Tooltip><span>{{ fileIds.length ? `${fileIds.length} 个素材` : '' }}</span><Button
              type="primary"
              html-type="submit"
              :loading="sending"
              :disabled="locked || !prompt.trim() || !selectedModel || !storage"
            >
              <template #icon>
                <IconifyIcon
                  :icon="kind === 'chat' ? 'lucide:send' : 'lucide:sparkles'"
                />
</template>{{ kind === 'chat' ? '发送' : '生成' }}
            </Button>
          </div>
        </form>
      </main>
      <aside class="settings-pane">
        <h3>生成参数</h3>
        <label class="studio-field"><span>私有存储</span><Select
            v-model:value="storage"
            aria-label="私有存储"
            :options="storageOptions"
            placeholder="选择结果与素材存储"
        /></label>
        <template v-if="kind === 'chat'">
          <label class="studio-field"><span>系统指令</span><TextArea
              v-model:value="instructions"
              :maxlength="16000"
              :auto-size="{ minRows: 3, maxRows: 10 }"
          /></label>
          <label class="studio-field"><span>最大输出 Token</span><InputNumber
              v-model:value="options.max_tokens"
              :min="1"
              :max="32768"
              :precision="0"
          /></label>
          <label class="studio-field"><span>温度</span><InputNumber
              v-model:value="options.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              placeholder="模型默认"
          /></label>
        </template>
        <template v-else-if="kind === 'image' && model?.protocol !== 'gemini'">
          <label class="studio-field"><span>尺寸</span><Select
              v-model:value="options.size"
              allow-clear
              placeholder="模型默认"
              :options="
                [
                  '1024x1024',
                  '1536x1024',
                  '1024x1536',
                  '1792x1024',
                  '1024x1792',
                ].map((value) => ({ label: value, value }))
              "
          /></label>
          <label class="studio-field"><span>图片数量</span><InputNumber
              v-model:value="options.count"
              :min="1"
              :max="4"
              :precision="0"
          /></label>
          <label class="studio-field"><span>质量</span><Select
              v-model:value="options.quality"
              allow-clear
              placeholder="模型默认"
              :options="[
                { label: '低', value: 'low' },
                { label: '中', value: 'medium' },
                { label: '高', value: 'high' },
                { label: '标准', value: 'standard' },
                { label: '高清', value: 'hd' },
              ]"
          /></label>
        </template>
        <template v-else-if="kind === 'video'">
          <label class="studio-field"><span>时长</span><Select
              v-model:value="options.seconds"
              allow-clear
              placeholder="模型默认"
              :options="
                (model?.protocol === 'gemini'
                  ? [4, 6, 8]
                  : model?.protocol.endsWith('jimeng')
                    ? [5, 10]
                    : [4, 8, 12]
                ).map((value) => ({ label: `${value} 秒`, value }))
              "
          /></label>
          <label
            v-if="
              model?.protocol === 'gemini' || model?.protocol.endsWith('jimeng')
            "
            class="studio-field"
            ><span>画面比例</span><Select
              v-model:value="options.aspect_ratio"
              allow-clear
              placeholder="模型默认"
              :options="
                ['16:9', '9:16'].map((value) => ({ label: value, value }))
              "
          /></label>
          <label v-else class="studio-field"><span>尺寸</span><Select
              v-model:value="options.size"
              allow-clear
              placeholder="模型默认"
              :options="
                ['1280x720', '720x1280'].map((value) => ({
                  label: value,
                  value,
                }))
              "
          /></label>
        </template>
        <dl v-if="model && kind === 'chat'" class="price-info">
          <dt>估算单价 / 百万 Token</dt>
          <dd>输入 {{ model.input_price }} · 输出 {{ model.output_price }}</dd>
        </dl>
        <Empty
          v-if="!available.length"
          description="暂无可用模型"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
      </aside>
    </div>
    <FilePicker
      ref="picker"
      :multiple="kind !== 'video'"
      :max_count="kind === 'video' ? 1 : 8"
      :accept="accepts(model, kind)"
      :storage_code="storage"
      storage_locked
      :adapter="adapter"
      @confirm="selectFiles"
    />
    <Modal v-model:open="renameOpen" title="重命名会话" @ok="saveTitle">
      <Input
        v-model:value="renameTitle"
        :maxlength="100"
        aria-label="会话名称"
      />
    </Modal>
    <Modal
      :open="!!details"
      title="生成详情"
      :footer="null"
      @cancel="detailRun = undefined"
    >
      <dl v-if="details" class="run-details">
        <dt>模型</dt>
        <dd>{{ details.upstream_model }}</dd>
        <dt>状态</dt>
        <dd>{{ states[details.state] }}</dd>
        <template v-if="runErrorText(details)">
          <dt>失败原因</dt>
          <dd>{{ runErrorText(details) }}</dd>
          <dt>错误码</dt>
          <dd>{{ details.error_code || '未记录' }}</dd>
        </template>
        <dt>生成编号</dt>
        <dd>{{ details.id }}</dd>
        <dt>任务编号</dt>
        <dd>{{ details.task_run_id ?? '未调度' }}</dd>
        <dt>创建时间</dt>
        <dd>
          {{ new Date(Number(details.created_at) * 1000).toLocaleString() }}
        </dd>
        <dt>供应商任务编号</dt>
        <dd>{{ details.upstream_id || '未返回' }}</dd>
        <dt>用量</dt>
        <dd>
          {{
            details.usage.total_tokens
              ? `${details.usage.total_tokens} tokens`
              : '供应商未返回'
          }}
        </dd>
        <dt>系统指令</dt>
        <dd>{{ details.input.request.instructions || '无' }}</dd>
        <dt>提示词</dt>
        <dd>{{ details.input.request.prompt }}</dd>
      </dl>
    </Modal>
  </Page>
</template>

<style scoped>
.studio-toolbar {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  padding-bottom: 12px;
}

.studio-toolbar h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  white-space: nowrap;
}

.studio-layout {
  display: grid;
  flex: 1;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid hsl(var(--border));
}

.history-pane,
.settings-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  overflow: auto;
}

.history-pane {
  border-right: 1px solid hsl(var(--border));
}

.settings-pane {
  border-left: 1px solid hsl(var(--border));
}

.settings-pane h3 {
  margin: 0;
  font-size: 15px;
}

.history-pane nav {
  display: grid;
  gap: 4px;
}

.session-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  text-align: left;
  border-radius: 6px;
}

.session-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item small {
  font-size: 11px;
  opacity: 0.65;
}

.session-item:hover,
.session-item.selected {
  background: hsl(var(--accent));
}

.creation-pane {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
}

.run-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
  padding: 20px;
  overflow: auto;
}

.generation {
  display: grid;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid hsl(var(--border));
}

.generation header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.generation header > span {
  overflow-wrap: anywhere;
}

.generation time {
  margin-left: auto;
  opacity: 0.6;
}

.user-prompt {
  padding: 12px;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.run-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.run-actions > span {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.65;
}

.output-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 16px;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-list > * {
  max-width: 170px;
}

.composer .attachment-list {
  max-height: 96px;
  overflow-y: auto;
}

.composer {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid hsl(var(--border));
}

.composer-model,
.composer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.composer-model :deep(.ant-select) {
  flex: 1;
  min-width: 180px;
  max-width: 100%;
}

.composer-actions > span {
  flex: 1;
}

.studio-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.studio-field :deep(.ant-input-number) {
  width: 100%;
}

.price-info {
  font-size: 12px;
  line-height: 1.8;
  opacity: 0.75;
}

.run-details {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 10px;
}

.run-details dd {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

@media (max-width: 1200px) {
  .studio-layout {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .settings-pane {
    display: none;
  }

  .show-settings .settings-pane {
    display: flex;
    grid-row: 1;
    grid-column: 1 / -1;
    max-height: 360px;
    border-bottom: 1px solid hsl(var(--border));
  }

  .show-settings {
    grid-template-rows: minmax(120px, 30%) minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .studio-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .history-pane {
    display: none;
  }

  .show-history .history-pane {
    display: flex;
    max-height: 280px;
    border-bottom: 1px solid hsl(var(--border));
  }

  .show-history,
  .show-settings {
    grid-template-rows: minmax(120px, 30%) minmax(0, 1fr);
  }

  .run-list,
  .composer {
    padding: 12px;
  }

  .studio-toolbar {
    flex-wrap: wrap;
  }

  .studio-toolbar h2 {
    min-width: 90px;
    font-size: 16px;
  }
}
</style>
