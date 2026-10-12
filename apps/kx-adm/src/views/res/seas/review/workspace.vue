<script setup lang="ts">
import type { DeliverySlot, DeliveryView } from '#/api/res/delivery';
import type { ReviewState, ReviewView } from '#/api/res/review';
import type { Id, ResourceVersion } from '#/api/res/versions';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import { deliveryApi } from '#/api/res/delivery';
import { reviewApi, reviewLabels } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';

import ReviewDingtalk from '../global/source_manage/modules/review-dingtalk.vue';
import ReviewMembers from '../global/source_manage/modules/review-members.vue';
import ReviewWorkbench from '../global/source_manage/modules/review-workbench.vue';
import DeliveryGuide from './delivery-guide.vue';
import DownloadPermissions from './download-permissions.vue';
import FilmBatch from './film-batch.vue';
import MaterialPanel from './material-panel.vue';
import ProjectMaterialUpload from './project-material-upload.vue';
const props = defineProps<{ scope: Id; name: string; initialVersion?: Id }>();
const emit = defineEmits<{ changed: [] }>();
const { hasAccessByCodes } = useAccess();
const canUploadDirectory = computed(() =>
  ['api:res.review.imports.submit', 'api:res.delivery.transfer.prepare'].every(
    (code) => hasAccessByCodes([code]),
  ),
);
const versions = ref<ResourceVersion[]>([]);
const versionId = ref<Id>();
const review = ref<ReviewView>();
const videoView = ref<DeliveryView>();
const materials = ref<{ version_id: Id; view: DeliveryView }>();
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const tab = ref('videos');
const planned = ref(1);
const selected = ref<DeliverySlot>();
const newOpen = ref(false);
const copyMode = ref(false);
const newName = ref('');
const newKind = ref('film');
const newPlanned = ref(6);
const previewOpen = ref(false);
const previewVersion = ref<Id>();
const previewSeq = ref(1);
const audit = ref<InstanceType<typeof ReviewWorkbench>>();
const batchUpload = ref<InstanceType<typeof FilmBatch>>();
let generation = 0;
let alive = true;
const kindOptions = [
  { value: 'film', label: '成片' },
  { value: 'clean', label: '无字幕版' },
  { value: 'silent', label: '无音乐版' },
  { value: 'custom', label: '自定义视频版本' },
];
const version = computed(() => review.value?.detail.version);
const editable = computed(
  () =>
    videoView.value?.can_edit &&
    ['draft', 'reviewing'].includes(version.value?.review_state || ''),
);
const pending = computed(() => videoView.value?.pending || 0);
const materialMissing = computed(
  () =>
    materials.value?.view.slots.filter((s) => s.required && !s.complete)
      .length || 0,
);
const missing = computed(
  () =>
    videoView.value?.slots.filter((s) => s.required && !s.complete).length || 0,
);
const materialPlanned = computed(() =>
  Math.max(1, ...(materials.value?.view.slots.map((s) => s.seq_no) || [])),
);
const projectMaterials = computed(
  () => materials.value?.view.slots.filter((s) => s.seq_no === 0) || [],
);
const episodeMaterials = computed(() =>
  Array.from({ length: materialPlanned.value }, (_, i) => ({
    seq: i + 1,
    slots: materials.value?.view.slots.filter((s) => s.seq_no === i + 1) || [],
  })),
);
const videoRows = computed(() =>
  Array.from(
    { length: Number(version.value?.planned_episodes || 0) },
    (_, i) => ({
      seq: i + 1,
      item: review.value?.detail.items.find((v) => Number(v.seq_no) === i + 1),
    }),
  ),
);
function kindName(kind: string) {
  return kindOptions.find((v) => v.value === kind)?.label || '视频版本';
}
async function refresh(preferred: Id | undefined = versionId.value) {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const [list, project] = await Promise.all([
      reviewApi.versions(props.scope),
      deliveryApi.materials(props.scope),
    ]);
    const chosen =
      list.find((v) => String(v.id) === String(preferred)) ||
      list.find((v) => v.delivery_kind === 'film') ||
      list[0];
    const result = chosen
      ? await Promise.all([
          reviewApi.detail(props.scope, chosen.id),
          deliveryApi.manifest(props.scope, chosen.id),
        ])
      : undefined;
    if (ticket !== generation || !alive) return;
    versions.value = list;
    materials.value = project;
    versionId.value = chosen?.id;
    review.value = result?.[0];
    videoView.value = result?.[1];
    planned.value = Number(chosen?.planned_episodes || 1);
    if (selected.value)
      selected.value = project.view.slots.find(
        (s) =>
          s.kind === selected.value?.kind &&
          s.seq_no === selected.value?.seq_no,
      );
    emit('changed');
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取交付项目失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
async function action(run: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await run();
    await refresh();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '操作失败，请核对后重试');
  } finally {
    busy.value = false;
  }
}
function preview(id: Id, seq = 1) {
  previewVersion.value = id;
  previewSeq.value = seq;
  previewOpen.value = true;
}
function closePreview() {
  audit.value?.pause();
  previewOpen.value = false;
}
async function transition(state: ReviewState) {
  if (!version.value) return;
  const v = version.value;
  await action(() =>
    reviewApi.state(props.scope, v.id, v.revision, state, planned.value),
  );
}
function create(copy = false) {
  copyMode.value = copy;
  newName.value = copy ? `${version.value?.name || ''} · 修订` : '';
  newKind.value = version.value?.delivery_kind || 'film';
  newPlanned.value = planned.value;
  newOpen.value = true;
}
async function saveVersion() {
  if (busy.value || !newName.value.trim()) return;
  busy.value = true;
  errorText.value = '';
  try {
    const created =
      copyMode.value && version.value
        ? await reviewApi.copy(
            props.scope,
            version.value.id,
            version.value.revision,
            newName.value.trim(),
          )
        : await deliveryApi.createVideo(
            props.scope,
            newName.value.trim(),
            newKind.value,
            newPlanned.value,
          );
    newOpen.value = false;
    await refresh(created.id);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '创建视频版本失败');
  } finally {
    busy.value = false;
  }
}
watch(
  () => props.scope,
  () => {
    selected.value = undefined;
    closePreview();
    void refresh(props.initialVersion);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  alive = false;
  generation++;
  audit.value?.pause();
});
</script>
<template>
  <section>
    <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold">{{ name }}</h2>
        <p class="mt-2 text-muted-foreground">
          视频版本各自上传、预览和审片；项目资料集中维护，共享于全部版本。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DeliveryGuide />
        <ReviewDingtalk
          v-if="materials?.view.can_manage"
          :res="scope"
          :name="name"
        />
        <ReviewMembers :res="scope" :name="name" />
        <DownloadPermissions
          v-if="version"
          :scope="scope"
          :version="version.id"
        />
        <Button :loading="loading" @click="refresh()">刷新</Button>
      </div>
    </header>
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-4" />
    <nav class="mb-5 flex gap-2" aria-label="交付项目视图">
      <Button
        :type="tab === 'videos' ? 'primary' : 'default'"
        @click="tab = 'videos'"
      >
        视频版本
      </Button>
      <Button
        :type="tab === 'materials' ? 'primary' : 'default'"
        @click="tab = 'materials'"
      >
        项目资料 · {{ materials?.view.submitted || 0 }}/{{
          materials?.view.required || 0
        }}
      </Button>
    </nav>
    <Spin :spinning="loading">
      <template v-if="tab === 'videos'">
        <div class="version-cards">
          <article
            v-for="entry in versions"
            :key="entry.id"
            :class="{
              'version-selected': String(entry.id) === String(versionId),
            }"
          >
            <div class="flex items-center justify-between gap-2">
              <Tag>{{ kindName(entry.delivery_kind) }}</Tag>
              <Tag :color="entry.review_state === 'final' ? 'green' : 'blue'">
                {{ reviewLabels[entry.review_state] || entry.review_state }}
              </Tag>
            </div>
            <h3>{{ entry.name }}</h3>
            <p>{{ entry.planned_episodes }} 集</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button
                v-if="
                  canUploadDirectory &&
                  materials?.view.can_edit &&
                  ['draft', 'reviewing'].includes(entry.review_state)
                "
                :disabled="busy"
                @click="batchUpload?.openDirectory(entry.id)"
                v-access:code="[
                  'api:res.review.imports.submit',
                  'api:res.delivery.transfer.prepare',
                ]"
              >
                上传目录
              </Button>
              <Button @click="refresh(entry.id)">管理此版本</Button>
              <Button type="primary" ghost @click="preview(entry.id)">
                单独预览 / 审片
              </Button>
            </div>
          </article>
          <Button
            v-if="materials?.view.can_manage"
            class="min-h-32"
            @click="create()"
            v-access:code="'api:res.delivery.video_versions.create'"
          >
            ＋ 新增视频版本
          </Button>
        </div>
        <template v-if="version && review && videoView">
          <div
            class="my-5 flex flex-wrap items-center justify-between gap-3 rounded border p-4"
          >
            <div>
              <strong>{{ version.name }}</strong>
              <p class="mt-1 text-sm text-muted-foreground">
                已上传 {{ videoView.submitted }}/{{ videoView.required }} 集 ·
                待处理 {{ pending }} 条建议
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <template v-if="editable && version.review_state === 'draft'">
                <InputNumber
                  v-model:value="planned"
                  :min="1"
                  :max="1000"
                  :precision="0"
                />
                <Button
                  :disabled="busy"
                  @click="transition('draft')"
                  v-access:code="'res:review:plan'"
                >
                  保存计划集数
                </Button>
              </template>
              <Button
                v-if="editable && canUploadDirectory"
                :disabled="busy"
                @click="batchUpload?.openDirectory(version.id)"
                v-access:code="[
                  'api:res.review.imports.submit',
                  'api:res.delivery.transfer.prepare',
                ]"
              >
                上传目录 / 补集
              </Button>
              <Button @click="preview(version.id)">预览当前版本</Button>
              <Button
                v-if="videoView.can_manage"
                @click="create(true)"
                v-access:code="'api:res.review.copy'"
              >
                复制版本修改
              </Button>
            </div>
          </div>
          <Alert
            v-if="materialMissing"
            class="mb-3"
            type="warning"
            :message="`项目必交资料还缺 ${materialMissing} 项，请在项目资料补齐后交片。`"
          />
          <div class="mb-4 flex flex-wrap gap-2">
            <Popconfirm
              v-if="editable && version.review_state === 'draft'"
              title="确认此版本交片并开始审片？其它视频版本独立维护。"
              @confirm="transition('reviewing')"
            >
              <Button
                type="primary"
                :disabled="
                  busy ||
                  missing > 0 ||
                  materialMissing > 0 ||
                  planned !== Number(version.planned_episodes)
                "
                v-access:code="'res:review:submit'"
              >
                提交此版本交片
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="
                videoView.can_manage && version.review_state === 'reviewing'
              "
              title="确认此视频版本定稿？定稿后须复制版本修改。"
              @confirm="transition('final')"
            >
              <Button
                type="primary"
                :disabled="
                  busy ||
                  pending > 0 ||
                  (materials?.view.pending || 0) > 0 ||
                  missing > 0 ||
                  materialMissing > 0
                "
                v-access:code="'res:review:finalize'"
              >
                确认此版本定稿
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="
                videoView.can_ingest &&
                version.review_state === 'final' &&
                !videoView.release
              "
              title="将此定稿视频版本入库资源管理？"
              @confirm="
                action(() =>
                  deliveryApi.ingest(scope, version!.id, version!.revision),
                )
              "
            >
              <Button :loading="busy" v-access:code="'api:res.delivery.ingest'">
                定稿入库
              </Button>
            </Popconfirm>
            <Tag v-if="videoView.release" color="green">此版本已入库</Tag>
          </div>
          <Table
            :data-source="videoRows"
            row-key="seq"
            :pagination="{ pageSize: 20 }"
            :columns="[
              { title: '集数', dataIndex: 'seq', width: 90 },
              { title: '视频', key: 'video' },
              { title: '状态', key: 'state' },
              { title: '操作', key: 'action', width: 180 },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <span v-if="column.key === 'video'">
                {{ record.item?.title || '等待上传' }}
              </span>
              <Tag
                v-else-if="column.key === 'state'"
                :color="record.item ? 'green' : 'orange'"
              >
                {{
                  record.item?.finalized_at
                    ? '已定稿'
                    : record.item
                      ? '已上传'
                      : '缺视频'
                }}
              </Tag>
              <Button
                v-else-if="column.key === 'action'"
                type="link"
                @click="preview(version.id, record.seq)"
              >
                {{ record.item ? '预览 / 审片' : '上传此集' }}
              </Button>
            </template>
          </Table>
        </template>
        <Empty v-else description="暂无视频版本" />
      </template>
      <template v-else-if="materials">
        <Alert
          type="info"
          message="提示词、工程截图与 SRT 属于项目，不跟随视频版本复制或冻结。前6集提示词和截图为必交，SRT 可选；每集每类最多30个附件。"
          class="mb-4"
        />
        <div class="mb-4 flex flex-wrap gap-2">
          <ProjectMaterialUpload
            :scope="scope"
            :version="materials.version_id"
            :view="materials.view"
            :planned="materialPlanned"
            @changed="refresh()"
          />
          <DownloadPermissions :scope="scope" :version="materials.version_id" />
        </div>
        <div class="mb-5 flex flex-wrap gap-3">
          <Button
            v-for="slot in projectMaterials"
            :key="slot.kind"
            @click="selected = slot"
          >
            {{ slot.label }} · {{ slot.complete ? '已提交' : '待补齐' }}
          </Button>
        </div>
        <Table
          :data-source="episodeMaterials"
          row-key="seq"
          :pagination="{ pageSize: 20 }"
          :columns="[
            { title: '集数', dataIndex: 'seq', width: 90 },
            ...['prompt', 'project_image', 'srt'].map((kind) => ({
              title:
                kind === 'prompt'
                  ? '提示词'
                  : kind === 'project_image'
                    ? '工程截图'
                    : 'SRT 字幕',
              key: kind,
            })),
          ]"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key !== 'seq' && column.dataIndex !== 'seq'">
              <Button
                v-if="
                  record.slots.some((s: DeliverySlot) => s.kind === column.key)
                "
                type="link"
                @click="
                  selected = record.slots.find(
                    (s: DeliverySlot) => s.kind === column.key,
                  )
                "
              >
                {{
                  record.slots.find((s: DeliverySlot) => s.kind === column.key)
                    ?.complete
                    ? '查看 / 更新'
                    : '提交资料'
                }}
              </Button>
              <span v-else class="text-muted-foreground">不要求</span>
            </template>
          </template>
        </Table>
        <MaterialPanel
          :scope="scope"
          :version="materials.version_id"
          :selected-slot="selected"
          :view="materials.view"
          @close="selected = undefined"
          @changed="refresh()"
        />
      </template>
    </Spin>
    <FilmBatch
      ref="batchUpload"
      :key="String(scope)"
      :res="scope"
      @refresh="refresh()"
    />
    <Modal
      :open="newOpen"
      :title="copyMode ? '复制视频版本' : '新增独立视频版本'"
      get-container="body"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="false"
      :ok-button-props="{ disabled: !newName.trim() }"
      @ok="saveVersion"
      @cancel="!busy && (newOpen = false)"
    >
      <p class="mb-3 text-muted-foreground">
        每个视频版本有自己的分集、审片记录和定稿状态；项目资料共享。
      </p>
      <Select
        v-if="!copyMode"
        v-model:value="newKind"
        :options="kindOptions"
        class="mb-3 w-full"
      />
      <Input
        v-model:value="newName"
        :maxlength="100"
        placeholder="版本名称，例如：无字幕版第二轮"
        class="mb-3"
      />
      <InputNumber
        v-if="!copyMode"
        v-model:value="newPlanned"
        :min="1"
        :max="1000"
        :precision="0"
        placeholder="计划集数"
      />
      <Alert v-if="errorText" type="error" :message="errorText" class="mt-3" />
    </Modal>
    <Modal
      :open="previewOpen"
      get-container="body"
      title="视频版本预览与审片"
      width="min(1500px,98vw)"
      :footer="null"
      :destroy-on-hidden="true"
      @cancel="closePreview"
    >
      <ReviewWorkbench
        v-if="previewOpen && previewVersion"
        :key="String(previewVersion)"
        ref="audit"
        :res="scope"
        :name="name"
        :initial-version="previewVersion"
        :initial-seq="previewSeq"
        compact
        @changed="refresh()"
      />
    </Modal>
  </section>
</template>
<style scoped>
.version-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.version-cards article {
  padding: 20px;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.version-cards article.version-selected {
  background: hsl(var(--primary) / 4%);
  border-color: hsl(var(--primary));
}

.version-cards h3 {
  margin: 16px 0 8px;
  font-size: 18px;
  font-weight: 600;
}
</style>
