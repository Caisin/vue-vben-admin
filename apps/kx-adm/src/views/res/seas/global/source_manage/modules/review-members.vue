<script setup lang="ts">
import type { ReviewMembersView } from '#/api/res/review';
import type { Id } from '#/api/res/versions';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Modal, Popconfirm, Select, Table } from 'antdv-next';

import { reviewApi, roleLabels } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';
const props = withDefaults(
  defineProps<{
    res: Id;
    view?: ReviewMembersView;
    name?: string;
    showTrigger?: boolean;
  }>(),
  { showTrigger: true, view: undefined, name: undefined },
);
const emit = defineEmits<{ refresh: [] }>();
const open = defineModel<boolean>('open', { default: false });
const data = ref<ReviewMembersView>();
const view = computed(() => data.value ?? props.view);
const loading = ref(false);
let loadGeneration = 0;
const busy = ref(false);
const errorText = ref('');
const uid = ref<Id>();
const role = ref('editor');
const options = ref<{ value: Id; label: string }[]>([]);
const query = ref('');
const page = ref(0);
const total = ref(0);
const searching = ref(false);
let generation = 0;
async function load() {
  const ticket = ++loadGeneration;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await reviewApi.members(props.res);
    if (ticket === loadGeneration && open.value) data.value = result;
  } catch (error) {
    if (ticket === loadGeneration)
      errorText.value = requestErrorMessage(error, '读取协作者失败，请重试');
  } finally {
    if (ticket === loadGeneration) loading.value = false;
  }
}
watch(
  () => [open.value, props.res],
  async () => {
    loadGeneration++;
    generation++;
    data.value = undefined;
    uid.value = undefined;
    options.value = [];
    page.value = 0;
    total.value = 0;
    if (!open.value) return;
    await load();
    if (open.value && view.value?.can_manage) void search('');
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  loadGeneration++;
  generation++;
});
async function search(value = query.value, more = false) {
  const ticket = ++generation;
  searching.value = true;
  query.value = value;
  const next = more ? page.value + 1 : 1;
  try {
    const result = await reviewApi.users(value, next);
    if (ticket !== generation) return;
    const list = result.items.map((u) => ({
      value: u.id,
      label: u.name || `用户 ${u.id}`,
    }));
    options.value = more ? [...options.value, ...list] : list;
    total.value = result.total;
    page.value = next;
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '加载用户失败');
  } finally {
    if (ticket === generation) searching.value = false;
  }
}
async function save(id = uid.value, selectedRole = role.value) {
  if (!id || busy.value || loading.value || !view.value?.can_manage) return;
  busy.value = true;
  errorText.value = '';
  try {
    await reviewApi.member(props.res, id, selectedRole);
    uid.value = undefined;
    await load();
    emit('refresh');
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存协作者失败');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Button v-if="showTrigger" @click="open = true">
    协作者 · {{ view?.members.length ?? 0 }}
  </Button>
  <Modal
    v-model:open="open"
    :title="name ? `${name} · 作品协作者` : '作品协作者'"
    :width="700"
    :footer="null"
    :z-index="1020"
    :mask-closable="!busy"
    :closable="!busy"
  >
    <p class="mb-4 text-muted-foreground">
      剪辑负责上传、替换分集与处理建议；编剧和导演可预览、评论并提出修改建议。成员可访问本作品的全部版本。
    </p>
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <Button v-if="errorText" class="mb-3" :loading="loading" @click="load">
      重新读取
    </Button>
    <div v-if="view?.can_manage" class="mb-4 flex gap-2">
      <Select
        v-model:value="uid"
        :options="options"
        :loading="searching"
        show-search
        :filter-option="false"
        placeholder="搜索并选择协作者"
        class="min-w-0 flex-1"
        @search="search($event)"
      >
        <template #popupRender="menu">
          <component :is="menu" /><Button
            v-if="options.length < total"
            block
            :loading="searching"
            @click="search(query, true)"
          >
            加载更多用户
          </Button>
        </template>
      </Select>
      <Select
        v-model:value="role"
        :options="
          Object.entries(roleLabels).map(([value, label]) => ({ value, label }))
        "
        class="w-28"
      />
      <Button type="primary" :disabled="!uid" :loading="busy" @click="save()">
        添加 / 更新
      </Button>
    </div>
    <Table
      :data-source="view?.members ?? []"
      :loading="loading"
      row-key="uid"
      :pagination="{ pageSize: 10 }"
      :columns="[
        { title: '姓名', key: 'name' },
        { title: '角色', key: 'role' },
        { title: '操作', key: 'action' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'name'">{{
          view?.users[String(record.uid)] || `用户 ${record.uid}`
        }}</span>
        <span v-if="column.key === 'role'">{{ roleLabels[record.role] }}</span>
        <Popconfirm
          v-if="column.key === 'action' && view?.can_manage"
          title="移除后将立即失去此作品的协作权限，历史意见仍保留。"
          @confirm="save(record.uid, 'remove')"
        >
          <Button type="link" danger :disabled="busy">移除</Button>
        </Popconfirm>
      </template>
    </Table>
  </Modal>
</template>
