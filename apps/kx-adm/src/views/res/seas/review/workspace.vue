<script setup lang="ts">
import type { DeliverySlot, DeliveryView } from '#/api/res/delivery';
import type { ReviewView } from '#/api/res/review';
import type { Id, ResourceVersion } from '#/api/res/versions';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Progress,
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
const props = defineProps<{ scope: Id; name: string; initialVersion?: Id }>();
const emit = defineEmits<{ changed: [] }>();
const versions = ref<ResourceVersion[]>([]);
const versionId = ref<Id>();
const review = ref<ReviewView>();
const view = ref<DeliveryView>();
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const success = ref('');
const planned = ref(1);
const tab = ref('materials');
const auditOpened = ref(false);
const auditSeq = ref(1);
const audit = ref<InstanceType<typeof ReviewWorkbench>>();
const filter = ref('all');
const keyword = ref('');
const page = ref(1);
const selected = ref<DeliverySlot>();
const optional = ref(false);
const newOpen = ref(false);
const copyMode = ref(false);
const newName = ref('');
let generation = 0;
let alive = true;
const version = computed(() => review.value?.detail.version);
const editable = computed(
  () =>
    view.value?.can_edit && ['draft', 'reviewing'].includes(view.value.state),
);
const missing = computed(
  () => view.value?.slots.filter((s) => s.required && !s.complete) ?? [],
);
const groups = computed(
  () => view.value?.slots.filter((s) => s.seq_no === 0) ?? [],
);
const kinds = computed(() =>
  optional.value
    ? [
        'film',
        'clean',
        'silent',
        'prompt',
        'project_image',
        'srt',
        'demo',
        'youtube',
      ]
    : ['film', 'clean', 'silent', 'prompt', 'project_image'],
);
const labels: Record<string, string> = {
  film: '成片',
  clean: '无字幕版',
  silent: '无音乐版',
  prompt: '提示词',
  project_image: '工程截图',
  srt: 'SRT',
  demo: 'DEMO',
  youtube: 'YouTube',
};
const episodeRows = computed(() =>
  Array.from(
    { length: Number(version.value?.planned_episodes ?? 0) },
    (_, i) => {
      const no = i + 1;
      const slots = view.value?.slots.filter((s) => s.seq_no === no) ?? [];
      const pending =
        view.value?.notes.filter(
          (n) =>
            Number(n.seq_no) === no &&
            n.kind === 'suggestion' &&
            n.state !== 'resolved',
        ).length ?? 0;
      return {
        no,
        slots,
        pending,
        missing: slots.filter((s) => s.required && !s.complete).length,
        locked:
          review.value?.detail.items.some(
            (v) => Number(v.seq_no) === no && Number(v.finalized_at) > 0,
          ) ?? false,
      };
    },
  ).filter(
    (r) =>
      (!keyword.value || String(r.no).includes(keyword.value.trim())) &&
      (filter.value === 'all' ||
        (filter.value === 'missing' && r.missing > 0) ||
        (filter.value === 'pending' && r.pending > 0) ||
        (filter.value === 'final' && r.locked)),
  ),
);
const rows = computed(() =>
  episodeRows.value.slice((page.value - 1) * 20, page.value * 20),
);
watch([filter, keyword], () => (page.value = 1));
watch(tab, (value) => {
  if (value === 'review') auditOpened.value = true;
  else audit.value?.pause();
});
async function refresh(preferred: Id | undefined = versionId.value) {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const list = await reviewApi.versions(props.scope);
    const chosen =
      list.find((v) => String(v.id) === String(preferred)) ?? list[0];
    if (!chosen) throw new Error('暂无交付版本');
    const [r, m] = await Promise.all([
      reviewApi.detail(props.scope, chosen.id),
      deliveryApi.manifest(props.scope, chosen.id),
    ]);
    if (ticket !== generation || !alive) return;
    versions.value = list;
    versionId.value = chosen.id;
    review.value = r;
    view.value = m;
    planned.value = Number(r.detail.version.planned_episodes) || 1;
    if (selected.value)
      selected.value = m.slots.find(
        (s) =>
          s.kind === selected.value?.kind &&
          s.seq_no === selected.value?.seq_no,
      );
    emit('changed');
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取交付工作台失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
watch(
  () => props.scope,
  () => {
    versionId.value = undefined;
    review.value = undefined;
    view.value = undefined;
    auditOpened.value = false;
    tab.value = 'materials';
    void refresh(props.initialVersion);
  },
  { immediate: true },
);
async function action(run: () => Promise<unknown>, message: string) {
  if (busy.value) return;
  busy.value = true;
  errorText.value = '';
  success.value = '';
  try {
    await run();
    success.value = message;
    await refresh();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '操作失败，请核对后重试');
  } finally {
    busy.value = false;
  }
}
async function transition(state: 'draft' | 'final' | 'reviewing') {
  if (!version.value || !view.value) return;
  const v = version.value;
  const current = view.value;
  await action(
    () =>
      reviewApi.state(
        props.scope,
        v.id,
        current.revision,
        state,
        planned.value,
      ),
    {
      draft: '计划已保存',
      reviewing: '已提交交片，进入审片修改',
      final: '交付包已定稿，全部材料已锁定',
    }[state],
  );
}
function openSlot(slot: DeliverySlot) {
  if (slot.kind === 'film') {
    auditSeq.value = slot.seq_no;
    tab.value = 'review';
    auditOpened.value = true;
  } else selected.value = slot;
}
function beginVersion(copy: boolean) {
  copyMode.value = copy;
  newName.value = copy ? `${version.value?.name ?? '交付'} · 修订` : '';
  newOpen.value = true;
}
async function createVersion() {
  if (!newName.value.trim() || !version.value || !view.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    const v = copyMode.value
      ? await reviewApi.copy(
          props.scope,
          version.value.id,
          view.value.revision,
          newName.value.trim(),
        )
      : await reviewApi.create(props.scope, newName.value.trim());
    newOpen.value = false;
    auditOpened.value = false;
    tab.value = 'materials';
    await refresh(v.id);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '创建交付版本失败');
  } finally {
    busy.value = false;
  }
}
async function ingest() {
  if (!version.value || !view.value) return;
  const current = view.value;
  const target = version.value;
  await action(
    () => deliveryApi.ingest(props.scope, target.id, current.revision),
    '定稿已入库资源管理；交付包与入库版本均保持固定',
  );
}
onBeforeUnmount(() => {
  alive = false;
  generation++;
});
</script>
<template>
  <section class="delivery-workspace" aria-label="作品交付工作台">
    <header class="workspace-header">
      <div>
        <p class="eyebrow">作品交付与审核</p>
        <h2>{{ name }}</h2>
        <p class="subheading">材料补齐、审片修改、定稿入库，都在这里完成。</p>
      </div>
      <div class="header-actions">
        <DeliveryGuide />
        <ReviewMembers
          v-if="review"
          :res="scope"
          :view="review"
          @refresh="refresh()"
        />
        <DownloadPermissions
          v-if="view?.can_manage"
          :scope="scope"
          :version="versionId!"
        />
        <ReviewDingtalk v-if="review" :res="scope" :name="name" />
        <Button :loading="loading" :disabled="busy" @click="refresh()">
          刷新
        </Button>
      </div>
    </header>
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-4" />
    <Alert v-if="success" type="success" :message="success" class="mb-4" />
    <Spin :spinning="loading">
      <template v-if="view && version && review">
        <div class="stage-strip">
          <span :class="{ active: version.review_state === 'draft' }">
            01 准备交付
          </span>
          <span :class="{ active: version.review_state === 'reviewing' }">
            02 审片与修改
          </span>
          <span
            :class="{
              active: version.review_state === 'final' && !view.release,
            }"
          >
            03 确认定稿
          </span>
          <span :class="{ active: Boolean(view.release) }">04 入库资源</span>
        </div>
        <div class="version-toolbar">
          <Select
            :value="versionId"
            :options="
              versions.map((v) => ({
                value: v.id,
                label: `${v.name} · ${reviewLabels[v.review_state]}`,
              }))
            "
            class="version-select"
            :disabled="busy"
            @update:value="refresh($event as Id)"
          />
          <Tag
            :color="
              view.release
                ? 'blue'
                : version.review_state === 'final'
                  ? 'green'
                  : 'orange'
            "
          >
            {{ view.release ? '已入库' : reviewLabels[version.review_state] }}
          </Tag>
          <div class="ml-auto flex flex-wrap gap-2">
            <Button
              v-if="view.can_edit"
              :disabled="busy"
              @click="beginVersion(true)"
              v-access:code="'api:res.review.copy'"
            >
              复制交付版本
            </Button>
            <Button
              v-if="view.can_edit"
              :disabled="busy"
              @click="beginVersion(false)"
              v-access:code="'api:res.review.create'"
            >
              全新版本
            </Button>
          </div>
        </div>
        <div class="delivery-summary">
          <div>
            <span>必交材料</span>
            <strong>
              {{ view.submitted }}
              <small>/ {{ view.required }}</small>
            </strong>
            <Progress
              :percent="
                view.required
                  ? Math.round((view.submitted * 100) / view.required)
                  : 0
              "
              :show-info="false"
            />
          </div>
          <div>
            <span>待补齐</span>
            <strong :class="{ 'text-amber-600': missing.length }">
              {{ missing.length }}
              <small>项</small>
            </strong>
            <Button
              type="link"
              size="small"
              @click="
                tab = 'materials';
                filter = 'missing';
              "
            >
              定位缺项
            </Button>
          </div>
          <div>
            <span>待处理意见</span>
            <strong>
              {{ view.pending }}
              <small>条</small>
            </strong>
            <Button
              type="link"
              size="small"
              @click="
                tab = 'materials';
                filter = 'pending';
              "
            >
              查看待办
            </Button>
          </div>
          <div>
            <span>交付范围</span>
            <strong>
              {{ version.planned_episodes || '未设置' }}
              <small>集</small>
            </strong>
            <small>
              提示词 / 工程截图：前
              {{ Math.min(Number(version.planned_episodes), 6) }} 集
            </small>
          </div>
        </div>
        <div class="next-action">
          <div>
            <strong>
              {{
                view.release
                  ? '已完成入库'
                  : version.review_state === 'final'
                    ? '下一步：将定稿交付包入库'
                    : version.review_state === 'reviewing'
                      ? '下一步：核对材料并完成修改意见'
                      : '下一步：补齐必交材料，提交交片'
              }}
            </strong>
            <p>
              {{
                view.release
                  ? '正式资源的上架、授权与分发在资源管理中操作。'
                  : version.review_state === 'final'
                    ? '全部材料已冻结。如需修改，请复制交付版本；入库不会自动上架。'
                    : `成片、无字幕版、无音乐版按集交付；提示词和工程截图覆盖前6集，另需海报及剧本简介。`
              }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Popconfirm
              v-if="view.can_edit && version.review_state === 'draft'"
              title="确认提交完整交付包并进入审片？交片后计划集数固定，材料仍可根据意见调整。"
              @confirm="transition('reviewing')"
              v-access:code="'res:review:submit'"
            >
              <Button
                type="primary"
                :disabled="
                  busy ||
                  missing.length > 0 ||
                  view.required === 0 ||
                  planned !== Number(version.planned_episodes)
                "
              >
                提交交片
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="view.can_manage && version.review_state === 'reviewing'"
              title="确认本轮修改全部完成？定稿后整套材料固定，只能复制新版本修改。"
              @confirm="transition('final')"
              v-access:code="'res:review:finalize'"
            >
              <Button
                type="primary"
                :disabled="busy || missing.length > 0 || view.pending > 0"
              >
                确认整包定稿
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="
                view.can_ingest &&
                version.review_state === 'final' &&
                !view.release
              "
              title="确认将此定稿包入库？将创建独立的资源和固定视频版本，不覆盖任何已有资源。"
              @confirm="ingest"
              v-access:code="'api:res.delivery.ingest'"
            >
              <Button type="primary" :loading="busy">定稿入库</Button>
            </Popconfirm>
            <Tag v-if="view.release" color="green">
              入库完成 ·
              {{
                new Date(
                  Number(view.release.created_at) * 1000,
                ).toLocaleDateString()
              }}
            </Tag>
          </div>
        </div>
        <nav class="workspace-tabs" aria-label="工作台视图">
          <Button
            :type="tab === 'materials' ? 'primary' : 'default'"
            @click="tab = 'materials'"
          >
            交付清单
          </Button>
          <Button
            :type="tab === 'review' ? 'primary' : 'default'"
            @click="tab = 'review'"
          >
            逐集审片
          </Button>
        </nav>
        <div v-show="tab === 'materials'">
          <div class="section-title">
            <div>
              <h3>作品级材料</h3>
              <p>海报和简介跟随交付版本定稿，历史版本保留。</p>
            </div>
          </div>
          <div class="global-materials">
            <button
              v-for="slot in groups"
              :key="slot.kind"
              class="global-material"
              @click="openSlot(slot)"
            >
              <span class="global-icon">
                {{ slot.kind === 'poster' ? '封' : '文' }}
              </span>
              <span>
                <strong>{{ slot.label }}</strong>
                <small>
                  {{
                    slot.complete
                      ? `${slot.asset?.files.length || 0} 个附件${slot.asset?.text ? ' · 已填写文字' : ''}`
                      : '必交 · 等待提交'
                  }}
                </small>
              </span>
              <Tag :color="slot.complete ? 'green' : 'orange'">
                {{
                  slot.locked ? '已锁定' : slot.complete ? '已提交' : '待补齐'
                }}
              </Tag>
            </button>
          </div>
          <div class="section-title">
            <div>
              <h3>逐集交付清单</h3>
              <p>
                点击单元格补交、预览或查看修改历史。第 7
                集起不要求提示词和工程截图。
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <template v-if="editable && version.review_state === 'draft'">
                <InputNumber
                  v-model:value="planned"
                  :min="1"
                  :max="1000"
                  :precision="0"
                  class="w-24"
                />
                <Button
                  :disabled="busy"
                  @click="transition('draft')"
                  v-access:code="'res:review:plan'"
                >
                  保存集数
                </Button>
              </template>
              <FilmBatch
                v-if="editable"
                :res="scope"
                :version="version.id"
                :items="review.detail.items"
                :planned="Number(version.planned_episodes)"
                :disabled="busy"
                @refresh="refresh()"
              />
            </div>
          </div>
          <div class="filter-bar">
            <Select
              v-model:value="filter"
              class="w-44"
              :options="[
                { value: 'all', label: '全部分集' },
                { value: 'missing', label: '只看缺材料' },
                { value: 'pending', label: '只看待处理意见' },
                { value: 'final', label: '只看已定稿' },
              ]"
            />
            <Input
              v-model:value="keyword"
              placeholder="定位集数"
              class="w-36"
              allow-clear
            />
            <Button @click="optional = !optional">
              {{ optional ? '收起可选项' : '可选项：SRT / DEMO / YouTube' }}
            </Button>
          </div>
          <Table
            row-key="no"
            :data-source="rows"
            :pagination="false"
            :scroll="{ x: optional ? 1200 : 850 }"
            :columns="[
              { title: '分集', key: 'episode', width: 105, fixed: 'left' },
              ...kinds.map((kind) => ({
                title: labels[kind],
                key: kind,
                minWidth: 135,
              })),
              { title: '审核进度', key: 'status', width: 155 },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <strong v-if="column.key === 'episode'">
                第 {{ record.no }} 集
              </strong>
              <template v-else-if="column.key === 'status'">
                <Tag v-if="record.locked" color="green">已定稿</Tag>
                <Button
                  v-else
                  type="link"
                  @click="
                    openSlot({
                      kind: 'film',
                      seq_no: record.no,
                    } as DeliverySlot)
                  "
                >
                  {{
                    record.pending ? `${record.pending} 条待处理` : '进入审片'
                  }}
                </Button>
              </template>
              <template v-else>
                <Button
                  v-if="
                    record.slots.some(
                      (s: DeliverySlot) => s.kind === column.key,
                    )
                  "
                  class="slot-button"
                  :class="{
                    'slot-complete': record.slots.find(
                      (s: DeliverySlot) => s.kind === column.key,
                    )?.complete,
                  }"
                  @click="
                    openSlot(
                      record.slots.find(
                        (s: DeliverySlot) => s.kind === column.key,
                      )!,
                    )
                  "
                >
                  {{
                    record.slots.find(
                      (s: DeliverySlot) => s.kind === column.key,
                    )?.complete
                      ? '✓ 已提交'
                      : view.can_edit
                        ? '＋ 提交'
                        : '待提交'
                  }}
                </Button>
                <span v-else class="text-muted-foreground">不要求</span>
              </template>
            </template>
            <template #emptyText>
              <Empty description="没有符合筛选条件的分集" />
            </template>
          </Table>
          <Pagination
            v-if="episodeRows.length > 20"
            v-model:current="page"
            :total="episodeRows.length"
            :page-size="20"
            :show-size-changer="false"
            class="mt-4"
          />
        </div>
        <ReviewWorkbench
          v-if="auditOpened"
          v-show="tab === 'review'"
          ref="audit"
          :key="String(version.id)"
          :res="scope"
          :name="name"
          :initial-version="version.id"
          :initial-seq="auditSeq"
          compact
          @changed="refresh()"
        />
        <MaterialPanel
          :scope="scope"
          :version="version.id"
          :selected-slot="selected"
          :view="view"
          @close="selected = undefined"
          @changed="refresh()"
        />
      </template>
    </Spin>
    <Modal
      :open="newOpen"
      :title="copyMode ? '复制交付版本' : '创建全新交付版本'"
      :confirm-loading="busy"
      :ok-button-props="{ disabled: !newName.trim() }"
      @ok="createVersion"
      @cancel="!busy && (newOpen = false)"
    >
      <Alert
        type="info"
        :message="
          copyMode
            ? '复制全部视频与当前交付材料；新版本回到制作中，不继承定稿和审核结论。'
            : '创建空版本，需要重新设置计划集数并提交完整交付材料。'
        "
        class="mb-3"
      />
      <Input
        v-model:value="newName"
        :maxlength="100"
        placeholder="版本名称，如：第二轮字幕修订"
      />
      <Alert v-if="errorText" type="error" :message="errorText" class="mt-3" />
    </Modal>
  </section>
</template>
<style scoped>
.delivery-workspace {
  min-width: 0;
}

.workspace-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.eyebrow {
  margin-bottom: 6px;
  font-size: 12px;
  color: hsl(var(--primary));
  letter-spacing: 2px;
}

.workspace-header h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 650;
}

.subheading {
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stage-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 20px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.stage-strip span {
  padding: 14px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--muted) / 35%);
}

.stage-strip .active {
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.version-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin: 18px 0;
}

.version-select {
  min-width: 260px;
}

.delivery-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 20px 0;
}

.delivery-summary > div {
  padding: 20px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.delivery-summary span {
  display: block;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.delivery-summary strong {
  display: block;
  margin: 12px 0;
  font-size: 30px;
  font-weight: 600;
}

.delivery-summary small {
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.next-action {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  margin-bottom: 24px;
  background: hsl(var(--primary) / 5%);
  border: 1px solid hsl(var(--primary) / 20%);
  border-radius: 10px;
}

.next-action p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.workspace-tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 18px;
  margin-bottom: 22px;
  border-bottom: 1px solid hsl(var(--border));
}

.section-title {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin: 24px 0 16px;
}

.section-title h3 {
  font-size: 17px;
  font-weight: 600;
}

.section-title p {
  margin: 6px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.global-materials {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.global-material {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px;
  text-align: left;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.global-material:hover {
  border-color: hsl(var(--primary));
}

.global-material > span:nth-child(2) {
  flex: 1;
}

.global-material small {
  display: block;
  margin-top: 6px;
  color: hsl(var(--muted-foreground));
}

.global-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 48px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 8px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0;
}

.slot-button {
  width: 100%;
  font-size: 12px;
}

.slot-complete {
  color: #16804a;
  background: #effaf4;
  border-color: #b9e2cb;
}

@media (max-width: 900px) {
  .workspace-header,
  .next-action {
    flex-direction: column;
    align-items: flex-start;
  }

  .delivery-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .global-materials {
    grid-template-columns: minmax(0, 1fr);
  }

  .stage-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .delivery-summary > div {
    padding: 14px;
  }

  .workspace-header h2 {
    font-size: 22px;
  }
}
</style>
