<script setup lang="ts">
import type { UserCandidate } from '#/api/vestige';

import { onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Input, Modal, Table } from 'antdv-next';

import { VestigeApi } from '#/api/vestige';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{
  open: boolean;
  roleId: string;
  privateRole?: boolean;
  exclude?: string;
}>();
const emit = defineEmits<{
  'update:open': [boolean];
  select: [UserCandidate];
}>();
const rows = ref<UserCandidate[]>([]);
const keyword = ref('');
const busy = ref(false);
const errorText = ref('');
const after = ref<string>();
const history = ref<(string | undefined)[]>([]);
const more = ref(false);
let generation = 0;
async function load(reset = false) {
  if (reset) {
    after.value = undefined;
    history.value = [];
  }
  const current = ++generation;
  rows.value = [];
  more.value = false;
  if (!props.open || !props.roleId) return;
  busy.value = true;
  errorText.value = '';
  try {
    const data = await VestigeApi.candidates(
      props.roleId,
      keyword.value.trim(),
      after.value,
    );
    if (current !== generation) return;
    more.value = data.length > 25;
    rows.value = data.slice(0, 25);
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '成员候选加载失败');
  } finally {
    if (current === generation) busy.value = false;
  }
}
function next() {
  history.value.push(after.value);
  after.value = rows.value.at(-1)?.user_id;
  void load();
}
function previous() {
  after.value = history.value.pop();
  void load();
}
watch(
  () => [props.open, props.roleId],
  () => {
    generation++;
    rows.value = [];
    if (props.open) {
      keyword.value = '';
      void load(true);
    }
  },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Modal
    :open="open"
    title="选择协作成员"
    :footer="null"
    :width="620"
    @cancel="emit('update:open', false)"
  >
    <p class="mb-3 text-sm text-muted-foreground">
      {{
        privateRole
          ? '可按共同公司成员姓名搜索；其他协作者请输入完整后台登录账号。'
          : '仅展示当前公司可用成员；同名成员请核对账号标识。'
      }}
    </p>
    <Input.Search
      v-model:value="keyword"
      :placeholder="
        privateRole ? '成员姓名或完整后台登录账号' : '按成员名称搜索'
      "
      aria-label="搜索协作成员"
      class="mb-3"
      :loading="busy"
      @search="load(true)"
    />
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <Table
      :data-source="rows"
      row-key="user_id"
      :loading="busy"
      :pagination="false"
      size="small"
      :columns="[
        { title: '成员', key: 'name', dataIndex: 'name' },
        { title: '账号标识', dataIndex: 'user_id' },
        { title: '', key: 'action', width: 90 },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'action'"
          type="link"
          :disabled="record.user_id === exclude"
          @click="
            emit('select', record);
            emit('update:open', false);
          "
        >
          选择
        </Button>
      </template>
    </Table>
    <div class="mt-3 flex items-center justify-between">
      <Button :disabled="busy || history.length === 0" @click="previous">
        上一页
      </Button>
      <span class="text-sm text-muted-foreground">
        第 {{ history.length + 1 }} 页
      </span>
      <Button :disabled="busy || !more" @click="next">下一页</Button>
    </div>
  </Modal>
</template>
