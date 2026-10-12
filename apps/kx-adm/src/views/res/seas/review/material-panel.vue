<script setup lang="ts">
import type {
  DeliveryAsset,
  DeliveryFile,
  DeliverySlot,
  DeliveryView,
} from '#/api/res/delivery';
import type { Id } from '#/api/res/versions';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Modal,
  Pagination,
  Spin,
  Tag,
  TextArea,
} from 'antdv-next';

import { deliveryApi as api } from '#/api/res/delivery';
import { noteLabels, reviewApi } from '#/api/res/review';
import { desktop, desktopDownloads } from '#/desktop';
import { requestErrorMessage } from '#/request-errors';

import NativeUpload from './native-upload.vue';
const props = defineProps<{
  scope: Id;
  version: Id;
  selectedSlot?: DeliverySlot;
  view: DeliveryView;
}>();
const emit = defineEmits<{ close: []; changed: [] }>();
const files = ref<DeliveryFile[]>([]);
const text = ref('');
const reason = ref('');
const busy = ref(false);
const errorText = ref('');
const success = ref('');
const expected = ref(0);
const history = ref<DeliveryAsset[]>([]);
const historyTotal = ref(0);
const historyPage = ref(1);
const users = ref<Record<string, string>>({});
const historyLoading = ref(false);
const selected = ref<DeliveryAsset>();
const restoring = ref<DeliveryAsset>();
const restoreReason = ref('');
const restoreRevision = ref(0);
const previewUrl = ref('');
const previewName = ref('');
const previewLoading = ref(false);
const previewError = ref('');
const note = ref('');
const resolution = ref('');
const processing = ref<DeliveryView['notes'][number]>();
let generation = 0;
let mediaGeneration = 0;
const editable = computed(
  () => props.view.can_edit && !props.selectedSlot?.locked,
);
const canText = computed(() =>
  ['prompt', 'synopsis'].includes(props.selectedSlot?.kind ?? ''),
);
const isImage = computed(() => /\.(png|jpe?g|webp)$/i.test(previewName.value));
const isVideo = computed(() =>
  /\.(mp4|mov|m4v|webm)$/i.test(previewName.value),
);
const notes = computed(() =>
  props.view.notes.filter(
    (n) =>
      Number(n.seq_no) === Number(props.selectedSlot?.seq_no) &&
      n.media_link.startsWith('delivery:asset:') &&
      n.body.startsWith(`【${props.selectedSlot?.label}】`),
  ),
);
const label = computed(
  () =>
    `${props.selectedSlot?.seq_no ? `第 ${props.selectedSlot.seq_no} 集 · ` : ''}${props.selectedSlot?.label ?? ''}`,
);
function date(at: number) {
  return new Date(Number(at) * 1000).toLocaleString();
}
function username(uid: Id) {
  return (
    users.value[String(uid)] || props.view.users[String(uid)] || `用户 ${uid}`
  );
}
function release() {
  mediaGeneration++;
  if (previewUrl.value.startsWith('blob:'))
    URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  previewLoading.value = false;
}
async function loadHistory() {
  if (!props.selectedSlot) return;
  const ticket = ++generation;
  historyLoading.value = true;
  try {
    const result = await api.history(
      props.scope,
      props.version,
      props.selectedSlot.kind,
      props.selectedSlot.seq_no,
      historyPage.value,
    );
    if (ticket === generation) {
      history.value = result.items;
      historyTotal.value = Number(result.total);
      users.value = result.users;
    }
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取材料历史失败');
  } finally {
    if (ticket === generation) historyLoading.value = false;
  }
}
watch(
  () => [props.selectedSlot?.kind, props.selectedSlot?.seq_no, props.version],
  () => {
    generation++;
    release();
    files.value = [...(props.selectedSlot?.asset?.files ?? [])];
    text.value = props.selectedSlot?.asset?.text ?? '';
    reason.value = '';
    errorText.value = '';
    success.value = '';
    selected.value = props.selectedSlot?.asset ?? undefined;
    expected.value = props.view.revision;
    restoring.value = undefined;
    processing.value = undefined;
    historyPage.value = 1;
    history.value = [];
    note.value = '';
    if (props.selectedSlot) void loadHistory();
  },
  { immediate: true },
);
function uploaded(newFiles: DeliveryFile[]) {
  const existing = new Set(files.value.map((f) => String(f.file_id)));
  files.value.push(...newFiles.filter((f) => !existing.has(String(f.file_id))));
}
async function save() {
  if (!props.selectedSlot || busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.save(props.scope, props.version, {
      expected_revision: expected.value,
      kind: props.selectedSlot.kind,
      seq_no: props.selectedSlot.seq_no,
      files: files.value,
      text: text.value,
      reason: reason.value,
      restore_from: null,
    });
    emit('changed');
    emit('close');
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '提交失败，请刷新核对版本后重试',
    );
  } finally {
    busy.value = false;
  }
}
async function preview(asset: DeliveryAsset, index: number) {
  release();
  selected.value = asset;
  previewName.value = asset.files[index]?.name ?? '';
  previewError.value = '';
  previewLoading.value = true;
  const ticket = mediaGeneration;
  try {
    const url = await api.media(props.scope, props.version, asset.id, index);
    if (ticket === mediaGeneration) previewUrl.value = url;
    else if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  } catch (error) {
    if (ticket === mediaGeneration)
      previewError.value = requestErrorMessage(error, '读取文件失败');
  } finally {
    if (ticket === mediaGeneration) previewLoading.value = false;
  }
}
function beginRestore(row: DeliveryAsset) {
  restoring.value = row;
  restoreReason.value = '';
  restoreRevision.value = props.view.revision;
}
async function restore() {
  if (!restoring.value || !props.selectedSlot) return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.save(props.scope, props.version, {
      expected_revision: restoreRevision.value,
      kind: props.selectedSlot.kind,
      seq_no: props.selectedSlot.seq_no,
      files: [],
      text: '',
      reason: restoreReason.value,
      restore_from: restoring.value.id,
    });
    emit('changed');
    emit('close');
  } catch (error) {
    errorText.value = requestErrorMessage(error, '恢复失败');
  } finally {
    busy.value = false;
  }
}
async function downloadSelected() {
  if (!selected.value?.files?.length) return;
  errorText.value = '';
  try {
    const directory = await desktopDownloads.pickDirectory();
    if (directory) {
      await desktopDownloads.add(
        Number(props.scope),
        Number(props.version),
        selected.value.files.map((f) => Number(f.file_id)),
        directory,
      );
      success.value = '已加入客户端下载队列，请在下载中心查看进度。';
    }
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '下载失败，请核对模块授权及有效期',
    );
  }
}
async function addNote() {
  if (!selected.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await api.note(
      props.scope,
      props.version,
      selected.value.id,
      props.view.revision,
      note.value,
    );
    note.value = '';
    success.value = '修改建议已提交，关联当前选中的材料快照。';
    emit('changed');
  } catch (error) {
    errorText.value = requestErrorMessage(error, '提交建议失败');
  } finally {
    busy.value = false;
  }
}
async function resolve() {
  if (!processing.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await reviewApi.noteState(
      props.scope,
      props.version,
      processing.value,
      'resolved',
      resolution.value,
    );
    processing.value = undefined;
    emit('changed');
  } catch (error) {
    errorText.value = requestErrorMessage(error, '处理失败');
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  generation++;
  release();
});
</script>
<template>
  <Modal
    :open="Boolean(selectedSlot)"
    :title="label"
    width="min(1280px,96vw)"
    :z-index="1020"
    :footer="null"
    :mask-closable="!busy"
    :closable="!busy"
    :style="{ top: '4vh' }"
    :styles="{ body: { maxHeight: '82vh', overflowY: 'auto' } }"
    @cancel="!busy && emit('close')"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Alert v-if="success" type="success" :message="success" class="mb-3" />
    <Alert
      v-if="selectedSlot?.locked"
      type="info"
      message="本项已锁定，可查看与预览历史。单集定稿需负责人重新打开；整版定稿后只能复制交付版本。"
      class="mb-3"
    />
    <div class="material-layout">
      <section>
        <h3>{{ editable ? '提交交付材料' : '当前交付材料' }}</h3>
        <p class="hint">
          {{ selectedSlot?.required ? '必交材料' : '可选材料' }} ·
          {{
            canText
              ? '填写文字或上传附件，至少完成一种。'
              : '请上传对应文件；多份截图、海报可一起提交。'
          }}
        </p>
        <TextArea
          v-if="canText"
          v-model:value="text"
          :rows="7"
          :maxlength="30000"
          :disabled="!editable || busy"
          placeholder="填写提示词或剧本简介"
        />
        <Alert
          v-if="editable"
          type="info"
          message="文件上传和下载统一使用 Tauri 客户端；网页仅维护交付清单、预览和审核意见。"
          class="mb-3"
        />
        <div class="file-list">
          <div
            v-for="(file, index) in files"
            :key="`${file.file_id}/${index}`"
            class="file-row"
          >
            <span>{{ file.name }}</span>
            <Button
              v-if="editable"
              type="link"
              :disabled="busy"
              @click="files.splice(index, 1)"
            >
              移除
            </Button>
          </div>
          <NativeUpload
            v-if="editable && selectedSlot"
            :scope="scope"
            :version="version"
            :kind="selectedSlot.kind"
            :seq="selectedSlot.seq_no"
            @uploaded="uploaded"
            @busy="busy = $event"
          />
        </div>
        <template v-if="editable">
          <TextArea
            v-model:value="reason"
            :rows="2"
            :maxlength="4000"
            :disabled="busy"
            placeholder="本次修改说明，例如：补充第3集完整工程截图"
          />
          <Button
            class="mt-3"
            type="primary"
            :loading="busy"
            :disabled="!reason.trim() || (!files.length && !text.trim())"
            @click="save"
            v-access:code="'api:res.delivery.assets.save'"
          >
            提交材料
          </Button>
        </template>
        <h3 class="mt-5">修改时间线</h3>
        <Spin :spinning="historyLoading">
          <article
            v-for="row in history"
            :key="String(row.id)"
            class="material-event"
          >
            <header>
              <strong>{{ username(row.actor_uid) }}</strong>
              <Tag
                :color="
                  String(row.id) === String(selectedSlot?.asset?.id)
                    ? 'green'
                    : undefined
                "
              >
                {{
                  String(row.id) === String(selectedSlot?.asset?.id)
                    ? '当前材料'
                    : row.action === 'restore'
                      ? '恢复历史'
                      : row.action === 'copy'
                        ? '复制版本'
                        : '历史材料'
                }}
              </Tag>
            </header>
            <small>{{ date(row.created_at) }}</small>
            <p>{{ row.reason }}</p>
            <p v-if="row.text" class="material-text">{{ row.text }}</p>
            <div class="file-buttons">
              <Button
                v-for="(file, index) in row.files"
                :key="String(file.file_id)"
                size="small"
                :disabled="busy"
                @click="preview(row, index)"
              >
                {{ file.name }}
              </Button>
            </div>
            <div class="mt-2 flex gap-2">
              <Button size="small" @click="selected = row">
                针对这版提意见
              </Button>
              <Button
                v-if="
                  editable && String(row.id) !== String(selectedSlot?.asset?.id)
                "
                size="small"
                :disabled="busy"
                @click="beginRestore(row)"
                v-access:code="'api:res.delivery.assets.save'"
              >
                恢复此版
              </Button>
            </div>
          </article>
          <Empty
            v-if="!history.length && !historyLoading"
            description="提交后，这里会保留每次修改人、时间和原因"
          />
        </Spin>
        <Pagination
          v-if="historyTotal > 10"
          v-model:current="historyPage"
          :page-size="10"
          :total="historyTotal"
          :show-size-changer="false"
          @change="loadHistory"
        />
      </section>
      <aside>
        <h3>材料预览与意见</h3>
        <p class="hint">
          {{
            previewName ||
            '点击时间线中的文件名预览；文字材料直接在记录中查看。'
          }}
        </p>
        <Spin :spinning="previewLoading">
          <img
            v-if="previewUrl && isImage"
            :src="previewUrl"
            :alt="previewName"
            class="material-image"
          />
          <video
            v-else-if="previewUrl && isVideo"
            :key="previewUrl"
            :src="previewUrl"
            controls
            class="material-video"
          ></video>
          <iframe
            v-else-if="previewUrl && /\.(pdf|txt|md|srt)$/i.test(previewName)"
            :src="previewUrl"
            :title="previewName"
            class="material-document"
            sandbox=""
          ></iframe>
        </Spin>
        <Alert v-if="previewError" type="error" :message="previewError" />
        <Button
          v-if="desktop && selected?.files?.length"
          class="mb-3"
          @click="downloadSelected"
        >
          使用 Tauri 下载当前材料
        </Button>
        <div v-if="selected && !selectedSlot?.locked" class="material-note">
          <p>
            意见对象：{{ username(selected.actor_uid) }} ·
            {{ date(selected.created_at) }}
          </p>
          <TextArea
            v-model:value="note"
            :rows="3"
            :maxlength="4000"
            placeholder="说明这份材料需要修改的内容"
            :disabled="busy"
          />
          <Button
            class="mt-2"
            :disabled="busy || !note.trim()"
            @click="addNote"
            v-access:code="'api:res.delivery.assets.note'"
          >
            提交材料修改建议
          </Button>
        </div>
        <article v-for="n in notes" :key="String(n.id)" class="material-note">
          <header>
            <strong>{{ username(n.uid) }}</strong>
            <Tag :color="n.state === 'resolved' ? 'green' : 'orange'">
              {{ noteLabels[n.state] }}
            </Tag>
          </header>
          <p>{{ n.body }}</p>
          <small
            v-if="n.media_link !== `delivery:asset:${selectedSlot?.asset?.id}`"
          >
            针对历史材料，请核对当前修订
          </small>
          <p v-if="n.resolution">
            {{ username(n.resolved_by) }}：{{ n.resolution }}
          </p>
          <Button
            v-if="editable && n.state !== 'resolved'"
            size="small"
            :disabled="busy"
            @click="
              processing = n;
              resolution = '';
            "
          >
            填写处理结果
          </Button>
        </article>
      </aside>
    </div>
  </Modal>
  <Modal
    :open="Boolean(restoring)"
    title="恢复历史材料"
    :z-index="1060"
    :confirm-loading="busy"
    :closable="!busy"
    :mask-closable="!busy"
    :ok-button-props="{ disabled: !restoreReason.trim() }"
    @ok="restore"
    @cancel="!busy && (restoring = undefined)"
  >
    <p>
      恢复会替换本交付项的整组附件及文字，保留当前材料的历史；现有建议不会自动完成。
    </p>
    <TextArea
      v-model:value="restoreReason"
      :maxlength="4000"
      placeholder="填写恢复原因"
    />
    <Alert v-if="errorText" type="error" :message="errorText" />
  </Modal>
  <Modal
    :open="Boolean(processing)"
    title="完成材料修改建议"
    :z-index="1060"
    :confirm-loading="busy"
    :closable="!busy"
    :mask-closable="!busy"
    :ok-button-props="{ disabled: !resolution.trim() }"
    @ok="resolve"
    @cancel="!busy && (processing = undefined)"
  >
    <p>{{ processing?.body }}</p>
    <TextArea
      v-model:value="resolution"
      :maxlength="4000"
      placeholder="填写修改结果，并确认已上传对应修订材料"
    />
    <Alert v-if="errorText" type="error" :message="errorText" />
  </Modal>
</template>
<style scoped>
.material-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
}

.material-layout h3 {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
}

.hint {
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.file-list {
  margin: 16px 0;
}

.file-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 6px;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.file-row span {
  overflow-wrap: anywhere;
}

.upload-area {
  display: block;
  padding: 18px;
  margin-top: 10px;
  cursor: pointer;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.upload-area input {
  display: block;
  max-width: 100%;
  margin-bottom: 12px;
}

.upload-area small {
  display: block;
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
}

.material-event {
  padding: 16px;
  margin: 0 0 12px 10px;
  background: hsl(var(--muted) / 40%);
  border-left: 3px solid hsl(var(--primary));
  border-radius: 8px;
}

.material-event header,
.material-note header {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.material-event p,
.material-note p {
  margin: 10px 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.material-event small {
  color: hsl(var(--muted-foreground));
}

.material-text {
  max-height: 200px;
  overflow: auto;
}

.file-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-buttons :deep(button) {
  max-width: 100%;
  height: auto;
  text-align: left;
  white-space: normal;
}

.material-image,
.material-video {
  display: block;
  max-width: 100%;
  max-height: 45vh;
  margin: 0 auto 12px;
  border-radius: 8px;
}

.material-video {
  width: 100%;
  background: #10131a;
}

.material-document {
  width: 100%;
  height: 40vh;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.download-file {
  display: block;
  margin: 12px 0;
  color: hsl(var(--primary));
  overflow-wrap: anywhere;
}

.material-note {
  padding: 16px;
  margin-top: 18px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 850px) {
  .material-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
