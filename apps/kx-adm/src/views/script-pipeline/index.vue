<script setup lang="ts">
import type { ScriptProject, WorkflowGroup } from '#/api/script-pipeline';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'antdv-next';

import { ScriptPipelineApi } from '#/api/script-pipeline';

const { hasAccessByCodes } = useAccess();
const canManage = computed(() =>
  hasAccessByCodes(['script_pipeline.workflow.group.create']),
);
const projects = ref<ScriptProject[]>([]);
const groups = ref<WorkflowGroup[]>([]);
const selected = ref<ScriptProject>();
const loading = ref(false);
const error = ref('');
const createOpen = ref(false);
const groupOpen = ref(false);
const revisionOpen = ref(false);
const debugOpen = ref(false);
const projectForm = ref<{
  title: string;
  input_mode: ScriptProject['input_mode'];
}>({ title: '', input_mode: 'existing_script' });
const groupForm = ref({
  group_key: '',
  name: '',
  workflow_revision_id: 0,
  input_snapshot_hash: '',
  purpose: 'reference',
  kind: 'reference',
});
const revisionForm = ref({
  name: '',
  graph:
    '{\n  "format_version": 2,\n  "inputs": {},\n  "nodes": [],\n  "edges": [],\n  "gates": []\n}',
});
const debugForm = ref({
  source_run_id: 0,
  source_node_run_id: 0,
  mode: 'rerun_downstream',
  checkpoint_id: undefined as number | undefined,
  override_id: undefined as number | undefined,
});
const columns = [
  { title: '分组', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'kind', key: 'kind' },
  { title: '状态', dataIndex: 'state', key: 'state' },
  { title: '版本', dataIndex: 'revision', key: 'revision' },
  { title: '运行命名空间', dataIndex: 'run_namespace', key: 'run_namespace' },
];
async function loadProjects() {
  loading.value = true;
  try {
    projects.value = await ScriptPipelineApi.projects();
    error.value = '';
    if (!selected.value && projects.value[0]) await choose(projects.value[0]);
  } catch {
    error.value = '流程项目加载失败，请检查管理员权限或服务端状态';
  } finally {
    loading.value = false;
  }
}
async function choose(project: ScriptProject) {
  selected.value = project;
  groups.value = await ScriptPipelineApi.groups(project.id);
}
async function createProject() {
  if (!canManage.value) return;
  try {
    const project = await ScriptPipelineApi.createProject(projectForm.value);
    createOpen.value = false;
    await loadProjects();
    await choose(project);
    message.success('项目已创建');
  } catch {
    message.error('项目创建失败');
  }
}
async function createRevision() {
  if (!selected.value || !canManage.value) return;
  try {
    await ScriptPipelineApi.createRevision(selected.value.id, {
      name: revisionForm.value.name,
      graph: JSON.parse(revisionForm.value.graph),
    });
    revisionOpen.value = false;
    message.success('工作流草稿已创建，请在发布前继续校验');
  } catch {
    message.error('工作流 JSON 或版本创建失败');
  }
}
async function createDebug() {
  if (!canManage.value) return;
  try {
    await ScriptPipelineApi.debug(debugForm.value);
    debugOpen.value = false;
    message.success('断点调试已创建，后续节点将按服务端影响闭包执行');
  } catch {
    message.error('断点调试创建失败');
  }
}
async function createGroup() {
  if (!selected.value || !canManage.value) return;
  try {
    await ScriptPipelineApi.createGroup(selected.value.id, {
      ...groupForm.value,
      model_profile: {},
      budget: {},
    });
    groupOpen.value = false;
    await choose(selected.value);
    message.success('测试分组已创建');
  } catch {
    message.error('分组创建失败，请确认工作流版本和输入快照');
  }
}
onMounted(loadProjects);
</script>
<template>
  <Page
    title="自动剧本与分镜提示词"
    description="管理员编排流程、测试分组、节点提示词和断点调试；制作成员不显示此页面。"
  >
    <Alert v-if="error" type="error" :message="error" show-icon />
    <div class="pipeline-grid">
      <Card title="流程项目" :loading="loading">
        <template #extra>
          <Button v-if="canManage" type="primary" @click="createOpen = true">
            新建项目
          </Button>
        </template>
        <Table
          :data-source="projects"
          :columns="[
            { title: '项目', dataIndex: 'title' },
            { title: '入口', dataIndex: 'input_mode' },
            { title: '状态', dataIndex: 'state' },
          ]"
          :pagination="false"
          row-key="id"
          @row-click="(row: ScriptProject) => choose(row)"
        />
      </Card>
      <Card :title="selected ? `${selected.title} · 流程分组` : '流程分组'">
        <template #extra>
          <Space v-if="canManage && selected">
            <Button @click="revisionOpen = true">新建工作流版本</Button><Button @click="debugOpen = true">断点调试</Button><Button @click="groupOpen = true">新建测试分组</Button>
          </Space>
        </template>
        <Table
          :data-source="groups"
          :columns="columns"
          :pagination="false"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.key === 'state'"
              :color="record.state === 'ready' ? 'green' : 'blue'"
            >
              {{ record.state }}
            </Tag>
          </template>
        </Table>
      </Card>
    </div>
    <Modal
      v-model:open="createOpen"
      title="新建剧本流程项目"
      @ok="createProject"
    >
      <Form layout="vertical">
        <FormItem label="项目名称">
          <Input v-model:value="projectForm.title" />
</FormItem><FormItem label="入口">
          <Select
            v-model:value="projectForm.input_mode"
            :options="[
              { label: '已有剧本', value: 'existing_script' },
              { label: '原创编剧', value: 'original' },
              { label: '小说改编', value: 'adaptation' },
            ]"
          />
        </FormItem>
      </Form>
    </Modal>
    <Modal
      v-model:open="revisionOpen"
      title="新建工作流版本"
      @ok="createRevision"
    >
      <Form layout="vertical">
        <FormItem label="版本名称">
          <Input v-model:value="revisionForm.name" />
</FormItem><FormItem label="工作流图 JSON">
          <Input.TextArea v-model:value="revisionForm.graph" :rows="12" />
        </FormItem>
      </Form>
    </Modal>
    <Modal v-model:open="debugOpen" title="节点断点调试" @ok="createDebug">
      <Form layout="vertical">
        <FormItem label="源运行 ID">
          <Input
            v-model:value="debugForm.source_run_id"
            type="number"
          />
</FormItem><FormItem label="源节点运行 ID">
          <Input
            v-model:value="debugForm.source_node_run_id"
            type="number"
          />
</FormItem><FormItem label="模式">
          <Select
            v-model:value="debugForm.mode"
            :options="[
              { label: '重跑下游', value: 'rerun_downstream' },
              { label: '仅重跑节点', value: 'rerun_node' },
            ]"
          />
</FormItem><FormItem label="提示词覆盖 ID（可选）">
          <Input v-model:value="debugForm.override_id" type="number" />
        </FormItem>
      </Form>
    </Modal>
    <Modal v-model:open="groupOpen" title="新建测试分组" @ok="createGroup">
      <Form layout="vertical">
        <FormItem label="分组键">
          <Input v-model:value="groupForm.group_key" />
</FormItem><FormItem label="名称">
          <Input v-model:value="groupForm.name" />
</FormItem><FormItem label="工作流版本 ID">
          <Input
            v-model:value="groupForm.workflow_revision_id"
            type="number"
          />
</FormItem><FormItem label="输入快照摘要">
          <Input v-model:value="groupForm.input_snapshot_hash" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
<style scoped>
.pipeline-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(480px, 1.5fr);
  gap: 16px;
}

@media (max-width: 960px) {
  .pipeline-grid {
    grid-template-columns: 1fr;
  }
}
</style>
