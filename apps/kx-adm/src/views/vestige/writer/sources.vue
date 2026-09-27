<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type { UploadState, WriterSource } from '#/api/vestige/writer';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Input, message, Modal, Table, Tag } from 'antdv-next';

import { WriterApi } from '#/api/vestige/writer';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import { useRoleConfirmation } from '../confirmation';
import EvidenceView from './evidence.vue';
const props = defineProps<{ access: RoleAccess }>();
const emit = defineEmits<{ changed: []; task: [] }>();
const canContribute = computed(() => props.access.permission !== 'viewer');
const manage = computed(() => props.access.permission === 'owner');
const rows = ref<WriterSource[]>([]);
const uploads = ref<UploadState[]>([]);
const loading = ref(false);
const errorText = ref('');
const page = ref(0);
const more = ref(false);
const selected = ref<string>();
const preview = ref(false);
const uploadOpen = ref(false);
const file = ref<File>();
const title = ref('');
const author = ref('');
const episode = ref('');
const requestKey = ref('');
const saving = ref(false);
let generation = 0;
const confirm = useRoleConfirmation(() => [
  props.access.role.id,
  props.access.permission,
]);
const states: Record<string, string> = {
  queued: '等待解析',
  processing: '已领取，尚未提交',
  completed: '已入库',
  failed: '解析失败',
  cancelled: '已取消',
};
const errors: Record<string, string> = {
  TEXT_ENCODING: '请转为 UTF-8 后重新上传',
  NO_TEXT: '未提取到文字；扫描件请先 OCR',
  INVALID_DOCX: 'DOCX 文件损坏',
  INVALID_PDF: 'PDF 无法解析',
  PARSE_LIMIT: '正文或页数超过限制，请分卷上传',
  DISPATCH_FAILED: '任务派发失败，可重试',
  AUTHORIZATION_OR_LEASE_CHANGED: '授权或执行权发生变化',
  CORRUPTED_UPLOAD: '暂存校验失败，请取消后重传',
};
async function load() {
  const current = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await WriterApi.sources(
      props.access.role.id,
      page.value * 25,
    );
    if (current === generation) {
      more.value = result.sources.length > 25;
      rows.value = result.sources.slice(0, 25);
    }
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '素材列表加载失败');
  } finally {
    if (current === generation) loading.value = false;
  }
}
const polling = useTaskPolling({
  load: () => WriterApi.uploads(props.access.role.id),
  delay: 2500,
  async accept(value) {
    const previous = new Map(uploads.value.map((v) => [v.id, v.state]));
    uploads.value = value.slice(0, 25);
    if (
      value.some(
        (v) => v.state === 'completed' && previous.get(v.id) !== 'completed',
      )
    ) {
      await load();
      emit('changed');
    }
  },
  onError(error) {
    errorText.value = requestErrorMessage(error, '上传记录查询失败');
    polling.stop();
  },
});
function choose(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0];
  if (file.value) {
    title.value = file.value.name;
    requestKey.value = crypto.randomUUID();
  }
  input.value = '';
}
async function upload() {
  if (!file.value || !canContribute.value || saving.value) return;
  if (file.value.size > 50 * 1024 * 1024) {
    message.error('文件超过 50 MiB，请分卷上传');
    return;
  }
  saving.value = true;
  const role = props.access.role.id;
  try {
    await WriterApi.upload(
      role,
      file.value,
      title.value.trim(),
      author.value.trim(),
      episode.value.trim(),
      requestKey.value,
    );
    if (role !== props.access.role.id) return;
    uploadOpen.value = false;
    file.value = undefined;
    message.success('已上传，解析完成后将进入素材列表');
    polling.start();
  } catch (error) {
    message.error(
      requestErrorMessage(error, '上传未完成，可在上传记录中确认并重试'),
    );
    polling.start();
  } finally {
    saving.value = false;
  }
}
async function retry(record: UploadState) {
  try {
    await WriterApi.retryUpload(props.access.role.id, record.id);
    message.success('已提交解析任务');
    polling.start();
  } catch (error) {
    message.error(requestErrorMessage(error, '重试失败'));
  }
}
async function cancel(record: UploadState) {
  try {
    await WriterApi.cancelUpload(props.access.role.id, record.id);
    polling.start();
  } catch (error) {
    message.error(requestErrorMessage(error, '取消失败'));
  }
}
function remove(source: WriterSource) {
  const role = props.access.role.id;
  confirm({
    cancelText: '取消',
    title: `删除素材“${source.title}”？`,
    content: '已被提炼任务或规则引用的素材会拒绝删除。删除不会撤销已发布规则。',
    okText: '删除素材',
    okButtonProps: { danger: true },
    async onOk() {
      try {
        await WriterApi.removeSource(role, source.id);
        if (role === props.access.role.id) {
          await load();
          emit('changed');
        }
      } catch (error) {
        message.error(requestErrorMessage(error, '删除失败'));
        throw error;
      }
    },
  });
}
async function extract() {
  if (!canContribute.value || saving.value) return;
  saving.value = true;
  try {
    await WriterApi.extract(props.access.role.id);
    message.success('已排队，等待外部 Agent 提炼');
    emit('task');
  } catch (error) {
    message.error(requestErrorMessage(error, '提炼任务提交失败'));
  } finally {
    saving.value = false;
  }
}
watch(
  () => props.access.role.id,
  () => {
    generation++;
    page.value = 0;
    rows.value = [];
    uploads.value = [];
    preview.value = false;
    uploadOpen.value = false;
    file.value = undefined;
    void load();
    polling.start();
  },
  { immediate: true },
);
watch([title, author, episode], () => {
  requestKey.value = crypto.randomUUID();
});
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Alert
    type="info"
    message="先上传作品与知识，再交给已连接的 Agent 提炼。候选规则需要审核采纳才会生效。"
    class="mb-4"
  />
  <div class="mb-3 flex flex-wrap gap-2">
    <Button v-if="canContribute" type="primary" @click="uploadOpen = true">
      上传剧本素材
    </Button>
    <Button
      v-if="canContribute"
      :disabled="saving || !rows.length"
      @click="extract"
    >
      提交提炼任务
    </Button>
    <Button
      :loading="loading"
      @click="
        load();
        polling.start();
      "
    >
      刷新素材
    </Button>
  </div>
  <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
  <Table
    :data-source="rows"
    row-key="id"
    :loading="loading"
    :pagination="false"
    :scroll="{ x: 540 }"
    size="small"
    :columns="[
      { title: '作品/知识', key: 'title' },
      { title: '格式', dataIndex: 'format' },
      { title: '段落', dataIndex: 'segment_count' },
      { title: '操作', key: 'actions' },
    ]"
  >
    <template #bodyCell="{ column, record }">
      <Button
        v-if="column.key === 'title'"
        type="link"
        @click="
          selected = record.id;
          preview = true;
        "
      >
        {{ record.title }}
      </Button>
      <template v-else-if="column.key === 'actions'">
        <Button
          type="link"
          @click="
            selected = record.id;
            preview = true;
          "
        >
          查看原文
        </Button>
        <Button v-if="manage" type="link" danger @click="remove(record)">
          删除
        </Button>
      </template>
    </template>
  </Table>
  <div class="my-3 flex justify-between">
    <Button
      :disabled="loading || page === 0"
      @click="
        page--;
        load();
      "
    >
      上一页
    </Button>
    <span>第 {{ page + 1 }} 页</span>
    <Button
      :disabled="loading || !more"
      @click="
        page++;
        load();
      "
    >
      下一页
    </Button>
  </div>
  <details class="mt-4">
    <summary class="cursor-pointer">最近上传与解析记录</summary>
    <p class="my-2 text-xs text-muted-foreground">
      显示最近 25 条。未完成的上传可重试确认执行状态，或取消清除暂存内容。
    </p>
    <div v-for="item in uploads" :key="item.id" class="border-b py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span>
          {{
            item.title ||
            item.filename ||
            (item.source_deleted ? '来源已删除' : '已清除暂存')
          }}
        </span>
        <Tag>{{ states[item.state] || item.state }}</Tag>
        <Tag v-if="item.duplicate">引用已有素材</Tag>
      </div>
      <p v-if="item.error_code" class="my-2 text-sm text-red-500">
        {{ errors[item.error_code] || item.error_code }}
      </p>
      <Button v-if="item.can_retry" size="small" @click="retry(item)">
        重试解析
      </Button>
      <Button v-if="item.can_cancel" size="small" @click="cancel(item)">
        取消上传
      </Button>
    </div>
  </details>
  <Modal
    v-model:open="uploadOpen"
    title="上传剧本素材"
    ok-text="上传并解析"
    :confirm-loading="saving"
    :closable="!saving"
    :keyboard="!saving"
    :mask-closable="!saving"
    :ok-button-props="{ disabled: !file || !title.trim() }"
    @ok="upload"
  >
    <p class="mb-3 text-sm text-muted-foreground">
      支持 UTF-8 TXT/Markdown/Fountain、FDX、DOCX 和文本 PDF。原文件不超过 50
      MiB；扫描 PDF 请先 OCR。
    </p>
    <input
      type="file"
      accept=".txt,.md,.fountain,.fdx,.docx,.pdf"
      aria-label="剧本文件"
      :disabled="saving"
      @change="choose"
    />
    <p class="my-2">{{ file?.name }}</p>
    <label for="writer-source-title" class="mb-2 block">作品名称</label>
    <Input
      id="writer-source-title"
      v-model:value="title"
      :disabled="saving"
      :maxlength="180"
    />
    <label for="writer-source-author" class="mb-2 mt-3 block">
      作者（选填，由上传者注明）
    </label>
    <Input
      id="writer-source-author"
      v-model:value="author"
      :disabled="saving"
      :maxlength="100"
    />
    <label for="writer-source-episode" class="mb-2 mt-3 block">
      篇章 / 集数（选填）
    </label>
    <Input
      id="writer-source-episode"
      v-model:value="episode"
      :disabled="saving"
      :maxlength="100"
    />
  </Modal>
  <EvidenceView
    v-model:open="preview"
    :role-id="access.role.id"
    :source-id="selected"
  />
</template>
