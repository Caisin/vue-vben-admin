<script setup lang="ts">
import type { TextEncoding } from './novel-txt';

import type { Id, NovelChapter, NovelImportView } from '#/api/res/versions';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Table,
} from 'antdv-next';

import { NovelImportApi } from '#/api/res/versions';
import { requestErrorMessage } from '#/request-errors';

import { prepareNovelFile } from './novel-txt';
const props = defineProps<{ res: Id; resourceType?: string }>();
const emit = defineEmits<{ complete: [id: Id] }>();
function importError(error: unknown, fallback: string) {
  return requestErrorMessage(
    error,
    error instanceof Error ? error.message : fallback,
  );
}
const open = ref(false);
const busy = ref(false);
const errorText = ref('');
const name = ref('');
const remark = ref('');
const encoding = ref<TextEncoding>('auto');
const detected = ref('');
const file = ref<File>();
const fileInput = ref<HTMLInputElement>();
const chapters = ref<NovelChapter[]>([]);
const warnings = ref<string[]>([]);
const selected = ref(0);
const job = ref<NovelImportView>();
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let requestKey = crypto.randomUUID();
let notified = '';
const current = computed(() => chapters.value[selected.value]);
const active = computed(
  () =>
    !!job.value &&
    !job.value.version_id &&
    !job.value.dispatch_error &&
    !['cancelled', 'failed', 'partially_succeeded', 'skipped'].includes(
      job.value.task_run?.status ?? 'queued',
    ),
);
const canSubmit = computed(
  () =>
    !!name.value.trim() &&
    chapters.value.length > 0 &&
    chapters.value.every((c) => c.title.trim() && c.content.trim()) &&
    !busy.value &&
    !active.value &&
    !job.value?.version_id,
);
const rows = computed(() =>
  chapters.value.map((c, index) => ({
    index,
    title: c.title,
    characters: c.content.length,
  })),
);
function stop() {
  generation++;
  if (timer) clearTimeout(timer);
}
function accept(result: NovelImportView) {
  job.value = result;
  if (result.version_id && notified !== String(result.id)) {
    notified = String(result.id);
    emit('complete', result.version_id);
  }
}
async function poll(epoch: number) {
  if (!job.value || epoch !== generation || !open.value || !active.value)
    return;
  try {
    const value = await NovelImportApi.get(props.res, job.value.id);
    if (epoch !== generation) return;
    accept(value);
    errorText.value = '';
  } catch (error) {
    if (epoch === generation)
      errorText.value = importError(error, '进度读取失败，请点击刷新进度');
  }
  if (epoch === generation && active.value && !errorText.value)
    timer = setTimeout(() => void poll(epoch), 1500);
}
async function refreshJob() {
  stop();
  errorText.value = '';
  if (job.value && active.value) await poll(generation);
}
async function show() {
  open.value = true;
  stop();
  busy.value = true;
  errorText.value = '';
  const epoch = generation;
  try {
    const latest = await NovelImportApi.latest(props.res);
    if (epoch !== generation) return;
    if (latest) {
      accept(latest);
      if (active.value) void poll(epoch);
    }
  } catch (error) {
    errorText.value = importError(error, '读取导入任务失败');
  } finally {
    if (epoch === generation) busy.value = false;
  }
}
async function parseFile() {
  if (!file.value || active.value) return;
  const source = file.value;
  const resource = props.res;
  busy.value = true;
  errorText.value = '';
  chapters.value = [];
  warnings.value = [];
  selected.value = 0;
  requestKey = crypto.randomUUID();
  const epoch = generation;
  try {
    const decoded = await prepareNovelFile(source, encoding.value);
    if (epoch !== generation) return;
    const result = await NovelImportApi.parse(resource, {
      file_name: source.name,
      content: decoded.content,
      file_base64: decoded.file_base64,
    });
    if (epoch !== generation) return;
    chapters.value = result.chapters;
    warnings.value = result.warnings;
    detected.value = decoded.encoding;
  } catch (error) {
    if (epoch === generation)
      errorText.value = importError(error, '解析失败，请检查文件和编码');
  } finally {
    if (epoch === generation) busy.value = false;
  }
}
async function choose(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = '';
  if (!selected) return;
  if (
    !['.txt', '.docx'].some((ext) =>
      selected.name.toLowerCase().endsWith(ext),
    ) ||
    selected.size > 10 * 1024 * 1024
  ) {
    errorText.value = '请选择不超过 10 MB 的 TXT 或 Word 文件';
    return;
  }
  file.value = selected;
  if (!name.value)
    name.value = selected.name.replace(/\.(?:txt|docx)$/i, '').slice(0, 100);
  job.value = undefined;
  await parseFile();
}
async function submit() {
  if (!canSubmit.value) return;
  if (
    job.value &&
    ['cancelled', 'failed', 'partially_succeeded', 'skipped'].includes(
      job.value.task_run?.status ?? '',
    )
  )
    requestKey = crypto.randomUUID();
  busy.value = true;
  errorText.value = '';
  const epoch = generation;
  try {
    const result = await NovelImportApi.submit(props.res, {
      request_key: requestKey,
      name: name.value,
      remark: remark.value,
      chapters: chapters.value,
    });
    if (epoch !== generation) return;
    accept(result);
    if (result.dispatch_error) errorText.value = result.dispatch_error;
    else void poll(epoch);
  } catch (error) {
    if (epoch === generation)
      errorText.value = importError(error, '提交失败，解析内容已保留，可重试');
  } finally {
    if (epoch === generation) busy.value = false;
  }
}
watch([name, remark], () => {
  requestKey = crypto.randomUUID();
});
watch(open, (value) => {
  if (!value) stop();
});
watch(
  () => props.res,
  () => {
    stop();
    open.value = false;
    file.value = undefined;
    chapters.value = [];
    job.value = undefined;
    name.value = '';
    remark.value = '';
  },
);
onBeforeUnmount(stop);
</script>
<template>
  <Button type="primary" @click="show">导入 TXT / Word 生成版本</Button>
  <Modal
    v-model:open="open"
    :title="`导入${resourceType === 'script' ? '剧本' : '小说'} TXT / Word · 生成新版本`"
    :width="1080"
    :z-index="950"
    :style="{ top: '4vh' }"
    :styles="{ body: { maxHeight: '70vh', overflowY: 'auto' } }"
    :mask-closable="!busy"
    :closable="!busy"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Alert
      v-if="job"
      :type="
        job.version_id
          ? 'success'
          : job.dispatch_error ||
              ['failed', 'cancelled'].includes(job.task_run?.status ?? '')
            ? 'error'
            : 'info'
      "
      class="mb-4"
      :message="
        job.version_id
          ? `版本「${job.name}」已生成，共 ${job.chapter_count} 章`
          : job.dispatch_error ||
            (active
              ? `正在生成「${job.name}」，共 ${job.chapter_count} 章；关闭窗口不影响任务`
              : '生成失败，原版本未修改，请检查后重试')
      "
    />
    <Button v-if="active" :disabled="busy" class="mb-3" @click="refreshJob">
      刷新进度
    </Button>
    <div class="import-intro">
      <span class="import-step">1</span>
      <div>
        <strong>选择整本{{ resourceType === 'script' ? '剧本' : '小说' }}</strong>
        <p>自动识别章节标题；先检查目录和正文，再创建独立版本。</p>
      </div>
    </div>
    <div class="my-4 flex flex-wrap items-center gap-3">
      <Button :disabled="busy || active" @click="fileInput?.click()">
        选择 TXT / Word 文件
      </Button>
      <input
        ref="fileInput"
        class="hidden"
        type="file"
        accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        :aria-label="`选择整本${resourceType === 'script' ? '剧本' : '小说'} TXT / Word`"
        :disabled="busy || active"
        @change="choose"
      />
      <Select
        v-model:value="encoding"
        aria-label="TXT 编码"
        :disabled="busy || active"
        class="min-w-36"
        :options="[
          { value: 'auto', label: '自动识别编码' },
          { value: 'utf8', label: 'UTF-8' },
          { value: 'gb18030', label: 'GB18030 / GBK' },
          { value: 'utf-16le', label: 'UTF-16 LE' },
          { value: 'utf-16be', label: 'UTF-16 BE' },
        ]"
      />
      <Button :disabled="!file || active" :loading="busy" @click="parseFile">
        重新解析
      </Button>
      <span v-if="file" class="text-sm text-muted-foreground">{{ file.name }} · {{ detected }}</span>
    </div>
    <Alert
      v-for="warning in warnings"
      :key="warning"
      type="warning"
      :message="warning"
      class="mb-2"
    />
    <div v-if="chapters.length" class="import-review">
      <div>
        <strong>解析目录 · {{ chapters.length }} 章</strong><Table
          :data-source="rows"
          row-key="index"
          size="small"
          :pagination="{ pageSize: 10 }"
          :columns="[
            { title: '章节标题', key: 'title' },
            { title: '字符数', dataIndex: 'characters', width: 90 },
          ]"
          class="mt-3"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.key === 'title'"
              type="link"
              @click="selected = record.index"
            >
              {{ record.index + 1 }}. {{ record.title }}
            </Button>
          </template>
        </Table>
      </div>
      <article class="import-body" aria-label="导入正文预览">
        <h3>{{ current?.title }}</h3>
        <p>{{ current?.content || '此章没有正文，请调整文件后重新解析' }}</p>
      </article>
    </div>
    <div class="import-intro mt-5">
      <span class="import-step">2</span>
      <div>
        <strong>保存为新版本</strong>
        <p>现有版本及其章节保持不变，生成完成后自动选中新版本。</p>
      </div>
    </div>
    <Form layout="vertical" class="mt-4">
      <FormItem label="新版本名称" required>
        <Input
          v-model:value="name"
          aria-label="新版本名称"
          :maxlength="100"
          :disabled="busy || active"
          placeholder="例如：精修版、第二次修订"
        />
</FormItem><FormItem label="版本差异备注">
        <Input.TextArea
          v-model:value="remark"
          aria-label="导入版本差异备注"
          :rows="2"
          :maxlength="4000"
          :disabled="busy || active"
          placeholder="说明本次导入与其他版本的差异"
        />
      </FormItem>
    </Form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button :disabled="busy" @click="open = false">关闭</Button><Button
          type="primary"
          :disabled="!canSubmit"
          :loading="busy"
          @click="submit"
        >
          确认章节并生成版本
        </Button>
      </div>
    </template>
  </Modal>
</template>
<style scoped>
.import-intro {
  display: flex;
  gap: 12px;
  align-items: center;
}

.import-intro p {
  margin-top: 4px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.import-step {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--accent));
  border-radius: 50%;
}

.import-review {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 20px;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.import-body {
  max-height: 360px;
  padding: 20px;
  overflow: auto;
  overflow-wrap: anywhere;
  background: hsl(var(--muted) / 35%);
}

.import-body h3 {
  margin-bottom: 16px;
  font-weight: 600;
}

.import-body p {
  line-height: 1.9;
  white-space: pre-wrap;
}

@media (max-width: 767px) {
  .import-review {
    grid-template-columns: minmax(0, 1fr);
    padding: 12px;
  }

  .import-body {
    max-height: 240px;
  }
}
</style>
