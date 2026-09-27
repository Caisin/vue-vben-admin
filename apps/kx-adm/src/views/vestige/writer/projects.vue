<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type {
  DraftKind,
  DraftSummary,
  ProjectWrite,
  WriterProject,
} from '#/api/vestige/projects';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'antdv-next';

import { ProjectApi } from '#/api/vestige/projects';
import { requestErrorMessage } from '#/request-errors';

import { useRoleConfirmation } from '../confirmation';
import DraftView from './draft.vue';
import { projectForm, projectWrite } from './project-form';
const props = defineProps<{
  access: RoleAccess;
  activeVersion: number;
  refreshKey: number;
}>();
const emit = defineEmits<{ task: [] }>();
const canWrite = computed(() => props.access.permission !== 'viewer');
const manage = computed(() => props.access.permission === 'owner');
const rows = ref<WriterProject[]>([]);
const page = ref(0);
const more = ref(false);
const busy = ref(false);
const errorText = ref('');
const selected = ref<WriterProject>();
const drafts = ref<DraftSummary[]>([]);
const draftPage = ref(0);
const draftMore = ref(false);
const draft = ref<DraftSummary>();
const draftOpen = ref(false);
const editor = ref(false);
const editingProject = ref<WriterProject>();
const form = ref(projectForm());
const saving = ref(false);
const writing = ref(false);
const writingProject = ref<WriterProject>();
const kind = ref<DraftKind>('outline');
const requirements = ref('');
let generation = 0;
const confirm = useRoleConfirmation(() => [
  props.access.role.id,
  props.access.permission,
  selected.value?.id,
  editor.value,
]);
let listRequest = 0;
let draftRequest = 0;
let projectRequest = 0;
let editRequest = 0;
const draftsLoading = ref(false);
const formats = [
  { value: 'short_drama', label: '短剧' },
  { value: 'web_series', label: '网剧' },
  { value: 'film', label: '电影' },
  { value: 'tv_series', label: '电视剧' },
];
const kinds = [
  { value: 'outline', label: '大纲' },
  { value: 'episode', label: '单集' },
  { value: 'scene', label: '场景' },
];
const kindName = (value: DraftKind) =>
  kinds.find((k) => k.value === value)?.label || value;
const versionOptions = computed(() =>
  [
    ...new Set([
      editingProject.value?.role_version ?? props.activeVersion,
      props.activeVersion,
    ]),
  ].map((version) => ({
    value: version,
    label:
      version === props.activeVersion
        ? `v${version} · 角色当前生效版本`
        : `v${version} · 项目原固定版本`,
  })),
);
async function load() {
  const current = generation;
  const request = ++listRequest;
  busy.value = true;
  errorText.value = '';
  try {
    const result = await ProjectApi.list(props.access.role.id, page.value * 15);
    if (current !== generation || request !== listRequest) return;
    rows.value = result.projects.slice(0, 15);
    more.value = result.projects.length > 15;
  } catch (error) {
    if (current === generation && request === listRequest)
      errorText.value = requestErrorMessage(error, '项目列表读取失败');
  } finally {
    if (current === generation && request === listRequest) busy.value = false;
  }
}
async function loadDrafts() {
  const project = selected.value;
  if (!project) return;
  const current = generation;
  const request = ++draftRequest;
  draftsLoading.value = true;
  try {
    const result = await ProjectApi.drafts(
      props.access.role.id,
      project.id,
      draftPage.value * 15,
    );
    if (
      current === generation &&
      request === draftRequest &&
      selected.value?.id === project.id
    ) {
      drafts.value = result.drafts.slice(0, 15);
      draftMore.value = result.drafts.length > 15;
    }
  } catch (error) {
    if (current === generation && request === draftRequest)
      errorText.value = requestErrorMessage(error, '草稿列表读取失败');
  } finally {
    if (current === generation && request === draftRequest)
      draftsLoading.value = false;
  }
}
async function openProject(project: WriterProject) {
  const current = ++generation;
  selected.value = undefined;
  drafts.value = [];
  draftPage.value = 0;
  draftOpen.value = false;
  errorText.value = '';
  try {
    const result = await ProjectApi.get(props.access.role.id, project.id);
    if (current === generation) {
      selected.value = result.project;
      await loadDrafts();
    }
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '项目详情读取失败');
  }
}
async function refreshProject() {
  const project = selected.value;
  if (!project) return;
  const current = generation;
  const request = ++projectRequest;
  try {
    const result = await ProjectApi.get(props.access.role.id, project.id);
    if (
      current === generation &&
      request === projectRequest &&
      selected.value?.id === project.id
    )
      selected.value = result.project;
  } catch (error) {
    if (current === generation && request === projectRequest)
      errorText.value = requestErrorMessage(error, '项目详情读取失败');
  }
}
function back() {
  generation++;
  selected.value = undefined;
  draftOpen.value = false;
  void load();
}
async function edit(project?: WriterProject) {
  if (!canWrite.value) return;
  const current = generation;
  const request = ++editRequest;
  try {
    const response = project
      ? await ProjectApi.get(props.access.role.id, project.id)
      : undefined;
    const latest = response?.project;
    if (current !== generation || request !== editRequest) return;
    editingProject.value = latest;
    form.value = projectForm(latest, props.activeVersion);
    editor.value = true;
  } catch (error) {
    message.error(requestErrorMessage(error, '无法读取项目设定'));
  }
}
async function saveProject() {
  if (!canWrite.value || saving.value) return;
  let input: ProjectWrite;
  try {
    input = projectWrite(form.value, editingProject.value?.canon);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '项目设定无效');
    return;
  }
  const previous = editingProject.value;
  const role = props.access.role.id;
  const current = generation;
  const persist = async () => {
    if (current !== generation || !canWrite.value || saving.value) return;
    saving.value = true;
    try {
      const result = previous
        ? await ProjectApi.update(role, previous.id, previous.revision, input)
        : await ProjectApi.create(role, input);
      if (current !== generation) return;
      editor.value = false;
      await load();
      await openProject(result.project);
      message.success('项目设定已保存');
    } catch (error) {
      message.error(
        requestErrorMessage(
          error,
          '保存失败；项目可能已被其他成员修改，请保留输入后重新读取',
        ),
      );
      throw error;
    } finally {
      saving.value = false;
    }
  };
  if (previous && previous.role_version !== input.role_version) {
    confirm({
      title: '更换项目固定规则版本？',
      content: `从 v${previous.role_version} 改为 v${input.role_version}。旧草稿和审稿保留原版本标记，后续任务使用新规则。`,
      okText: '确认采用新规则',
      cancelText: '取消',
      onOk: persist,
    });
  } else {
    try {
      await persist();
    } catch {
      /* message already displayed */
    }
  }
}
function startWriting() {
  writingProject.value = selected.value;
  kind.value = 'outline';
  requirements.value = '';
  writing.value = true;
}
async function submitWrite() {
  if (
    !writingProject.value ||
    !canWrite.value ||
    saving.value ||
    !requirements.value.trim()
  )
    return;
  saving.value = true;
  try {
    await ProjectApi.write(
      props.access.role.id,
      writingProject.value,
      kind.value,
      requirements.value.trim(),
    );
    writing.value = false;
    message.success('写作任务已排队，等待 Agent');
    emit('task');
  } catch (error) {
    message.error(
      requestErrorMessage(
        error,
        '写作任务提交失败；项目可能已更新，请刷新后重新提交',
      ),
    );
  } finally {
    saving.value = false;
  }
}
function removeProject(project: WriterProject) {
  const role = props.access.role.id;
  confirm({
    title: `删除项目“${project.name}”？`,
    content:
      '将清除关联草稿、审稿和项目任务。角色的素材与已发布规则会保留。此操作无法撤销。',
    okText: '删除项目',
    cancelText: '取消',
    okButtonProps: { danger: true },
    async onOk() {
      try {
        await ProjectApi.remove(role, project.id);
        if (role !== props.access.role.id) return;
        generation++;
        selected.value = undefined;
        draftOpen.value = false;
        await load();
      } catch (error) {
        message.error(requestErrorMessage(error, '删除失败'));
        throw error;
      }
    },
  });
}
function removeDraft(item: DraftSummary) {
  const role = props.access.role.id;
  confirm({
    title: `删除草稿“${item.title}”？`,
    content: '此草稿的全部修订与关联审稿将被清除。此操作无法撤销。',
    okText: '删除草稿',
    cancelText: '取消',
    okButtonProps: { danger: true },
    async onOk() {
      try {
        await ProjectApi.removeDraft(role, item.id);
        if (role === props.access.role.id) await loadDrafts();
      } catch (error) {
        message.error(requestErrorMessage(error, '删除失败'));
        throw error;
      }
    },
  });
}
function canonText(key: 'characters' | 'constraints' | 'world') {
  const data = selected.value?.canon.workbench;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const value = (data as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  }
  return '';
}
const otherCanon = computed(
  () =>
    !!selected.value &&
    Object.keys(selected.value.canon).some((k) => k !== 'workbench'),
);
watch(
  () => props.access.role.id,
  () => {
    generation++;
    selected.value = undefined;
    rows.value = [];
    drafts.value = [];
    editor.value = false;
    writing.value = false;
    page.value = 0;
    void load();
  },
  { immediate: true },
);
watch(
  () => props.refreshKey,
  () => {
    void load();
    void loadDrafts();
    void refreshProject();
  },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
  <template v-if="!selected">
    <div class="mb-3 flex gap-2">
      <Button v-if="canWrite" type="primary" @click="edit()">
        新建创作项目
      </Button>
      <Button :loading="busy" @click="load">刷新项目</Button>
    </div>
    <Table
      :data-source="rows"
      row-key="id"
      :loading="busy"
      :pagination="false"
      :scroll="{ x: 560 }"
      size="small"
      :columns="[
        { title: '项目', key: 'name' },
        { title: '类型', key: 'format' },
        { title: '固定规则', key: 'version' },
        { title: '操作', key: 'actions' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'name'"
          type="link"
          @click="openProject(record)"
        >
          {{ record.name }}
        </Button>
        <template v-else-if="column.key === 'format'">
          {{
            formats.find((f) => f.value === record.format)?.label ||
            record.format
          }}
        </template>
        <Tag v-else-if="column.key === 'version'">
          v{{ record.role_version }}
        </Tag>
        <Button
          v-else-if="column.key === 'actions' && manage"
          type="link"
          danger
          @click="removeProject(record)"
        >
          删除
        </Button>
      </template>
    </Table>
    <div class="mt-3 flex justify-between">
      <Button
        :disabled="busy || page === 0"
        @click="
          page--;
          load();
        "
      >
        上一页
      </Button>
      <span>第 {{ page + 1 }} 页</span>
      <Button
        :disabled="busy || !more"
        @click="
          page++;
          load();
        "
      >
        下一页
      </Button>
    </div>
  </template>
  <template v-else>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <Button @click="back">返回项目列表</Button>
      <strong>{{ selected.name }}</strong>
      <Tag>固定规则 v{{ selected.role_version }}</Tag>
      <Button v-if="canWrite" @click="edit(selected)">编辑项目设定</Button>
    </div>
    <Alert
      v-if="selected.role_version !== activeVersion"
      type="info"
      class="mb-3"
      :message="`角色当前为 v${activeVersion}，此项目仍固定 v${selected.role_version}。需要更换时请显式编辑项目。`"
    />
    <Descriptions :column="1" bordered size="small">
      <DescriptionsItem label="创作简述">
        <p class="whitespace-pre-wrap break-words">
          {{ selected.brief }}
        </p>
      </DescriptionsItem>
      <DescriptionsItem v-if="canonText('world')" label="世界观">
        {{ canonText('world') }}
      </DescriptionsItem>
      <DescriptionsItem v-if="canonText('characters')" label="人物">
        {{ canonText('characters') }}
      </DescriptionsItem>
      <DescriptionsItem v-if="canonText('constraints')" label="创作约束">
        {{ canonText('constraints') }}
      </DescriptionsItem>
    </Descriptions>
    <p v-if="otherCanon" class="my-3 text-sm text-muted-foreground">
      项目还保留由 Agent 维护的结构化设定，写作上下文会一并读取。
    </p>
    <div class="my-4 flex gap-2">
      <Button v-if="canWrite" type="primary" @click="startWriting">
        提交写作任务
      </Button>
      <Button
        @click="
          loadDrafts();
          refreshProject();
        "
      >
        刷新草稿
      </Button>
    </div>
    <Table
      :data-source="drafts"
      :loading="draftsLoading"
      row-key="id"
      :pagination="false"
      size="small"
      :scroll="{ x: 540 }"
      :columns="[
        { title: '草稿', key: 'title' },
        { title: '类型', key: 'kind' },
        { title: '修订/规则', key: 'revision' },
        { title: '操作', key: 'action' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'title'"
          type="link"
          @click="
            draft = record;
            draftOpen = true;
          "
        >
          {{ record.title }}
        </Button>
        <template v-else-if="column.key === 'kind'">
          {{ kindName(record.kind) }}
        </template>
        <template v-else-if="column.key === 'revision'">
          r{{ record.revision }} · v{{ record.role_version }}
        </template>
        <Button
          v-else-if="column.key === 'action' && manage"
          type="link"
          danger
          @click="removeDraft(record)"
        >
          删除
        </Button>
      </template>
    </Table>
    <div class="mt-3 flex justify-between">
      <Button
        :disabled="draftsLoading || draftPage === 0"
        @click="
          draftPage--;
          loadDrafts();
        "
      >
        上一页
      </Button>
      <span>第 {{ draftPage + 1 }} 页</span>
      <Button
        :disabled="draftsLoading || !draftMore"
        @click="
          draftPage++;
          loadDrafts();
        "
      >
        下一页
      </Button>
    </div>
  </template>
  <Modal
    v-model:open="editor"
    :title="editingProject ? '编辑项目设定' : '新建创作项目'"
    ok-text="保存项目"
    :confirm-loading="saving"
    :closable="!saving"
    :mask-closable="!saving"
    :keyboard="!saving"
    @ok="saveProject"
  >
    <div class="space-y-3">
      <div>
        <label for="writer-project-name" class="mb-2 block">项目名称</label>
        <Input
          id="writer-project-name"
          v-model:value="form.name"
          :maxlength="90"
          :disabled="saving"
        />
      </div>
      <div>
        <label for="writer-project-format" class="mb-2 block">剧本类型</label>
        <Select
          id="writer-project-format"
          v-model:value="form.format"
          :options="formats"
          class="w-full"
          :disabled="saving"
        />
      </div>
      <div>
        <label for="writer-project-version" class="mb-2 block">
          固定规则版本
        </label>
        <Select
          id="writer-project-version"
          v-model:value="form.role_version"
          :options="versionOptions"
          class="w-full"
          :disabled="saving"
        />
      </div>
      <div>
        <label for="writer-project-brief" class="mb-2 block">创作简述</label>
        <Input.TextArea
          id="writer-project-brief"
          v-model:value="form.brief"
          :rows="3"
          :maxlength="5000"
          :disabled="saving"
        />
      </div>
      <div>
        <label for="writer-project-world" class="mb-2 block">世界观</label>
        <Input.TextArea
          id="writer-project-world"
          v-model:value="form.world"
          :rows="2"
          :maxlength="2000"
          :disabled="saving"
        />
      </div>
      <div>
        <label for="writer-project-characters" class="mb-2 block">
          人物与关系
        </label>
        <Input.TextArea
          id="writer-project-characters"
          v-model:value="form.characters"
          :rows="2"
          :maxlength="2000"
          :disabled="saving"
        />
      </div>
      <div>
        <label for="writer-project-constraints" class="mb-2 block">
          创作约束
        </label>
        <Input.TextArea
          id="writer-project-constraints"
          v-model:value="form.constraints"
          :rows="2"
          :maxlength="2000"
          :disabled="saving"
        />
      </div>
    </div>
  </Modal>
  <Modal
    v-model:open="writing"
    title="提交写作任务"
    ok-text="提交给 Agent"
    :confirm-loading="saving"
    :closable="!saving"
    :mask-closable="!saving"
    :ok-button-props="{ disabled: !requirements.trim() }"
    @ok="submitWrite"
  >
    <p class="mb-3">
      使用项目固定规则 v{{ writingProject?.role_version }}
      和项目设定生成原创内容。
    </p>
    <label for="writer-draft-kind" class="mb-2 block">写作目标</label>
    <Select
      id="writer-draft-kind"
      v-model:value="kind"
      :options="kinds"
      class="mb-3 w-full"
    />
    <label for="writer-write-request" class="mb-2 block">具体要求</label>
    <Input.TextArea
      id="writer-write-request"
      v-model:value="requirements"
      :rows="4"
      :maxlength="3000"
    />
  </Modal>
  <DraftView
    v-if="selected"
    v-model:open="draftOpen"
    :access="access"
    :project="selected"
    :summary="draft"
    :refresh-key="refreshKey"
    @changed="loadDrafts"
    @task="emit('task')"
  />
</template>
