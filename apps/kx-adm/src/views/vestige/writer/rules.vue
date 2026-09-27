<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type { Evidence, WriterVersion } from '#/api/vestige/writer';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, message, Modal, Table, Tag } from 'antdv-next';

import { WriterApi } from '#/api/vestige/writer';
import { requestErrorMessage } from '#/request-errors';

import { useRoleConfirmation } from '../confirmation';
import EvidenceView from './evidence.vue';
const props = defineProps<{
  access: RoleAccess;
  activeVersion: number;
  refreshKey: number;
}>();
const emit = defineEmits<{ changed: [] }>();
const canPublish = computed(() =>
  ['owner', 'publisher'].includes(props.access.permission),
);
const rows = ref<WriterVersion[]>([]);
const page = ref(0);
const more = ref(false);
const loading = ref(false);
const errorText = ref('');
const selected = ref<WriterVersion>();
const open = ref(false);
const evidence = ref<Evidence>();
const evidenceOpen = ref(false);
const saving = ref(false);
let generation = 0;
const confirm = useRoleConfirmation(() => [
  props.access.role.id,
  props.access.permission,
  props.activeVersion,
]);
async function load() {
  const current = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await WriterApi.versions(
      props.access.role.id,
      page.value * 10,
    );
    if (current === generation) {
      more.value = result.versions.length > 10;
      rows.value = result.versions.slice(0, 10);
    }
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '规则版本加载失败');
  } finally {
    if (current === generation) loading.value = false;
  }
}
function adopt(version: WriterVersion, rollback = false) {
  if (!canPublish.value || saving.value) return;
  const role = props.access.role.id;
  const expected = props.activeVersion;
  confirm({
    cancelText: '取消',
    title: rollback
      ? `按 v${version.version} 的规则生成回滚版本？`
      : `采纳并发布候选 v${version.version}？`,
    content: `将用这 ${version.rules.length} 条规则替换当前 v${expected}。历史版本和已固定版本的项目会保留，请先核对每条规则的来源证据。`,
    okText: rollback ? '确认回滚' : '确认采纳发布',
    async onOk() {
      saving.value = true;
      try {
        await (rollback
          ? WriterApi.rollback(role, version.version, expected)
          : WriterApi.publish(role, version.version, expected));
        message.success('生效规则已更新');
        open.value = false;
        await load();
        emit('changed');
      } catch (error) {
        message.error(
          requestErrorMessage(
            error,
            '规则版本已变化或权限不足，请刷新后重新审核',
          ),
        );
        emit('changed');
        throw error;
      } finally {
        saving.value = false;
      }
    },
  });
}
watch(
  () => [props.access.role.id, props.refreshKey],
  () => {
    generation++;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Alert
    type="info"
    :message="`当前生效版本 v${activeVersion}。候选不会自动生效；发布后会同步为这个角色的过程记忆。`"
    class="mb-3"
  />
  <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
  <Table
    :data-source="rows"
    row-key="version"
    :loading="loading"
    :pagination="false"
    size="small"
    :scroll="{ x: 520 }"
    :columns="[
      { title: '版本', key: 'version' },
      { title: '变更摘要', dataIndex: 'summary' },
      { title: '状态', key: 'state' },
      { title: '操作', key: 'actions' },
    ]"
  >
    <template #bodyCell="{ column, record }">
      <span v-if="column.key === 'version'">v{{ record.version }}</span>
      <template v-else-if="column.key === 'state'">
        <Tag v-if="record.version === activeVersion" color="green">生效中</Tag>
        <Tag v-else-if="record.status === 'draft'" color="orange">待审核</Tag>
        <Tag v-else>历史版本</Tag>
      </template>
      <Button
        v-else-if="column.key === 'actions'"
        type="link"
        @click="
          selected = record;
          open = true;
        "
      >
        查看规则与证据
      </Button>
    </template>
  </Table>
  <div class="my-3 flex justify-between">
    <Button
      :disabled="loading || page === 0"
      @click="
        page--;
        load();
      "
    >
      上一页
    </Button>
    <span>第 {{ page + 1 }} 页</span>
    <Button
      :disabled="loading || !more"
      @click="
        page++;
        load();
      "
    >
      下一页
    </Button>
  </div>
  <Modal
    v-model:open="open"
    :title="`规则版本 v${selected?.version ?? ''}`"
    :footer="null"
    :width="780"
  >
    <template v-if="selected">
      <p class="mb-3">{{ selected.summary }}</p>
      <Alert
        v-if="
          selected.status === 'draft' && selected.base_version !== activeVersion
        "
        type="warning"
        message="候选基于旧版本，不能直接覆盖当前规则。请重新提交提炼或调整任务。"
        class="mb-3"
      />
      <p v-if="!selected.rules.length" class="text-muted-foreground">
        此版本没有已提炼规则。
      </p>
      <section
        v-for="rule in selected.rules"
        :key="rule.id"
        class="mb-4 border-b pb-4"
      >
        <h3 class="mb-2 font-medium">
          {{ rule.title }}
          <Tag>{{ rule.category }}</Tag>
        </h3>
        <p class="whitespace-pre-wrap break-words">{{ rule.instruction }}</p>
        <p v-if="rule.rationale" class="mt-2 text-sm">
          理由：{{ rule.rationale }}
        </p>
        <p v-if="rule.applies_to" class="mt-2 text-sm">
          适用：{{ rule.applies_to }}
        </p>
        <p v-if="rule.exceptions" class="mt-2 text-sm">
          例外：{{ rule.exceptions }}
        </p>
        <div
          v-for="(item, index) in rule.evidence"
          :key="index"
          class="mt-3 border-l-2 pl-3"
        >
          <blockquote class="whitespace-pre-wrap break-words text-sm">
            {{ item.quote }}
          </blockquote>
          <Button
            type="link"
            size="small"
            @click="
              evidence = item;
              evidenceOpen = true;
            "
          >
            {{ item.message_id ? '查看原始反馈' : '查看原文段落' }}
          </Button>
        </div>
      </section>
      <div v-if="canPublish" class="mt-4 flex gap-2">
        <Button
          v-if="selected.status === 'draft'"
          type="primary"
          :disabled="saving || selected.base_version !== activeVersion"
          @click="adopt(selected)"
        >
          采纳此候选
        </Button>
        <Button
          v-else-if="selected.version !== activeVersion"
          :disabled="saving"
          @click="adopt(selected, true)"
        >
          以此历史规则回滚
        </Button>
      </div>
    </template>
  </Modal>
  <EvidenceView
    v-model:open="evidenceOpen"
    :role-id="access.role.id"
    :evidence="evidence"
  />
</template>
