<script setup lang="ts">
import type {
  DownloadUserGroup,
  DownloadUserTreeNode,
} from '#/api/res/downloads';

import { computed, onMounted, ref } from 'vue';

import { Alert, Button, Input, Popconfirm, Select, Space } from 'antdv-next';

import { DownloadUserGroupApi } from '#/api/res/downloads';
import { requestErrorMessage } from '#/request-errors';

import { applyUserGroup } from './user-selection';

const props = defineProps<{
  tree: DownloadUserTreeNode[];
  disabled?: boolean;
  allowDisabled?: boolean;
}>();
const value = defineModel<number[]>('value', { required: true });
const groups = ref<DownloadUserGroup[]>([]);
const selectedId = ref<string>();
const name = ref('');
const busy = ref(false);
const errorText = ref('');
const notice = ref('');
const current = computed(() =>
  groups.value.find((g) => String(g.id) === selectedId.value),
);
const options = computed(() =>
  groups.value.map((g) => ({
    value: String(g.id),
    label: `${g.name}（${g.uids.length}人）`,
  })),
);
async function load() {
  if (busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    groups.value = await DownloadUserGroupApi.list();
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '快速选择组加载失败，请刷新重试',
    );
  } finally {
    busy.value = false;
  }
}
function select(id?: string) {
  selectedId.value = id;
  const group = current.value;
  if (!group) {
    name.value = '';
    notice.value = '';
    return;
  }
  name.value = group.name;
  const result = applyUserGroup(group.uids, props.tree, props.allowDisabled);
  value.value = result.selected;
  notice.value = `已选择 ${result.selected.length} 人${result.skipped ? `，跳过 ${result.skipped} 位已失效、停用或不在当前授权范围的成员` : ''}`;
}
async function save(replace: boolean) {
  if (busy.value || props.disabled) return;
  errorText.value = '';
  if (
    !name.value.trim() ||
    value.value.length === 0 ||
    value.value.length > 100
  ) {
    errorText.value = '请填写组名并选择1至100位用户';
    return;
  }
  if (replace && !current.value) return;
  busy.value = true;
  try {
    const saved =
      replace && current.value
        ? await DownloadUserGroupApi.update(current.value, name.value.trim(), [
            ...value.value,
          ])
        : await DownloadUserGroupApi.create(name.value.trim(), [
            ...value.value,
          ]);
    groups.value = [
      saved,
      ...groups.value.filter((g) => String(g.id) !== String(saved.id)),
    ];
    selectedId.value = String(saved.id);
    name.value = saved.name;
    notice.value = `已保存“${saved.name}”，共 ${saved.uids.length} 人`;
  } catch (error) {
    errorText.value = requestErrorMessage(error, '快速选择组保存失败');
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (busy.value || props.disabled || !current.value) return;
  busy.value = true;
  errorText.value = '';
  const group = current.value;
  try {
    await DownloadUserGroupApi.remove(group);
    groups.value = groups.value.filter(
      (g) => String(g.id) !== String(group.id),
    );
    selectedId.value = undefined;
    name.value = '';
    notice.value = '已删除快速选择组，当前已选用户保留';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '快速选择组删除失败');
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="mt-2 rounded border p-3">
    <div class="mb-2 text-sm">
      <label for="batch-user-group">我的快速选择组</label>
      （仅当前账号可用）
    </div>
    <Space wrap>
      <Select
        id="batch-user-group"
        :value="selectedId"
        :options="options"
        :disabled="disabled || busy"
        allow-clear
        show-search
        option-filter-prop="label"
        class="min-w-60"
        placeholder="选择组，替换当前已选用户"
        @change="select"
      />
      <Button
        :disabled="disabled || busy || !current"
        @click="select(selectedId)"
      >
        重新选择组内成员
      </Button>
      <Button :loading="busy" :disabled="disabled" @click="load">刷新组</Button>
    </Space>
    <Space wrap class="mt-2">
      <Input
        v-model:value="name"
        :maxlength="80"
        :disabled="disabled || busy"
        placeholder="输入组名"
        aria-label="快速选择组名称"
      />
      <Button :disabled="disabled || busy" @click="save(false)">
        将当前选择保存为新组
      </Button>
      <Button :disabled="disabled || busy || !current" @click="save(true)">
        覆盖当前组名称和成员
      </Button>
      <Popconfirm
        title="删除此快速选择组？已授权记录不受影响。"
        :disabled="disabled || busy || !current"
        @confirm="remove"
      >
        <Button danger :disabled="disabled || busy || !current">删除组</Button>
      </Popconfirm>
    </Space>
    <Alert
      v-if="errorText"
      class="mt-2"
      type="error"
      :message="errorText"
      show-icon
    />
    <Alert
      v-else-if="notice"
      class="mt-2"
      type="info"
      :message="notice"
      show-icon
    />
  </div>
</template>
