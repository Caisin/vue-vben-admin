<script setup lang="ts">
import type {
  NoteState,
  ReviewNote,
  ReviewState,
  ReviewView,
} from '#/api/res/review';
import type { Id, ResourceVersion } from '#/api/res/versions';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Spin,
  Tag,
  TextArea,
} from 'antdv-next';

import { reviewApi as api, noteLabels, reviewLabels } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';

import ReviewBatchUpload from './review-batch-upload.vue';
import ReviewDingtalk from './review-dingtalk.vue';
import ReviewGuide from './review-guide.vue';
import ReviewMembers from './review-members.vue';
const props = defineProps<{ res: Id; name: string; initialVersion?: Id }>();
const versions = ref<ResourceVersion[]>([]);
const versionId = ref<Id>();
const view = ref<ReviewView>();
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const success = ref('');
const seq = ref(1);
const search = ref('');
const filter = ref('all');
const noteFilter = ref('all');
const planned = ref(1);
const url = ref('');
const mediaError = ref('');
const player = ref<HTMLVideoElement>();
const drafts = reactive<
  Record<string, { body: string; kind: string; position_ms: number }>
>({});
watch(
  () => [versionId.value, seq.value],
  () => {
    drafts[`${versionId.value}/${seq.value}`] ??= {
      body: '',
      kind: 'suggestion',
      position_ms: 0,
    };
  },
  { immediate: true, flush: 'sync' },
);
const draft = computed(
  () =>
    drafts[`${versionId.value}/${seq.value}`] ?? {
      body: '',
      kind: 'suggestion',
      position_ms: 0,
    },
);
const version = computed(() => view.value?.detail.version);
const editable = computed(() =>
  ['draft', 'reviewing'].includes(version.value?.review_state ?? ''),
);
const item = computed(() =>
  view.value?.detail.items.find((v) => Number(v.seq_no) === seq.value),
);
const pending = computed(
  () =>
    view.value?.notes.filter(
      (n) => n.kind === 'suggestion' && n.state !== 'resolved',
    ) ?? [],
);
const count = computed(() =>
  Math.max(
    Number(version.value?.planned_episodes || 0),
    ...(view.value?.detail.items.map((i) => Number(i.seq_no)) ?? [0]),
    1,
  ),
);
const episodes = computed(() =>
  Array.from({ length: Math.min(count.value, 1000) }, (_, i) => {
    const no = i + 1;
    const row = view.value?.detail.items.find((v) => Number(v.seq_no) === no);
    return {
      no,
      title: row?.title || `第 ${no} 集`,
      uploaded: Boolean(row?.link),
      pending: pending.value.filter((n) => Number(n.seq_no) === no).length,
    };
  }).filter(
    (r) =>
      `${r.no} ${r.title}`.includes(search.value.trim()) &&
      (filter.value === 'all' ||
        (filter.value === 'pending' ? r.pending > 0 : !r.uploaded)),
  ),
);
const notes = computed(
  () =>
    view.value?.notes.filter(
      (n) =>
        Number(n.seq_no) === seq.value &&
        (noteFilter.value === 'all' ||
          (noteFilter.value === 'comment'
            ? n.kind === 'comment'
            : n.kind === 'suggestion' && n.state !== 'resolved')),
    ) ?? [],
);
const uploaded = computed(
  () =>
    Number(version.value?.planned_episodes) > 0 &&
    view.value?.detail.items.length ===
      Number(version.value?.planned_episodes) &&
    Array.from(
      { length: Number(version.value?.planned_episodes) },
      (_, i) => i + 1,
    ).every((no) =>
      view.value?.detail.items.some(
        (v) =>
          Number(v.seq_no) === no && /^storage:file:[1-9]\d*$/.test(v.link),
      ),
    ),
);
let generation = 0;
let mediaGeneration = 0;
let alive = true;
function time(ms: number) {
  const seconds = Math.floor(Number(ms) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
function username(uid: Id) {
  return view.value?.users[String(uid)] || `用户 ${uid}`;
}
async function refresh(preferred = versionId.value) {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const list = await api.versions(props.res);
    if (ticket !== generation || !alive) return;
    versions.value = list;
    const chosen =
      list.find((v) => String(v.id) === String(preferred)) ?? list[0];
    if (!chosen) {
      view.value = undefined;
      versionId.value = undefined;
      return;
    }
    const result = await api.detail(props.res, chosen.id);
    if (ticket !== generation || !alive) return;
    versionId.value = chosen.id;
    view.value = result;
    planned.value = Number(result.detail.version.planned_episodes) || 1;
    if (seq.value > count.value) seq.value = 1;
  } catch (error) {
    if (ticket === generation && alive)
      errorText.value = requestErrorMessage(error, '读取审核信息失败，请重试');
  } finally {
    if (ticket === generation && alive) loading.value = false;
  }
}
async function play() {
  const ticket = ++mediaGeneration;
  player.value?.pause();
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
  url.value = '';
  mediaError.value = '';
  if (!item.value || !versionId.value) return;
  try {
    const result = await api.play(props.res, versionId.value, seq.value);
    if (ticket === mediaGeneration && alive) url.value = result;
    else if (result.startsWith('blob:')) URL.revokeObjectURL(result);
  } catch (error) {
    if (ticket === mediaGeneration && alive)
      mediaError.value = requestErrorMessage(error, '视频读取失败');
  }
}
watch(
  () => [versionId.value, seq.value, item.value?.link],
  () => {
    void play();
  },
);
watch(
  () => props.res,
  () => {
    seq.value = 1;
    view.value = undefined;
    versionId.value = undefined;
    success.value = '';
    void refresh(props.initialVersion);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  alive = false;
  generation++;
  mediaGeneration++;
  player.value?.pause();
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
});
async function action(task: () => Promise<unknown>, message: string) {
  if (busy.value || loading.value) return;
  busy.value = true;
  errorText.value = '';
  success.value = '';
  try {
    await task();
    if (!alive) return;
    await refresh();
    success.value = message;
  } catch (error) {
    if (alive)
      errorText.value = requestErrorMessage(
        error,
        '操作失败，请刷新核对后重试',
      );
  } finally {
    busy.value = false;
  }
}
function addNote() {
  const target = version.value;
  if (!target || !draft.value.body.trim()) return;
  const current = draft.value;
  const payload = {
    ...current,
    seq_no: seq.value,
    expected_revision: version.value.revision,
  };
  void action(async () => {
    await api.addNote(props.res, target.id, payload);
    current.body = '';
  }, '意见已保存');
}
function capture() {
  draft.value.position_ms = Math.round((player.value?.currentTime || 0) * 1000);
  player.value?.pause();
}
function seek(note: ReviewNote) {
  if (player.value && note.media_link === item.value?.link) {
    player.value.currentTime = Number(note.position_ms) / 1000;
    player.value.focus();
  }
}
const processing = ref<ReviewNote>();
const resolution = ref('');
const nextState = ref<NoteState>('resolved');
function process(note: ReviewNote, state: NoteState) {
  processing.value = note;
  resolution.value = '';
  nextState.value = state;
}
function saveResolution() {
  const note = processing.value;
  const target = version.value;
  if (!note || !target) return;
  void action(async () => {
    await api.noteState(
      props.res,
      target.id,
      note,
      nextState.value,
      resolution.value,
    );
    processing.value = undefined;
  }, '建议处理状态已更新');
}
function state(next: ReviewState) {
  const target = version.value;
  if (target)
    void action(
      () =>
        api.state(props.res, target.id, target.revision, next, planned.value),
      `版本已更新为${reviewLabels[next]}`,
    );
}
const versionDialog = ref(false);
const copy = ref(false);
const newName = ref('');
function newVersion(isCopy: boolean) {
  copy.value = isCopy;
  newName.value = isCopy ? `${version.value?.name || ''} · 修订版` : '';
  versionDialog.value = true;
}
function saveVersion() {
  const target = version.value;
  if (!newName.value.trim() || !target) return;
  void action(async () => {
    const result = copy.value
      ? await api.copy(props.res, target.id, target.revision, newName.value)
      : await api.create(props.res, newName.value);
    versionId.value = result.id;
    seq.value = 1;
    versionDialog.value = false;
  }, '新版本已创建，可继续上传或替换分集');
}
const uploadOpen = ref(false);
const uploadSeq = ref(1);
const uploadTitle = ref('');
const uploadFile = ref<File>();
const uploadProgress = ref(0);
const uploadStage = ref('');
const savedFile = ref<Id>();
const uploadRevision = ref(0);
function upload() {
  const target = version.value;
  if (!target) return;
  uploadSeq.value = seq.value;
  uploadTitle.value = item.value?.title || `第 ${seq.value} 集`;
  uploadFile.value = undefined;
  savedFile.value = undefined;
  uploadProgress.value = 0;
  uploadStage.value = '';
  uploadRevision.value = target.revision;
  uploadOpen.value = true;
}
function chooseFile(event: Event) {
  uploadFile.value = (event.target as HTMLInputElement).files?.[0];
  savedFile.value = undefined;
}
async function saveUpload() {
  if (!uploadFile.value || !versionId.value || busy.value) return;
  if (uploadFile.value.size > 512 * 1024 * 1024) {
    errorText.value =
      '单集文件最多 512 MB，请压缩后重试或使用版本管理中的桌面上传。';
    return;
  }
  const file = uploadFile.value;
  const target = versionId.value;
  const targetSeq = uploadSeq.value;
  await action(async () => {
    if (!savedFile.value) {
      uploadStage.value = '正在上传视频';
      const files = await api.upload(props.res, target, file, (percent) => {
        uploadProgress.value = percent;
      });
      savedFile.value = files[0]?.file.file_id;
      if (!savedFile.value) throw new Error('上传未返回有效文件，请重试');
    }
    if (!alive) return;
    uploadStage.value = '正在保存当前集';
    await api.episode(props.res, target, {
      expected_revision: uploadRevision.value,
      seq_no: targetSeq,
      title: uploadTitle.value,
      link: `storage:file:${savedFile.value}`,
      content: '',
      duration: 0,
      remark: '',
    });
    uploadOpen.value = false;
    seq.value = targetSeq;
  }, `第 ${targetSeq} 集已保存。请核对视频并完成对应修改建议。`);
}
async function rebaseUpload() {
  await refresh();
  if (version.value) uploadRevision.value = version.value.revision;
}
</script>
<template>
  <section class="review-workbench" aria-label="作品审核工作台">
    <header class="review-header">
      <div>
        <span class="text-xs tracking-widest text-muted-foreground">作品审核</span>
        <h2>{{ name }}</h2>
        <p>上传交片 · 审片修改 · 确认定版 · 上架</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Select
          :value="versionId"
          :options="
            versions.map((v) => ({
              value: v.id,
              label: `${v.name} · ${reviewLabels[v.review_state] || '制作中'}`,
            }))
          "
          class="min-w-56"
          :disabled="busy || loading"
          placeholder="选择版本"
          @update:value="refresh($event as Id)"
        />
        <ReviewGuide
          :can-edit="view?.can_edit ?? false"
          :can-manage="view?.can_manage ?? false"
        />
        <ReviewDingtalk
          v-if="view"
          :key="String(res)"
          :res="res"
          :name="name"
        />
        <ReviewMembers
          v-if="view"
          :res="res"
          :view="view"
          @refresh="refresh()"
        />
        <Button :loading="loading" :disabled="busy" @click="refresh()">
          刷新
        </Button>
      </div>
    </header>
    <Alert
      v-if="errorText"
      :message="errorText"
      type="error"
      show-icon
      class="mb-3"
    />
    <Alert
      v-if="success"
      :message="success"
      type="success"
      show-icon
      closable
      class="mb-3"
    />
    <Spin :spinning="loading">
      <template v-if="view && version">
        <div class="review-summary">
          <div>
            <Tag
              :color="
                version.review_state === 'published'
                  ? 'blue'
                  : version.review_state === 'final'
                    ? 'green'
                    : 'orange'
              "
            >
              {{ reviewLabels[version.review_state] }}
</Tag><strong>{{ view.detail.items.length }} /
              {{ version.planned_episodes || '未设置' }}</strong><span> 已上传</span>
          </div>
          <div>
            <strong>{{ pending.length }}</strong><span> 条建议待完成</span>
          </div>
          <div
            v-if="view.can_edit && version.review_state === 'draft'"
            class="flex items-center gap-2"
          >
            <span>计划集数</span><InputNumber
              v-model:value="planned"
              :min="1"
              :max="1000"
              :precision="0"
              :disabled="busy"
              class="w-24"
            /><Button :disabled="busy" @click="state('draft')">保存计划</Button>
          </div>
          <div class="ml-auto flex flex-wrap gap-2">
            <ReviewBatchUpload
              v-if="view.can_edit && editable"
              :key="String(version.id)"
              :res="res"
              :version="version.id"
              :items="view.detail.items"
              :planned="Number(version.planned_episodes)"
              :disabled="busy"
              @refresh="refresh()"
            />
            <Button
              v-if="view.can_edit"
              :disabled="busy"
              @click="newVersion(false)"
            >
              全新版本
            </Button>
            <Button
              v-if="view.can_edit"
              :disabled="busy"
              @click="newVersion(true)"
            >
              复制版本修改
            </Button>
            <Popconfirm
              v-if="view.can_edit && version.review_state === 'draft'"
              title="全部分集已上传，确认交片并进入审片修改？已有建议可以在交片后继续处理。"
              @confirm="state('reviewing')"
            >
              <Button
                type="primary"
                :disabled="
                  busy ||
                  !uploaded ||
                  planned !== Number(version.planned_episodes)
                "
              >
                交片，开始审片
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="view.can_manage && version.review_state === 'reviewing'"
              title="确认本轮修改已全部完成？定版后将固定此版本的成片，后续修改需复制新版本。"
              @confirm="state('final')"
            >
              <Button
                type="primary"
                :disabled="busy || !uploaded || pending.length > 0"
              >
                修改完成，确认定版
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="view.can_manage && version.review_state === 'final'"
              title="此成片已定版，确认标记为已上架？"
              @confirm="state('published')"
            >
              <Button type="primary" :disabled="busy"> 确认上架 </Button>
            </Popconfirm>
          </div>
        </div>
        <Alert
          v-if="!editable"
          :message="
            version.review_state === 'published'
              ? '已上架版本已锁定。需要改片时，复制此版本，只替换问题集；也可以创建全新版本。'
              : '本轮审片修改已完成，成片版本已固定。需要继续调整时，请复制新版本。'
          "
          type="info"
          show-icon
          class="mb-3"
        />
        <p
          v-else-if="version.review_state === 'draft'"
          class="mb-3 text-sm text-muted-foreground"
        >
          上传计划内的全部分集后即可交片；修改建议可以在交片后的审片周期中继续处理。
        </p>
        <Alert
          v-if="version.review_state === 'reviewing'"
          type="info"
          show-icon
          class="mb-3"
          :message="`已进入审片修改周期：预览 → 提建议 → 剪辑替换 → 核对并完成建议，可反复调整。当前还有 ${pending.length} 条建议待完成，全部完成后由负责人确认定版。`"
        />
        <div class="review-columns">
          <aside class="episode-panel" aria-label="分集列表">
            <div class="panel-heading">
              <strong>分集</strong><span>{{ count }} 集</span>
            </div>
            <Input
              v-model:value="search"
              placeholder="搜索集数 / 标题"
              allow-clear
              class="mb-2"
            />
            <Select
              v-model:value="filter"
              class="mb-3 w-full"
              :options="[
                { value: 'all', label: '全部分集' },
                { value: 'pending', label: '有待处理建议' },
                { value: 'missing', label: '尚未上传' },
              ]"
            />
            <nav class="episode-list">
              <button
                v-for="row in episodes"
                :key="row.no"
                type="button"
                :disabled="busy"
                :aria-pressed="seq === row.no"
                :class="{ selected: seq === row.no }"
                @click="seq = row.no"
              >
                <span class="episode-number">{{
                  String(row.no).padStart(2, '0')
                }}</span><span class="min-w-0 flex-1"><strong>{{ row.title }}</strong><small>{{
                    row.uploaded
                      ? row.pending
                        ? `${row.pending} 条待处理`
                        : '已上传'
                      : '等待上传'
                  }}</small></span><span
                  v-if="row.pending"
                  class="pending-dot"
                  aria-label="有待处理建议"
                ></span>
              </button>
              <Empty v-if="!episodes.length" description="没有匹配的分集" />
            </nav>
          </aside>
          <main class="player-panel">
            <div class="panel-heading">
              <strong>第 {{ seq }} 集 · {{ item?.title || '等待上传' }}</strong><Button
                v-if="view.can_edit && editable"
                :disabled="busy"
                type="primary"
                @click="upload()"
              >
                {{ item ? '替换这一集' : '上传这一集' }}
              </Button>
            </div>
            <video
              v-if="url"
              :key="url"
              ref="player"
              :src="url"
              controls
              playsinline
              preload="metadata"
              class="review-player"
              @error="
                mediaError = '视频无法播放，请刷新视频地址或检查文件格式。'
              "
            ></video>
            <div v-else class="player-empty">
              <Empty
                :description="item ? '视频加载中' : `第 ${seq} 集尚未上传`"
              /><Button v-if="item" @click="play()">重新加载视频</Button>
            </div>
            <Alert
              v-if="mediaError"
              :message="mediaError"
              type="error"
              class="mt-3"
            />
            <div class="player-controls">
              <Button :disabled="seq <= 1 || busy" @click="seq--">上一集</Button><span>{{ seq }} / {{ count }}</span><Button :disabled="seq >= count || busy" @click="seq++">
                下一集
</Button><Button :disabled="!item" @click="play()">刷新视频</Button>
            </div>
            <div v-if="editable && item" class="comment-composer">
              <div class="panel-heading">
                <strong>留下审核意见</strong><Button size="small" @click="capture">
                  标记当前时间 {{ time(draft.position_ms) }}
                </Button>
              </div>
              <Select
                v-model:value="draft.kind"
                class="mb-2 w-56"
                :options="[
                  { value: 'suggestion', label: '修改建议 · 需要处理' },
                  { value: 'comment', label: '评论 · 交流记录' },
                ]"
              />
              <TextArea
                v-model:value="draft.body"
                :rows="4"
                :maxlength="4000"
                show-count
                placeholder="描述这一集需要调整的内容，例如：00:23 转场太快，建议多保留两秒人物反应。"
              />
              <div class="mt-4 flex items-center justify-between gap-2">
                <small class="text-muted-foreground">切换分集会保留未发送草稿</small><Button
                  type="primary"
                  :loading="busy"
                  :disabled="!draft.body.trim()"
                  @click="addNote"
                >
                  {{
                    draft.kind === 'suggestion' ? '提交修改建议' : '发表评论'
                  }}
                </Button>
              </div>
            </div>
          </main>
          <aside class="notes-panel" aria-label="当前集审核意见">
            <div class="panel-heading">
              <strong>第 {{ seq }} 集审核意见</strong><span>{{ notes.length }} 条</span>
            </div>
            <Select
              v-model:value="noteFilter"
              class="mb-3 w-full"
              :options="[
                { value: 'all', label: '全部意见' },
                { value: 'pending', label: '待完成的建议' },
                { value: 'comment', label: '普通评论' },
              ]"
            />
            <div class="note-list">
              <article v-for="note in notes" :key="note.id" class="review-note">
                <div class="flex items-center justify-between gap-2">
                  <strong>{{ username(note.uid) }}</strong><Tag
                    :color="
                      note.kind === 'comment'
                        ? undefined
                        : note.state === 'resolved'
                          ? 'green'
                          : 'orange'
                    "
                  >
                    {{
                      note.kind === 'comment' ? '评论' : noteLabels[note.state]
                    }}
                  </Tag>
                </div>
                <div class="my-2 flex items-center gap-2">
                  <Button
                    size="small"
                    :disabled="note.media_link !== item?.link || !url"
                    @click="seek(note)"
                  >
                    {{ time(note.position_ms) }}
</Button><small class="text-muted-foreground">{{
                    new Date(Number(note.created_at) * 1000).toLocaleString()
                  }}</small>
                </div>
                <small
                  v-if="note.media_link !== item?.link"
                  class="text-amber-600"
                  >针对替换前的视频，请核对修订结果</small>
                <p class="note-body">{{ note.body }}</p>
                <div v-if="note.resolution" class="resolution">
                  <strong>{{ username(note.resolved_by) }} ·
                    {{ noteLabels[note.state] }}</strong>
                  <p>{{ note.resolution }}</p>
                </div>
                <details v-if="note.history.length > 1" class="mt-2 text-sm">
                  <summary>处理记录（{{ note.history.length }}）</summary>
                  <p
                    v-for="(entry, index) in note.history"
                    :key="index"
                    class="mt-2"
                  >
                    {{ username(entry.uid) }} · {{ noteLabels[entry.state] }} ·
                    {{ entry.resolution }}
                  </p>
                </details>
                <div
                  v-if="view.can_edit && editable && note.kind === 'suggestion'"
                  class="mt-3 flex flex-wrap gap-1"
                >
                  <Button
                    v-if="note.state === 'open'"
                    size="small"
                    :disabled="busy"
                    @click="process(note, 'processing')"
                  >
                    开始处理
</Button><Button
                    v-if="note.state !== 'resolved'"
                    size="small"
                    type="primary"
                    :disabled="busy"
                    @click="process(note, 'resolved')"
                  >
                    完成建议
</Button><Button
                    v-else
                    size="small"
                    :disabled="busy"
                    @click="process(note, 'open')"
                  >
                    重新打开
                  </Button>
                </div>
              </article>
              <Empty v-if="!notes.length" description="这一集暂无匹配的意见" />
            </div>
          </aside>
        </div>
      </template>
      <Empty
        v-else-if="!loading"
        description="尚无可审核版本，请在资源管理中新建首个版本"
      />
    </Spin>
    <Modal
      :open="Boolean(processing)"
      :title="
        processing
          ? `第 ${processing.seq_no} 集 · ${noteLabels[nextState]}`
          : ''
      "
      :z-index="1030"
      :confirm-loading="busy"
      :mask-closable="!busy"
      :ok-button-props="{
        disabled: nextState === 'resolved' && !resolution.trim(),
      }"
      @ok="saveResolution"
      @cancel="!busy && (processing = undefined)"
    >
      <p class="mb-3 whitespace-pre-wrap">{{ processing?.body }}</p>
      <TextArea
        v-model:value="resolution"
        :rows="4"
        :maxlength="4000"
        placeholder="说明修改了什么；无需改片时也请说明原因"
      /><Alert
        v-if="errorText"
        :message="errorText"
        type="error"
        class="mt-3"
      />
    </Modal>
    <Modal
      v-model:open="versionDialog"
      :title="copy ? '复制版本继续修改' : '创建全新版本'"
      :z-index="1030"
      :confirm-loading="busy"
      :mask-closable="!busy"
      :ok-button-props="{ disabled: !newName.trim() }"
      @ok="saveVersion"
    >
      <p class="mb-3">
        {{
          copy
            ? '保留全部分集视频，新版本独立编辑，审核意见重新开始。'
            : '创建空版本，再按集数上传新视频。'
        }}
      </p>
      <Input
        v-model:value="newName"
        placeholder="例如：导演修订版 02"
        :maxlength="100"
      /><Alert
        v-if="errorText"
        :message="errorText"
        type="error"
        class="mt-3"
      />
    </Modal>
    <Modal
      v-model:open="uploadOpen"
      :title="`上传 / 替换第 ${uploadSeq} 集`"
      :z-index="1030"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="!busy"
      :cancel-button-props="{ disabled: busy }"
      :ok-button-props="{ disabled: !uploadFile || !uploadTitle.trim() }"
      ok-text="上传并保存这一集"
      @ok="saveUpload"
    >
      <Alert
        message="只更新这一集，其他集保持原样。替换后请播放核对，再完成对应修改建议。"
        type="info"
        class="mb-4"
      />
      <label class="upload-field">分集标题<Input
          v-model:value="uploadTitle"
          :maxlength="200"
          :disabled="busy"
      /></label>
      <label class="upload-field">选择视频<input
          type="file"
          accept=".mp4,.mov,.m4v,.webm,.avi,.mpeg,.mpg"
          :disabled="busy"
          @change="chooseFile"
      /></label>
      <p v-if="uploadFile">
        {{ uploadFile.name }} ·
        {{ (uploadFile.size / 1024 / 1024).toFixed(1) }} MB
      </p>
      <div v-if="uploadStage" class="mt-3">
        <p>{{ uploadStage }}</p>
        <Progress
          :percent="uploadProgress"
          :status="busy ? 'active' : undefined"
        />
      </div>
      <Alert v-if="errorText" :message="errorText" type="error" class="mt-3" />
      <Button
        v-if="savedFile && errorText"
        :disabled="busy"
        class="mt-3"
        @click="rebaseUpload"
      >
        刷新并确认使用最新版本重试登记
      </Button>
    </Modal>
  </section>
</template>
<style scoped>
.review-workbench {
  --review-border: hsl(var(--border));
}

.review-header {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 20px;
}

.review-header h2 {
  margin: 4px 0;
  font-size: 24px;
  font-weight: 650;
}

.review-header p {
  margin: 0;
  color: hsl(var(--muted-foreground));
}

.review-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid var(--review-border);
  border-radius: 12px;
}

.review-columns {
  display: grid;
  grid-template-columns: 200px minmax(300px, 1fr) 340px;
  gap: 18px;
  align-items: start;
}

.panel-heading {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.episode-panel,
.notes-panel {
  min-width: 0;
}

.episode-list,
.note-list {
  max-height: 72vh;
  padding-right: 4px;
  overflow: auto;
}

.episode-list button {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 12px 10px;
  margin-bottom: 5px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 10px;
}

.episode-list button:hover {
  background: hsl(var(--muted));
}

.episode-list button.selected {
  background: hsl(var(--primary) / 9%);
  border-color: hsl(var(--primary));
}

.episode-number {
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}

.episode-list strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.episode-list small {
  display: block;
  margin-top: 3px;
  color: hsl(var(--muted-foreground));
}

.pending-dot {
  width: 7px;
  height: 7px;
  background: #d97706;
  border-radius: 50%;
}

.review-player,
.player-empty {
  width: 100%;
  height: 44vh;
  min-height: 260px;
  object-fit: contain;
  background: #10131a;
  border-radius: 12px;
}

.player-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.player-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 14px 0;
}

.comment-composer {
  padding-top: 16px;
  border-top: 1px solid var(--review-border);
}

.review-note {
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--review-border);
  border-radius: 12px;
}

.note-body {
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.resolution {
  padding: 10px;
  margin-top: 12px;
  font-size: 12px;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.resolution p {
  margin: 5px 0 0;
  white-space: pre-wrap;
}

.upload-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

@media (max-width: 1200px) {
  .review-columns {
    grid-template-columns: 160px minmax(260px, 1fr) 290px;
    gap: 12px;
  }
}

@media (max-width: 900px) {
  .review-header {
    flex-direction: column;
    align-items: stretch;
  }

  .review-columns {
    grid-template-columns: 140px minmax(0, 1fr);
  }

  .notes-panel {
    grid-column: 1 / -1;
  }

  .note-list {
    max-height: none;
  }
}

@media (max-width: 560px) {
  .review-columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .episode-list {
    max-height: 180px;
  }

  .review-player {
    height: 40vh;
  }
}
</style>
