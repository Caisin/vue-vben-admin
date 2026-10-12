<script setup lang="ts">
import type { DownloadUserTreeNode } from '#/api/res/downloads';
import type {
  GrantResource,
  GrantRow,
  GrantValues,
} from '#/api/res/grant-maintenance';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  CheckboxGroup,
  Form,
  FormItem,
  Modal,
  Select,
  Table,
} from 'antdv-next';

import { defaultGrantValues, grantApi } from '#/api/res/grant-maintenance';
import UserTreeSelect from '#/components/user-tree-select';
import { requestErrorMessage } from '#/request-errors';

import GrantFields from './grant-fields.vue';
import GrantResourcePicker from './grant-resource-picker.vue';
const props = defineProps<{
  delivery: boolean;
  targets: GrantRow[];
  tree: DownloadUserTreeNode[];
  treeLoading: boolean;
  treeError: string;
  fixedResource?: GrantResource;
  fixedVersion?: number;
}>();
const emit = defineEmits<{ saved: []; retry: [] }>();
const open = defineModel<boolean>('open', { required: true });
const values = ref<GrantValues>(defaultGrantValues());
const users = ref<number[]>([]);
const resources = ref<GrantResource[]>([]);
const versions = ref<Record<string, number[]>>({});
const fields = ref<(keyof GrantValues)[]>([]);
const saving = ref(false);
const versionOptions = ref<{ id: number; name: string }[]>([]);
const errorText = ref('');
const editing = computed(() => props.targets.length > 0);
const bulk = computed(() => props.targets.length > 1);
const materialOnly = computed(
  () =>
    !editing.value &&
    resources.value.length > 0 &&
    resources.value.every(
      (r) =>
        (versions.value[r.res_id] || []).length > 0 &&
        (versions.value[r.res_id] || []).every(
          (id) =>
            r.versions.find((v) => Number(v.id) === Number(id))?.kind ===
            'materials',
        ),
    ),
);
watch(materialOnly, (value) => {
  if (!editing.value) values.value.modules = value ? ['prompt'] : ['film'];
});
const fieldOptions = computed(() => [
  ...(props.delivery && props.targets.length === 1
    ? [{ label: '交付版本', value: 'delivery_version_id' }]
    : []),
  { label: '授权状态', value: 'can_download' },
  { label: '生效时间', value: 'valid_from' },
  { label: '失效时间', value: 'valid_until' },
  { label: '起始集数', value: 'seq_from' },
  { label: '结束集数', value: 'seq_until' },
  ...(props.delivery ? [{ label: '材料模块', value: 'modules' }] : []),
]);
watch(open, (visible) => {
  if (!visible) return;
  errorText.value = '';
  users.value = [];
  resources.value = props.fixedResource ? [props.fixedResource] : [];
  versions.value =
    props.fixedResource && props.fixedVersion
      ? { [props.fixedResource.res_id]: [props.fixedVersion] }
      : {};
  const row = props.targets[0];
  values.value = row
    ? {
        delivery_version_id: Number(row.delivery_version_id),
        can_download: row.can_download,
        valid_from: Number(row.valid_from),
        valid_until: Number(row.valid_until),
        seq_from: Number(row.seq_from),
        seq_until: Number(row.seq_until),
        modules: [...row.modules],
      }
    : defaultGrantValues();
  versionOptions.value = props.fixedResource?.versions || [];
  if (row && props.delivery && !props.fixedResource) {
    const rowId = row.id;
    void grantApi(true)
      .options(row.resource_code)
      .then((result) => {
        if (open.value && props.targets[0]?.id === rowId)
          versionOptions.value =
            result.items.find((r) => Number(r.res_id) === Number(row.res_id))
              ?.versions || [];
      })
      .catch((error) => {
        errorText.value = requestErrorMessage(error, '加载可授权版本失败');
      });
  }
  fields.value = bulk.value
    ? []
    : fieldOptions.value.map((f) => f.value as keyof GrantValues);
});
async function save() {
  if (saving.value) return;
  errorText.value = '';
  if (editing.value && fields.value.length === 0) {
    errorText.value = '请勾选要统一修改的字段';
    return;
  }
  if (
    !editing.value &&
    (resources.value.length === 0 || users.value.length === 0)
  ) {
    errorText.value = '请选择作品和授权用户';
    return;
  }
  const api = grantApi(props.delivery);
  const patch = Object.fromEntries(
    fields.value.map((key) => [key, values.value[key]]),
  ) as Partial<GrantValues>;
  if (
    props.delivery &&
    !editing.value &&
    resources.value.some((r) => !versions.value[r.res_id]?.length)
  ) {
    errorText.value = '请为每部作品选择明确的交付版本';
    return;
  }
  saving.value = true;
  try {
    await (editing.value
      ? api.change(props.targets, patch)
      : api.create(
          resources.value.flatMap((r) =>
            (props.delivery ? versions.value[r.res_id] || [] : [0]).map(
              (version_id) => ({ res_id: Number(r.res_id), version_id }),
            ),
          ),
          users.value,
          patch,
        ));
    open.value = false;
    emit('saved');
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存授权失败，请核对后重试');
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="editing ? `编辑 ${targets.length} 条授权` : '新增授权'"
    get-container="body"
    :z-index="1200"
    :width="800"
    :confirm-loading="saving"
    :closable="!saving"
    :mask-closable="false"
    :keyboard="!saving"
    :cancel-button-props="{ disabled: saving }"
    @cancel="open = false"
    @ok="save"
    ok-text="保存授权"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-4" />
    <Form layout="vertical" :disabled="saving">
      <template v-if="!editing">
        <FormItem label="授权作品" required>
          <GrantResourcePicker
            v-if="!fixedResource"
            v-model:value="resources"
            :delivery="delivery"
            :disabled="saving"
          />
          <div v-else>{{ fixedResource.name }} · {{ fixedResource.code }}</div>
        </FormItem>
        <Table
          v-if="delivery && resources.length"
          :pagination="false"
          :data-source="resources"
          row-key="res_id"
          :columns="[
            { title: '作品', dataIndex: 'name' },
            { title: '交付版本', key: 'version' },
          ]"
          class="mb-4"
        >
          <template #bodyCell="{ column, record }">
            <Select
              v-if="column.key === 'version'"
              v-model:value="versions[record.res_id]"
              mode="multiple"
              :options="
                record.versions.map((v: { id: number; name: string }) => ({
                  value: Number(v.id),
                  label: v.name,
                }))
              "
              placeholder="请选择授权版本"
              class="w-full"
              :disabled="saving"
            />
          </template>
        </Table>
        <FormItem label="授权用户" required>
          <UserTreeSelect
            v-model:value="users"
            :tree-data="tree"
            :loading="treeLoading"
            :error="treeError"
            :disabled="saving"
            @retry="emit('retry')"
          />
        </FormItem>
        <Alert
          type="info"
          :message="`将新增 ${resources.reduce((sum, r) => sum + (delivery ? versions[r.res_id]?.length || 0 : 1), 0) * users.length} 条授权（最多200条）。已有授权请查询后编辑，新增不会覆盖原授权。同批请选择视频版本或项目资料，跨类型请分批。`"
          class="mb-4"
        />
      </template>
      <template v-else>
        <Alert
          type="info"
          message="只修改勾选字段，保留未勾选字段。单条编辑可更换交付版本，批量编辑保留各作品原版本。留空时间表示立即生效或永久有效。"
          class="mb-4"
        />
        <Table
          :data-source="targets"
          row-key="id"
          size="small"
          :pagination="targets.length > 5 ? { pageSize: 5 } : false"
          :columns="[
            { title: '作品', dataIndex: 'res_name' },
            { title: '被授权人', dataIndex: 'user_name' },
            ...(delivery ? [{ title: '版本', dataIndex: 'version_name' }] : []),
          ]"
          class="mb-4"
        />
        <CheckboxGroup
          v-model:value="fields"
          :options="fieldOptions"
          :disabled="saving"
          class="mb-4"
        />
      </template>
      <FormItem
        v-if="delivery && editing && fields.includes('delivery_version_id')"
        label="授权交付版本"
      >
        <Select
          v-model:value="values.delivery_version_id"
          :options="
            versionOptions.map((v) => ({ value: Number(v.id), label: v.name }))
          "
          :disabled="saving"
          placeholder="选择此作品的交付版本"
        />
      </FormItem>
      <GrantFields
        v-model:value="values"
        :delivery="delivery"
        :fields="fields"
        :material-only="!editing ? materialOnly : undefined"
        :disabled="saving"
      />
    </Form>
  </Modal>
</template>
