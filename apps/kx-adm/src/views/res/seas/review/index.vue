<script setup lang="ts">
import type { DeliveryProject } from '#/api/res/delivery';
import type { ReviewResource } from '#/api/res/review';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Table,
  Tag,
} from 'antdv-next';

import { deliveryApi } from '#/api/res/delivery';
import { reviewApi, reviewLabels } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';

import ReviewMembers from '../global/source_manage/modules/review-members.vue';
import ReviewWorkbench from '../global/source_manage/modules/review-workbench.vue';
import DeliveryGuide from './delivery-guide.vue';
import Workspace from './workspace.vue';
const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const canCreate = computed(
  () =>
    hasAccessByCodes(['api:res.delivery.projects.create']) &&
    (hasAccessByCodes(['res:review:manage']) ||
      hasAccessByCodes(['res:content:manage'])),
);
const archive = computed(() => route.path === '/production/archive');
const workbench = computed(() => route.path === '/production/workbench');
const rows = ref<DeliveryProject[]>([]);
const selected = ref<ReviewResource>();
const page = ref(1);
const total = ref(0);
const keyword = ref('');
const stage = ref('');
const loading = ref(false);
const errorText = ref('');
const createOpen = ref(false);
const name = ref('');
const planned = ref(6);
const busy = ref(false);
const selectedVersion = ref<string>();
const membersOpen = ref(false);
const membersProject = ref<DeliveryProject>();
const ownerProject = ref<DeliveryProject>();
const ownerOpen = ref(false);
const ownerUid = ref<string>();
const ownerUsers = ref<{ id: number; name: string }[]>([]);
let generation = 0;
async function load() {
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await deliveryApi.list(
      keyword.value,
      archive.value ? 'final' : stage.value,
      page.value,
    );
    if (ticket === generation) {
      rows.value = result.items;
      total.value = Number(result.total);
    }
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取制作项目失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
async function openFromRoute() {
  if (!route.query.res) {
    selected.value = undefined;
    return;
  }
  try {
    selectedVersion.value =
      typeof route.query.version === 'string' ? route.query.version : undefined;
    selected.value = await reviewApi.resource(String(route.query.res));
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取项目失败');
  }
}
async function openOwner(row: DeliveryProject) {
  ownerProject.value = row;
  ownerOpen.value = true;
  ownerUid.value = undefined;
  try {
    const result = await reviewApi.users('', 1);
    ownerUsers.value = result.items.map((u) => ({
      id: Number(u.id),
      name: u.name,
    }));
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取用户失败');
  }
}
async function transferOwner() {
  if (!ownerProject.value || !ownerUid.value) return;
  busy.value = true;
  try {
    await deliveryApi.transferOwner(ownerProject.value.scope, ownerUid.value);
    ownerOpen.value = false;
    await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '转移拥有者失败');
  } finally {
    busy.value = false;
  }
}
function openMembers(row: DeliveryProject) {
  membersProject.value = row;
  membersOpen.value = true;
}
function choose(row: DeliveryProject) {
  selected.value = {
    id: row.scope,
    res_name: row.project.name,
    resource_code: row.project.code,
  };
  selectedVersion.value = row.version ? String(row.version.id) : undefined;
  void router.replace({
    query: { res: String(row.scope), version: selectedVersion.value },
  });
}
async function create() {
  busy.value = true;
  errorText.value = '';
  try {
    const row = await deliveryApi.create(name.value.trim(), planned.value);
    createOpen.value = false;
    choose(row);
    await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '创建项目失败');
  } finally {
    busy.value = false;
  }
}
watch(() => route.query.res, openFromRoute);
watch(archive, () => {
  page.value = 1;
  stage.value = '';
  selected.value = undefined;
  void router.replace({ query: {} });
  void load();
});
onMounted(() => {
  void load();
  void openFromRoute();
});
</script>
<template>
  <Page
    :title="workbench ? '个人工作台' : archive ? '定稿档案' : '作品交付'"
    :description="
      workbench
        ? '查看参与项目的审片进度、待处理建议和缺失交付材料。'
        : archive
          ? '查看已定稿的交付包与入库记录，历史版本保持固定。'
          : '独立管理制作、交付材料与审核；定稿后再进入资源管理。'
    "
  >
    <div class="delivery-page">
      <Alert v-if="errorText" type="error" :message="errorText" class="mb-4" />
      <template v-if="selected">
        <Button
          class="mb-5"
          @click="
            selected = undefined;
            router.replace({ query: {} });
            load();
          "
        >
          ← 返回{{ archive ? '定稿档案' : '作品列表' }}
        </Button>
        <Workspace
          v-if="Number(selected.id) < 0"
          :key="String(selected.id)"
          :scope="selected.id"
          :name="selected.res_name"
          :initial-version="selectedVersion"
        />
        <template v-else>
          <Alert
            class="mb-4"
            type="info"
            message="这是原资源的历史审核，记录和流程继续保留。新作品请返回“作品交付”创建独立制作项目，按完整材料清单交付。"
          />
          <ReviewWorkbench
            :key="String(selected.id)"
            :res="selected.id"
            :name="selected.res_name"
            :initial-version="selectedVersion"
          />
        </template>
      </template>
      <template v-else>
        <div class="list-heading">
          <div>
            <h2>{{ archive ? '定稿交付档案' : '从完整交付，到放心入库' }}</h2>
            <p>
              {{
                archive
                  ? '视频与材料保留在同一个交付版本里，可追溯每次修改。'
                  : '每部作品一张交付清单。团队在这里协作，正式资源库只接收定稿。'
              }}
            </p>
          </div>
          <div class="flex gap-2">
            <DeliveryGuide />
            <Button
              v-if="canCreate && !archive && !workbench"
              type="primary"
              @click="
                name = '';
                planned = 6;
                createOpen = true;
              "
            >
              ＋ 创建制作项目
            </Button>
          </div>
        </div>
        <div v-if="!workbench" class="delivery-legend">
          <span>01 准备交付材料</span>
          <span>02 提交交片与审片</span>
          <span>03 修改完成后定稿</span>
          <span>04 入库资源管理</span>
        </div>
        <div class="list-filters">
          <Input
            v-model:value="keyword"
            placeholder="搜索作品名称 / 编号"
            class="max-w-sm"
            allow-clear
            @press-enter="
              page = 1;
              load();
            "
          />
          <Select
            v-if="!archive && !workbench"
            v-model:value="stage"
            class="w-44"
            :options="[
              { value: '', label: '全部阶段' },
              { value: 'draft', label: '准备交付' },
              { value: 'reviewing', label: '审片与修改' },
              { value: 'final', label: '已定稿' },
            ]"
            @change="
              page = 1;
              load();
            "
          />
          <Button
            :loading="loading"
            @click="
              page = 1;
              load();
            "
          >
            查询
          </Button>
        </div>
        <Table
          :loading="loading"
          :data-source="rows"
          row-key="scope"
          :scroll="{ x: 950 }"
          :pagination="{
            current: page,
            pageSize: 20,
            total,
            showSizeChanger: false,
          }"
          @change="
            (p) => {
              page = p.current || 1;
              load();
            }
          "
          :columns="[
            { title: '作品', key: 'name', minWidth: 240 },
            { title: '当前交付版本', key: 'version', minWidth: 180 },
            { title: '必交材料', key: 'materials', width: 200 },
            { title: '待处理', key: 'pending', width: 100 },
            { title: '协作者', key: 'members', width: 125 },
            { title: '下一步', key: 'action', width: 160 },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <div v-if="column.key === 'name'">
              <Button type="link" class="project-name" @click="choose(record)">
                {{ record.project.name }}
              </Button>
              <small class="project-code">
                {{ record.project.code }} ·
                {{ record.version?.planned_episodes || 0 }} 集
              </small>
            </div>
            <div v-else-if="column.key === 'version'">
              <p class="mb-2">{{ record.version?.name || '尚无版本' }}</p>
              <Tag
                :color="
                  record.release
                    ? 'blue'
                    : record.version?.review_state === 'final'
                      ? 'green'
                      : 'orange'
                "
              >
                {{
                  record.release
                    ? '已入库'
                    : reviewLabels[
                        record.version
                          ?.review_state as keyof typeof reviewLabels
                      ] || '准备交付'
                }}
              </Tag>
            </div>
            <div v-else-if="column.key === 'materials'">
              <strong>{{ record.submitted }} / {{ record.required }}</strong>
              <Progress
                :percent="
                  record.required
                    ? Math.round((record.submitted * 100) / record.required)
                    : 0
                "
                :show-info="false"
              />
            </div>
            <div v-else-if="column.key === 'members'">
              <Button
                size="small"
                @click="openMembers(record)"
                v-access:code="'api:res.review.members'"
              >
                添加协作者
              </Button>
              <Button
                size="small"
                @click="openOwner(record)"
                v-access:code="'api:res.delivery.owner.transfer'"
              >
                转移拥有者
              </Button>
            </div>
            <Tag
              v-else-if="column.key === 'pending'"
              :color="record.pending ? 'orange' : 'default'"
            >
              {{ record.pending }} 条
            </Tag>
            <Button
              v-else-if="column.key === 'action'"
              type="primary"
              ghost
              @click="choose(record)"
            >
              {{
                workbench && record.pending
                  ? `处理 ${record.pending} 条待处理事项`
                  : record.release
                    ? '查看交付档案'
                    : record.version?.review_state === 'final'
                      ? '定稿 / 入库'
                      : record.version?.review_state === 'reviewing'
                        ? '进入审核修改'
                        : '补齐交付材料'
              }}
            </Button>
          </template>
          <template #emptyText>
            <Empty
              :description="
                archive
                  ? '暂无定稿交付包'
                  : '暂无制作项目；负责人可创建项目，协作者受邀后会在这里看到作品'
              "
            />
          </template>
        </Table>
      </template>
    </div>
    <Modal
      v-model:open="ownerOpen"
      title="转移项目拥有者"
      :confirm-loading="busy"
      :ok-button-props="{ disabled: !ownerUid }"
      @ok="transferOwner"
    >
      <Alert
        type="warning"
        message="转移后，新拥有者负责协作者、定稿和入库；原拥有者保留协作者身份。"
        class="mb-3"
      />
      <Select
        v-model:value="ownerUid"
        :options="ownerUsers.map((u) => ({ value: u.id, label: u.name }))"
        show-search
        placeholder="选择启用用户"
      />
    </Modal>
    <Modal
      v-model:open="ownerOpen"
      title="转移项目拥有者"
      :confirm-loading="busy"
      :ok-button-props="{ disabled: !ownerUid }"
      @ok="transferOwner"
    >
      <Alert
        type="warning"
        message="转移后，新拥有者负责协作者、定稿和入库；原拥有者保留协作者身份。"
        class="mb-3"
      />
      <Select
        v-model:value="ownerUid"
        :options="ownerUsers.map((u) => ({ value: u.id, label: u.name }))"
        show-search
        placeholder="选择启用用户"
      />
    </Modal>
    <ReviewMembers
      v-if="membersProject"
      v-model:open="membersOpen"
      :res="membersProject.scope"
      :name="membersProject.project.name"
      :show-trigger="false"
    />
    <Modal
      :open="createOpen"
      title="创建独立制作项目"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="!busy"
      :ok-button-props="{ disabled: !name.trim() }"
      ok-text="创建并准备交付"
      @ok="create"
      @cancel="!busy && (createOpen = false)"
    >
      <Alert
        type="info"
        class="mb-4"
        message="此操作不会创建资源库条目。定稿后再入库，作品编号自动生成。"
      />
      <label for="delivery-name" class="field-label">作品名称</label>
      <Input
        id="delivery-name"
        v-model:value="name"
        :maxlength="200"
        placeholder="例如：女王的獠牙"
      />
      <label for="delivery-count" class="field-label">计划集数</label>
      <InputNumber
        id="delivery-count"
        v-model:value="planned"
        :min="1"
        :max="1000"
        :precision="0"
        class="w-full"
      />
      <p class="mt-3 text-sm text-muted-foreground">
        自动生成成片、无字幕版、无音乐版及前6集提示词/工程截图的交付清单，并要求海报和剧本简介。
      </p>
      <Alert v-if="errorText" type="error" :message="errorText" class="mt-3" />
    </Modal>
  </Page>
</template>
<style scoped>
.delivery-page {
  padding: 28px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.list-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.list-heading h2 {
  font-size: 24px;
  font-weight: 650;
}

.list-heading p {
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
}

.delivery-legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 18px;
  margin-bottom: 24px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
  border-radius: 10px;
}

.list-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.project-code {
  display: block;
  padding-left: 15px;
  color: hsl(var(--muted-foreground));
}

.project-name {
  font-weight: 600;
}

.field-label {
  display: block;
  margin: 16px 0 8px;
  font-weight: 500;
}

@media (max-width: 750px) {
  .delivery-page {
    padding: 16px;
  }

  .delivery-legend {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
