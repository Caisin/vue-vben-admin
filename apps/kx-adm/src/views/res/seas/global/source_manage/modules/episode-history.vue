<script setup lang="ts">
import type {
  EpisodeHistoryView,
  EpisodeRevision,
} from '#/api/res/episode-history';
import type { Id } from '#/api/res/versions';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Pagination,
  Spin,
  Tag,
  TextArea,
} from 'antdv-next';

import { episodeHistoryApi as api } from '#/api/res/episode-history';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{
  res: Id;
  version: Id;
  seq: number;
  editable: boolean;
  disabled: boolean;
  revision: number;
  canManage?: boolean;
  reviewing?: boolean;
  finalizedAt?: number;
  hasVideo?: boolean;
  pending?: number;
}>();
const emit = defineEmits<{ restored: []; opened: []; closed: [] }>();
const open = ref(false);
const loading = ref(false);
const busy = ref(false);
const view = ref<EpisodeHistoryView>();
const page = ref(1);
const errorText = ref('');
const success = ref('');
const selected = ref<EpisodeRevision>();
const url = ref('');
const mediaLoading = ref(false);
const mediaError = ref('');
const player = ref<HTMLVideoElement>();
const historyPanel = ref<HTMLElement>();
const restorePanel = ref<HTMLElement>();
const statePanel = ref<HTMLElement>();
const previewPanel = ref<HTMLElement>();
const restoring = ref<EpisodeRevision>();
const restoringRevision = ref<number>();
const reason = ref('');
const stateOpen = ref(false);
const stateReason = ref('');
const stateRevision = ref(0);
const targetFinalized = ref(false);
function beginState() {
  targetFinalized.value = !props.finalizedAt;
  stateRevision.value = props.revision;
  stateReason.value = '';
  errorText.value = '';
  restoring.value = undefined;
  stateOpen.value = true;
  void nextTick(() => statePanel.value?.focus());
}
async function saveState() {
  if (busy.value || !stateReason.value.trim()) return;
  busy.value = true;
  try {
    await api.setState(
      props.res,
      props.version,
      props.seq,
      stateRevision.value,
      targetFinalized.value,
      stateReason.value.trim(),
    );
    stateOpen.value = false;
    emit('restored');
    if (open.value) await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '状态修改失败，请刷新后重试');
  } finally {
    busy.value = false;
  }
}
const canRestore = computed(
  () =>
    props.editable &&
    !props.finalizedAt &&
    !view.value?.finalized_at &&
    view.value?.can_restore,
);
const labels: Record<string, string> = {
  upload: '首次上传',
  replace: '替换视频',
  edit: '修改资料',
  restore: '恢复历史',
  legacy: '历史基线',
  delete: '删除分集',
  move_out: '调整集数',
  system_sync: '系统同步',
  copy: '复制版本',
  finalize: '单集定稿',
  reopen: '重新打开修改',
  delivery: '交片审片',
  version_final: '整版定版',
  publish: '上架锁定',
};
let generation = 0;
let mediaGeneration = 0;
let alive = true;
function release() {
  mediaGeneration++;
  player.value?.pause();
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
  url.value = '';
  mediaLoading.value = false;
}
function date(at: number) {
  return at ? new Date(Number(at) * 1000).toLocaleString() : '时间未记录';
}
async function load() {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await api.list(
      props.res,
      props.version,
      props.seq,
      page.value,
    );
    if (ticket === generation && alive && open.value) view.value = result;
  } catch (error) {
    if (ticket === generation && alive)
      errorText.value = requestErrorMessage(error, '读取历史失败，请重试');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
function show() {
  if (open.value || busy.value) return;
  stateOpen.value = false;
  emit('opened');
  open.value = true;
  page.value = 1;
  success.value = '';
  view.value = undefined;
  void load();
  void nextTick(() => historyPanel.value?.focus());
}
async function preview(row: EpisodeRevision) {
  release();
  selected.value = row;
  void nextTick(() => previewPanel.value?.focus());
  mediaError.value = '';
  mediaLoading.value = true;
  const ticket = mediaGeneration;
  try {
    const result = await api.play(props.res, props.version, props.seq, row.id);
    if (ticket !== mediaGeneration || !alive || !open.value) {
      if (result.startsWith('blob:')) URL.revokeObjectURL(result);
      return;
    }
    url.value = result;
  } catch (error) {
    if (ticket === mediaGeneration)
      mediaError.value = requestErrorMessage(
        error,
        '历史视频无法读取，文件可能已删除',
      );
  } finally {
    if (ticket === mediaGeneration) mediaLoading.value = false;
  }
}
function beginRestore(row: EpisodeRevision) {
  restoring.value = row;
  restoringRevision.value = view.value?.revision;
  void nextTick(() => restorePanel.value?.focus());
  reason.value = '';
  errorText.value = '';
}
async function restore() {
  const target = restoring.value;
  const expected = restoringRevision.value;
  if (!target || expected === undefined || busy.value || !reason.value.trim())
    return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.restore(
      props.res,
      props.version,
      props.seq,
      target.id,
      expected,
      reason.value.trim(),
    );
    restoring.value = undefined;
    release();
    selected.value = undefined;
    page.value = 1;
    await load();
    success.value = `第 ${props.seq} 集已恢复，已保留恢复前的视频并新增一条恢复记录。`;
    emit('restored');
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '恢复失败，原视频未改变，请刷新后核对',
    );
  } finally {
    busy.value = false;
  }
}
watch(open, (value) => {
  if (!value) {
    emit('closed');
    generation++;
    release();
    selected.value = undefined;
    restoring.value = undefined;
  }
});
watch(
  () => [props.res, props.version, props.seq],
  () => {
    open.value = false;
    stateOpen.value = false;
    generation++;
    release();
  },
);
watch(
  () => props.revision,
  () => {
    if (open.value && !busy.value) void load();
  },
);
onBeforeUnmount(() => {
  emit('closed');
  alive = false;
  generation++;
  release();
});
</script>
<template>
  <div class="history-entry-actions">
    <Button v-if="!open" :disabled="disabled || busy" @click="show">
      历史版本 / 修改时间线
    </Button>
    <Button
      v-if="canManage && reviewing && hasVideo && !open"
      :disabled="disabled || busy || (!finalizedAt && Boolean(pending))"
      @click="beginState"
      v-access:code="'api:res.review.episode.state'"
    >
      {{ finalizedAt ? '重新打开修改' : '本集定稿' }}
    </Button>
  </div>
  <section
    v-if="open"
    ref="historyPanel"
    tabindex="-1"
    class="history-panel"
    aria-label="历史版本与修改时间线"
  >
    <div class="history-toolbar">
      <h3 class="font-semibold">第 {{ seq }} 集 · 历史版本与修改时间线</h3>
      <Button :disabled="busy" @click="open = false">返回当前视频</Button>
    </div>
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Alert v-if="success" type="success" :message="success" class="mb-3" />
    <Alert
      v-if="!editable"
      type="info"
      message="当前版本只读。定版或上架后，请先复制内容版本再修改；编剧和导演可以查看与预览历史。"
      class="mb-3"
    />
    <Alert
      v-if="view?.finalized_at || finalizedAt"
      type="warning"
      message="本集已定稿，禁止替换或恢复历史。整版尚未定版时，请负责人填写原因重新打开修改。"
      class="mb-3"
    />
    <div class="history-toolbar">
      <p>
        预览旧视频不改变当前集。恢复会产生新记录，并保留恢复前的视频、修改人和原因。
      </p>
      <Button :loading="loading" :disabled="busy" @click="load">
        刷新历史
      </Button>
    </div>
    <Alert
      v-if="view?.legacy_current"
      type="info"
      message="启用本功能前未记录完整历史；当前视频将作为基线保留，未知的修改人不会推测。"
      class="mb-3"
    />
    <section
      v-if="restoring"
      ref="restorePanel"
      tabindex="-1"
      class="history-confirm"
      aria-label="恢复历史版本确认"
    >
      <h3 class="mb-3 font-semibold">确认恢复第 {{ seq }} 集</h3>
      <Alert
        type="warning"
        message="将替换当前集的视频及该历史记录的标题、时长和备注。其他集不变；现有修改建议不会自动完成。"
        class="mb-3"
      />
      <p class="mb-3">
        恢复目标：{{ restoring?.title }} · {{ restoring?.actor_name }} ·
        {{ date(restoring?.created_at || 0) }}
      </p>
      <TextArea
        v-model:value="reason"
        :rows="3"
        :maxlength="4000"
        placeholder="填写恢复原因，例如：本次调色不符合要求，恢复上一次确认的视频"
        :disabled="busy"
      />
      <Alert v-if="errorText" :message="errorText" type="error" class="mt-3" />
      <div class="history-actions">
        <Button :disabled="busy" @click="restoring = undefined">
          取消恢复
        </Button>
        <Button
          type="primary"
          :loading="busy"
          :disabled="busy || !reason.trim()"
          @click="restore"
        >
          确认恢复为当前版本
        </Button>
      </div>
    </section>
    <div class="history-layout">
      <section aria-label="本集修改时间线" class="history-timeline">
        <h3 class="mb-4 font-semibold">修改时间线 · 最新操作在前</h3>
        <Spin :spinning="loading">
          <article
            v-for="row in view?.items ?? []"
            :key="String(row.id)"
            class="history-card"
            :class="{ 'history-current': row.is_current }"
          >
            <header>
              <strong>{{ row.title }}</strong>
              <div>
                <Tag v-if="row.is_current" color="green">当前版本</Tag>
                <Tag>{{ labels[row.action] || row.action }}</Tag>
              </div>
            </header>
            <p class="history-meta">
              {{ row.actor_name || '历史未记录' }} · {{ date(row.created_at) }}
            </p>
            <p v-if="row.changes" class="history-meta">
              修改内容：{{ row.changes }}
            </p>
            <p class="history-reason">
              {{ row.reason || row.remark || '未填写修改说明' }}
            </p>
            <p v-if="row.restored_from" class="history-meta">
              恢复自历史记录 #{{ row.restored_from }}
            </p>
            <p v-if="row.duration" class="history-meta">
              视频时长：{{ row.duration }} 秒
            </p>
            <div class="history-actions">
              <Button
                :disabled="Number(row.id) === 0 || busy"
                @click="preview(row)"
              >
                预览此版本
              </Button>
              <Button
                v-if="
                  canRestore &&
                  row.restorable !== false &&
                  !row.is_current &&
                  Number(row.id) > 0
                "
                :disabled="busy || loading"
                @click="beginRestore(row)"
                v-access:code="'api:res.review.history.restore'"
              >
                恢复为当前版本
              </Button>
            </div>
          </article>
          <Empty
            v-if="!loading && !view?.items.length"
            description="这一集暂无可保留的视频历史"
          />
        </Spin>
        <Pagination
          v-if="view && Number(view.total) > 10"
          v-model:current="page"
          :total="Number(view.total)"
          :page-size="10"
          :show-size-changer="false"
          :disabled="busy"
          class="mt-4"
          @change="load"
        />
      </section>
      <aside
        ref="previewPanel"
        tabindex="-1"
        class="history-preview"
        :class="{ 'has-preview': Boolean(selected) }"
        aria-label="历史视频预览"
      >
        <h3>
          {{
            selected
              ? `历史预览 · ${date(selected.created_at)}`
              : '历史视频预览'
          }}
        </h3>
        <p v-if="selected">
          {{ selected.actor_name }} · {{ labels[selected.action] }}
        </p>
        <Spin :spinning="mediaLoading">
          <video
            v-if="url"
            ref="player"
            :key="url"
            :src="url"
            controls
            playsinline
            preload="metadata"
            @error="
              mediaError = '历史视频无法播放，请检查文件是否仍可用或重新加载。'
            "
          ></video>
          <Empty
            v-else
            :description="
              mediaLoading ? '正在读取历史视频…' : '选择一条历史记录进行预览'
            "
          />
        </Spin>
        <Alert
          v-if="mediaError"
          :message="mediaError"
          type="error"
          class="mt-3"
        />
        <Button
          v-if="selected"
          class="mt-3"
          :disabled="mediaLoading"
          @click="preview(selected)"
        >
          重新加载历史视频
        </Button>
      </aside>
    </div>
  </section>
  <section
    v-if="stateOpen"
    ref="statePanel"
    tabindex="-1"
    class="history-confirm"
    aria-label="分集状态确认"
  >
    <h3 class="mb-3 font-semibold">
      第 {{ seq }} 集 · {{ targetFinalized ? '确认定稿' : '重新打开修改' }}
    </h3>
    <Alert
      type="warning"
      :message="
        targetFinalized
          ? '定稿后不能直接替换、恢复或删除本集。请确认当前视频和本集建议都已核对。'
          : '重新打开后剪辑可以修改本集。操作人、时间与原因将永久保留在时间线中。'
      "
      class="mb-3"
    />
    <TextArea
      v-model:value="stateReason"
      :rows="3"
      :maxlength="4000"
      :disabled="busy"
      placeholder="请填写本次操作原因"
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="mt-3" />
    <div class="history-actions">
      <Button :disabled="busy" @click="stateOpen = false">取消</Button>
      <Button
        type="primary"
        :loading="busy"
        :disabled="busy || !stateReason.trim()"
        @click="saveState"
      >
        {{ targetFinalized ? '确认本集定稿' : '确认重新打开' }}
      </Button>
    </div>
  </section>
</template>
<style scoped>
.history-entry-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.history-panel,
.history-confirm {
  min-width: 0;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.history-confirm {
  background: hsl(var(--muted));
}

.history-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.history-toolbar p,
.history-meta {
  font-size: 12px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.history-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 24px;
  align-items: start;
}

.history-card {
  position: relative;
  padding: 16px;
  margin-bottom: 12px;
  margin-left: 28px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.history-card::before {
  position: absolute;
  top: 22px;
  left: -27px;
  width: 12px;
  height: 12px;
  content: '';
  background: hsl(var(--primary));
  border: 3px solid hsl(var(--background));
  border-radius: 50%;
  box-shadow: 0 0 0 1px hsl(var(--border));
}

.history-card::after {
  position: absolute;
  top: 36px;
  bottom: -34px;
  left: -22px;
  width: 2px;
  content: '';
  background: hsl(var(--border));
}

.history-card:last-of-type::after {
  display: none;
}

.history-card header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.history-current {
  border-color: hsl(var(--primary));
}

.history-reason {
  margin: 10px 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.history-preview {
  position: sticky;
  top: 0;
  min-width: 0;
}

.history-preview h3 {
  margin-bottom: 12px;
  font-weight: 600;
}

.history-preview video {
  width: 100%;
  max-height: 52vh;
  background: #10131a;
  border-radius: 10px;
}

.history-preview :deep(.ant-empty) {
  padding: 70px 0;
}

@media (max-width: 800px) {
  .history-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .history-preview:not(.has-preview) {
    display: none;
  }

  .history-preview {
    position: static;
    grid-row: 1;
  }

  .history-toolbar {
    align-items: flex-start;
  }
}
</style>
