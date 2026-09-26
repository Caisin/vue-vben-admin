<script setup lang="ts">
import type {
  PublishedDetail,
  PublishedMedia,
  PublishedProject,
  PublishedVersion,
} from '#/api/script-pipeline';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { downloadFileFromBlob } from '@vben/utils';

import { Alert, Card, Empty, Space, Table, Tag, Typography } from 'antdv-next';

import { PublishedScriptPipelineApi } from '#/api/script-pipeline';

const projects = ref<PublishedProject[]>([]);
const versions = ref<PublishedVersion[]>([]);
const detail = ref<PublishedDetail>();
const media = ref<PublishedMedia[]>([]);
const error = ref('');
const rows = computed(() => detail.value?.items ?? []);
const shotColumns = [
  { title: '镜头', dataIndex: 'key' },
  { title: '时长(ms)', dataIndex: 'duration_ms' },
  { title: '动作', dataIndex: 'action' },
  { title: '情绪', dataIndex: 'emotion' },
  { title: '对白', dataIndex: 'dialogue' },
];

async function downloadMedia(item: PublishedMedia) {
  if (!detail.value) return;
  const blob = await PublishedScriptPipelineApi.mediaDownload(
    detail.value.version.id,
    item.key,
  );
  downloadFileFromBlob({ fileName: item.file_name, source: blob });
}
async function load() {
  try {
    projects.value = await PublishedScriptPipelineApi.projects();
    if (projects.value[0]) await chooseProject(projects.value[0]);
  } catch {
    error.value = '最终交付加载失败，请联系管理员';
  }
}
async function chooseProject(project: PublishedProject) {
  versions.value = await PublishedScriptPipelineApi.versions(project.id);
  if (versions.value[0]) await chooseVersion(versions.value[0]);
}
async function chooseVersion(version: PublishedVersion) {
  detail.value = await PublishedScriptPipelineApi.detail(version.id);
  const mediaPage = await PublishedScriptPipelineApi.media(version.id);
  media.value = mediaPage.items;
}
onMounted(load);
</script>

<template>
  <Page
    title="最终分镜交付"
    description="仅显示已发布的模型提示词、分镜与授权素材；不显示流程、节点、审核或中间产物。"
  >
    <Alert v-if="error" type="error" :message="error" show-icon />
    <div class="delivery-grid">
      <Card title="作品">
        <Table
          :data-source="projects"
          :columns="[
            { title: '作品', dataIndex: 'title' },
            { title: '操作', key: 'action' },
          ]"
          :pagination="false"
          row-key="id"
          @row-click="chooseProject"
        >
          <template #bodyCell="{ column, record }">
            <a v-if="column.key === 'action'" @click="chooseProject(record)">查看</a>
          </template>
        </Table>
        <Empty v-if="!projects.length" description="暂无已发布交付" />
      </Card>

      <Card :title="detail?.version.title || '交付版本'">
        <Space wrap>
          <Tag
            v-for="version in versions"
            :key="version.id"
            class="clickable"
            @click="chooseVersion(version)"
          >
            {{ version.title }}
          </Tag>
        </Space>
        <div v-for="item in rows" :key="item.clip_key" class="prompt-item">
          <Typography.Title :level="5">
            {{ item.scene_key }} / {{ item.clip_key }} · {{ item.target_model }}
          </Typography.Title>
          <Typography.Paragraph copyable>
            {{ item.prompt }}
          </Typography.Paragraph>
          <Table
            :data-source="item.shots"
            :columns="shotColumns"
            size="small"
            :pagination="false"
            row-key="key"
          />
        </div>
        <Empty v-if="!rows.length" description="暂无交付内容" />
      </Card>

      <Card title="授权素材">
        <Table
          :data-source="media"
          :columns="[
            { title: '对象', dataIndex: 'subject_key' },
            { title: '用途', dataIndex: 'purpose' },
            { title: '类型', dataIndex: 'mime' },
            { title: '操作', key: 'action' },
          ]"
          :pagination="false"
          row-key="key"
        >
          <template #bodyCell="{ column, record }">
            <a v-if="column.key === 'action'" @click="downloadMedia(record)">下载</a>
          </template>
        </Table>
        <Empty v-if="!media.length" description="该版本没有可下载素材" />
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.delivery-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.6fr) minmax(520px, 1.6fr);
  gap: 16px;
}

.prompt-item {
  padding-top: 12px;
  margin-top: 16px;
  border-top: 1px solid var(--color-border);
}

.clickable {
  cursor: pointer;
}

@media (max-width: 960px) {
  .delivery-grid {
    grid-template-columns: 1fr;
  }
}
</style>
