<script setup lang="ts">
import type { DeliveryDownloadGrant } from '#/api/res/delivery';
import type { Id } from '#/api/res/versions';

import { ref, watch } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import { deliveryApi } from '#/api/res/delivery';
import { reviewApi } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{ scope: Id; version: Id }>();
const open = ref(false);
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const users = ref<{ id: number; name: string }[]>([]);
const rows = ref<DeliveryDownloadGrant[]>([]);
const selected = ref<DeliveryDownloadGrant>();
const modules: [string, string][] = [
  ['film', '成片'],
  ['clean', '无字幕版'],
  ['silent', '无音乐版'],
  ['prompt', '提示词'],
  ['project_image', '工程截图'],
  ['poster', '海报'],
  ['synopsis', '剧本简介'],
  ['srt', 'SRT'],
  ['demo', 'DEMO'],
  ['youtube', 'YouTube'],
];
async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const [grants, options] = await Promise.all([
      deliveryApi.grants(props.scope, props.version),
      reviewApi.users('', 1),
    ]);
    rows.value = grants;
    users.value = options.items.map((u: any) => ({
      id: Number(u.id),
      name: u.name,
    }));
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取下载权限失败');
  } finally {
    loading.value = false;
  }
}
function edit(row?: DeliveryDownloadGrant) {
  selected.value = row
    ? {
        uid: row.uid,
        can_download: row.can_download,
        modules: [...row.modules],
        seq_from: row.seq_from,
        seq_until: row.seq_until,
        valid_from: row.valid_from,
        valid_until: row.valid_until,
      }
    : {
        uid: 0,
        can_download: true,
        modules: ['film'],
        seq_from: 0,
        seq_until: 0,
        valid_from: 0,
        valid_until: 0,
      };
}
async function searchUsers(keyword: string) {
  try {
    const result = await reviewApi.users(keyword, 1);
    users.value = result.items.map((u) => ({ id: Number(u.id), name: u.name }));
  } catch (error) {
    errorText.value = requestErrorMessage(error, '搜索用户失败');
  }
}
async function save() {
  if (!selected.value?.uid) return;
  saving.value = true;
  try {
    await deliveryApi.saveGrants(props.scope, props.version, [selected.value]);
    selected.value = undefined;
    await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存下载权限失败');
  } finally {
    saving.value = false;
  }
}
watch(
  () => [props.scope, props.version],
  () => {
    selected.value = undefined;
    rows.value = [];
    if (open.value) void load();
  },
);
</script>
<template>
  <Button
    @click="
      open = true;
      load();
    "
  >
    下载权限
  </Button>
  <Modal
    v-model:open="open"
    title="交付材料下载权限"
    width="min(1100px,96vw)"
    :footer="null"
  >
    <Alert
      type="info"
      message="授权仅针对当前选中的交付版本。为同一用户保存会替换该作品此前的版本授权。下载通过 Tauri 客户端，未勾选模块不可下载。"
      class="mb-4"
    />
    <Alert
      v-if="errorText && !selected"
      type="error"
      :message="errorText"
      class="mb-3"
    />
    <Button
      type="primary"
      :disabled="loading || saving"
      @click="edit()"
      v-access:code="'api:res.delivery.grants.save'"
    >
      新增授权
    </Button>
    <Spin :spinning="loading">
      <Table
        class="mt-3"
        :data-source="rows"
        row-key="uid"
        :pagination="false"
        :columns="[
          { title: '用户', dataIndex: 'uid' },
          { title: '模块', key: 'modules' },
          { title: '集数', key: 'seq' },
          { title: '状态', key: 'state' },
          { title: '操作', key: 'action' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'modules'">
            {{
              record.modules
                .map((m) => modules.find((x) => x[0] === m)?.[1] || m)
                .join('、') || '无模块授权'
            }}
          </span>
          <span v-else-if="column.key === 'seq'">
            {{ record.seq_from || 1 }} - {{ record.seq_until || '全部' }}
          </span>
          <Tag
            v-else-if="column.key === 'state'"
            :color="record.can_download ? 'green' : 'default'"
          >
            {{
              !record.can_download
                ? '已停用'
                : Number(record.delivery_version_id) === Number(version)
                  ? '当前版本允许'
                  : '其它版本授权'
            }}
          </Tag>
          <Button
            v-else-if="column.key === 'action'"
            type="link"
            @click="edit(record)"
            v-access:code="'api:res.delivery.grants.save'"
          >
            编辑
          </Button>
          <span v-else>
            {{
              record.user_name ||
              users.find((u) => u.id === Number(record.uid))?.name ||
              `用户 ${record.uid}`
            }}
          </span>
        </template>
      </Table>
    </Spin>
    <Modal
      v-if="selected"
      :open="true"
      :closable="!saving"
      :mask-closable="!saving"
      :cancel-button-props="{ disabled: saving }"
      title="配置下载范围"
      :confirm-loading="saving"
      :ok-button-props="{
        disabled:
          !selected.uid || (selected.can_download && !selected.modules.length),
      }"
      @ok="save"
      @cancel="selected = undefined"
    >
      <Select
        v-model:value="selected.uid"
        show-search
        :filter-option="false"
        @search="searchUsers"
        class="w-full"
        :options="users.map((u) => ({ value: u.id, label: u.name }))"
        placeholder="选择用户"
      />
      <Checkbox v-model:checked="selected.can_download" class="mt-3">
        允许下载（取消后停止后续下载）
      </Checkbox>
      <p class="mt-4 mb-2">允许下载的材料模块</p>
      <Checkbox
        v-for="item in modules"
        :key="item[0]"
        :checked="selected.modules.includes(item[0])"
        @change="
          (e: any) =>
            e.target.checked
              ? selected!.modules.push(item[0])
              : (selected!.modules = selected!.modules.filter(
                  (m) => m !== item[0],
                ))
        "
      >
        {{ item[1] }}
      </Checkbox>
      <p class="mt-4 mb-2">集数范围（0 表示不限）</p>
      <div class="flex gap-2">
        <input
          v-model.number="selected.seq_from"
          type="number"
          min="0"
          placeholder="起始集"
        />
        <input
          v-model.number="selected.seq_until"
          type="number"
          min="0"
          placeholder="结束集"
        />
      </div>
      <Alert v-if="errorText" type="error" :message="errorText" class="mt-3" />
    </Modal>
  </Modal>
</template>
