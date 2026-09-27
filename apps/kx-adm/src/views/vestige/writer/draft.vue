<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type {
  DraftSummary,
  WriterDraft,
  WriterProject,
  WriterReview,
} from '#/api/vestige/projects';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { downloadFileFromBlob } from '@vben/utils';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { ProjectApi } from '#/api/vestige/projects';
import { requestErrorMessage } from '#/request-errors';

import { useRoleConfirmation } from '../confirmation';
const props = defineProps<{
  open: boolean;
  access: RoleAccess;
  project: WriterProject;
  summary?: DraftSummary;
  refreshKey: number;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; changed: []; task: [] }>();
const draft = ref<WriterDraft>();
const title = ref('');
const content = ref('');
const selectedRevision = ref(1);
const latest = ref(1);
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const editing = ref(false);
const tab = ref('text');
const reviews = ref<WriterReview[]>([]);
const reviewPage = ref(0);
const reviewMore = ref(false);
const reviewOpen = ref(false);
const requirements = ref('');
let generation = 0;
const confirm = useRoleConfirmation(() => [
  props.access.role.id,
  props.access.permission,
  props.summary?.id,
  props.open,
]);
let draftRequest = 0;
let reviewRequest = 0;
const reviewsLoading = ref(false);
const canWrite = computed(() => props.access.permission !== 'viewer');
const writable = computed(
  () =>
    canWrite.value &&
    draft.value?.revision === latest.value &&
    draft.value.role_version === props.project.role_version,
);
async function load(revision?: number) {
  if (!props.summary) return;
  const current = generation;
  const request = ++draftRequest;
  loading.value = true;
  errorText.value = '';
  editing.value = false;
  try {
    const result = await ProjectApi.draft(
      props.access.role.id,
      props.summary.id,
      revision,
    );
    if (current !== generation || request !== draftRequest) return;
    draft.value = result.draft;
    selectedRevision.value = result.draft.revision;
    if (revision === undefined) latest.value = result.draft.revision;
    title.value = result.draft.title;
    content.value = result.draft.content;
  } catch (error) {
    if (current === generation && request === draftRequest)
      errorText.value = requestErrorMessage(error, '草稿读取失败');
  } finally {
    if (current === generation && request === draftRequest)
      loading.value = false;
  }
}
async function loadReviews() {
  if (!props.summary) return;
  const current = generation;
  const request = ++reviewRequest;
  reviewsLoading.value = true;
  try {
    const result = await ProjectApi.reviews(
      props.access.role.id,
      props.summary.id,
      reviewPage.value * 15,
    );
    if (current === generation && request === reviewRequest) {
      reviews.value = result.reviews.slice(0, 15);
      reviewMore.value = result.reviews.length > 15;
    }
  } catch (error) {
    if (current === generation && request === reviewRequest)
      errorText.value = requestErrorMessage(error, '审稿意见读取失败');
  } finally {
    if (current === generation && request === reviewRequest)
      reviewsLoading.value = false;
  }
}
function setEditing(value: boolean) {
  title.value = draft.value?.title ?? '';
  content.value = draft.value?.content ?? '';
  editing.value = value;
}
function close() {
  if (!editing.value) {
    emit('update:open', false);
    return;
  }
  confirm({
    title: '放弃未保存的草稿编辑？',
    okText: '放弃并关闭',
    cancelText: '继续编辑',
    onOk() {
      emit('update:open', false);
    },
  });
}
async function save() {
  const original = draft.value;
  if (!original || !writable.value || saving.value || loading.value) return;
  if (!title.value.trim() || !content.value.trim()) {
    message.error('请填写标题与正文');
    return;
  }
  if (new TextEncoder().encode(content.value).length > 160 * 1024) {
    message.error('草稿过长，请分集或分场保存');
    return;
  }
  const current = generation;
  saving.value = true;
  try {
    const result = await ProjectApi.save(
      props.access.role.id,
      original,
      title.value.trim(),
      content.value,
    );
    if (current !== generation) return;
    draft.value = result.draft;
    latest.value = result.draft.revision;
    selectedRevision.value = result.draft.revision;
    editing.value = false;
    message.success('已保存为新的草稿修订');
    emit('changed');
  } catch (error) {
    message.error(
      requestErrorMessage(
        error,
        '草稿或项目已变化，请保留当前文本，读取最新版本后重试',
      ),
    );
  } finally {
    saving.value = false;
  }
}
async function review() {
  if (!draft.value || !writable.value || saving.value || loading.value) return;
  saving.value = true;
  try {
    await ProjectApi.review(
      props.access.role.id,
      props.project,
      draft.value,
      requirements.value.trim(),
    );
    reviewOpen.value = false;
    message.success('审稿任务已排队，等待 Agent');
    emit('task');
  } catch (error) {
    message.error(
      requestErrorMessage(error, '草稿可能已更新，请读取最新修订后重试'),
    );
  } finally {
    saving.value = false;
  }
}
function exportText() {
  if (!draft.value) return;
  downloadFileFromBlob({
    source: new Blob([editing.value ? content.value : draft.value.content], {
      type: 'text/plain;charset=utf-8',
    }),
    fileName: `${draft.value.title.replaceAll(/[\\/:*?"<>|]/g, '-')}-r${draft.value.revision}.txt`,
  });
}
watch(
  () => [props.open, props.access.role.id, props.summary?.id],
  () => {
    generation++;
    draft.value = undefined;
    reviews.value = [];
    reviewPage.value = 0;
    reviewMore.value = false;
    reviewsLoading.value = false;
    editing.value = false;
    tab.value = 'text';
    reviewOpen.value = false;
    if (props.open) {
      void load();
    }
  },
  { immediate: true },
);
watch(
  () => props.refreshKey,
  () => {
    if (props.open && !editing.value) {
      void loadReviews();
    }
  },
);
watch(tab, (value) => {
  if (value === 'reviews') void loadReviews();
});
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Modal
    :open="open"
    :title="draft?.title || '草稿详情'"
    :footer="null"
    width="min(900px, 100vw)"
    :closable="!saving"
    :mask-closable="!saving"
    :keyboard="!saving"
    @cancel="close"
  >
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <template v-if="draft">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <Tag>草稿修订 r{{ draft.revision }}</Tag>
        <Tag>规则 v{{ draft.role_version }}</Tag>
        <Button
          size="small"
          :disabled="loading || saving || editing"
          @click="load()"
        >
          读取最新修订
        </Button>
        <Button size="small" @click="exportText">导出文本</Button>
      </div>
      <Alert
        v-if="draft.role_version !== project.role_version"
        type="info"
        class="mb-3"
        message="这份草稿使用旧规则版本。可以查看、导出和阅读原审稿；请通过当前项目创建新写作任务。"
      />
      <div class="mb-3 flex items-center gap-2">
        <label for="writer-draft-revision">查看历史修订</label>
        <InputNumber
          id="writer-draft-revision"
          v-model:value="selectedRevision"
          :min="1"
          :max="latest"
          :precision="0"
          :disabled="editing || saving"
        />
        <Button
          :disabled="editing || saving || loading"
          @click="load(selectedRevision)"
        >
          读取
        </Button>
      </div>
      <Tabs v-model:active-key="tab">
        <TabPane key="text" tab="剧本正文">
          <template v-if="editing">
            <Input
              v-model:value="title"
              aria-label="草稿标题"
              :maxlength="90"
              :disabled="saving"
              class="mb-3"
            />
            <Input.TextArea
              v-model:value="content"
              aria-label="草稿正文"
              :rows="18"
              :disabled="saving"
            />
            <div class="mt-3 flex gap-2">
              <Button type="primary" :loading="saving" @click="save">
                保存新修订
              </Button>
              <Button :disabled="saving" @click="setEditing(false)">
                放弃本次编辑
              </Button>
            </div>
          </template>
          <template v-else>
            <pre
              class="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded border p-4 font-sans"
              >{{ draft.content }}</pre>
            <div class="mt-3 flex gap-2">
              <Button
                v-if="writable"
                :disabled="loading"
                @click="setEditing(true)"
              >
                编辑为新修订
              </Button>
              <Button
                v-if="
                  canWrite &&
                  draft.revision === latest &&
                  draft.role_version === project.role_version
                "
                type="primary"
                @click="
                  requirements = '';
                  reviewOpen = true;
                "
              >
                提交审稿任务
              </Button>
            </div>
          </template>
        </TabPane>
        <TabPane key="reviews" tab="审稿意见">
          <p class="mb-3 text-sm text-muted-foreground">
            意见只适用于标注的草稿修订。修改后的正文需要重新审稿。
          </p>
          <p
            v-if="!reviews.length && !reviewsLoading"
            class="text-muted-foreground"
          >
            暂无审稿意见。
          </p>
          <article
            v-for="item in reviews"
            :key="item.id"
            class="mb-4 border-b pb-4"
          >
            <Tag
              :color="
                item.draft_revision === draft.revision ? 'blue' : 'default'
              "
            >
              审阅 r{{ item.draft_revision
              }}{{
                item.draft_revision === draft.revision ? '' : ' · 历史修订'
              }}
            </Tag>
            <p class="my-3 whitespace-pre-wrap">{{ item.summary }}</p>
            <div
              v-for="(finding, index) in item.findings"
              :key="index"
              class="mb-3 border-l-2 pl-3"
            >
              <Tag
                :color="
                  finding.severity === 'error'
                    ? 'red'
                    : finding.severity === 'warning'
                      ? 'orange'
                      : 'blue'
                "
              >
                {{
                  finding.severity === 'error'
                    ? '问题'
                    : finding.severity === 'warning'
                      ? '建议关注'
                      : '提示'
                }}
              </Tag>
              <blockquote class="my-2 whitespace-pre-wrap">
                {{ finding.quote }}
              </blockquote>
              <p>{{ finding.issue }}</p>
              <p class="mt-1">修改建议：{{ finding.suggestion }}</p>
            </div>
          </article>
          <div class="flex justify-between">
            <Button
              :disabled="reviewsLoading || reviewPage === 0"
              @click="
                reviewPage--;
                loadReviews();
              "
            >
              上一页
            </Button>
            <Button
              :disabled="reviewsLoading || !reviewMore"
              @click="
                reviewPage++;
                loadReviews();
              "
            >
              下一页
            </Button>
          </div>
        </TabPane>
      </Tabs>
    </template>
  </Modal>
  <Modal
    v-model:open="reviewOpen"
    title="提交审稿任务"
    ok-text="提交给 Agent"
    :confirm-loading="saving"
    :closable="!saving"
    :mask-closable="!saving"
    @ok="review"
  >
    <p class="mb-3">
      固定审阅当前草稿 r{{
        draft?.revision
      }}。任务执行期间若正文变化，旧结果不能覆盖新修订。
    </p>
    <Input.TextArea
      v-model:value="requirements"
      aria-label="审稿要求"
      :maxlength="3000"
      :rows="4"
      placeholder="例如：重点检查人物动机、冲突递进与结尾悬念。"
    />
  </Modal>
</template>
