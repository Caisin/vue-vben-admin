<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type {
  DownloadBatchView,
  DownloadBatchWrite,
  DownloadUserTreeNode,
} from '#/api/res/downloads';

import { computed, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  CheckboxGroup,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';
import dayjs from 'dayjs';

import {
  distributionRegionLabel,
  distributionRegionOptions,
} from '#/api/res/code-region';
import { DeliveryBatchApi, ResDownloadApi } from '#/api/res/downloads';
import { grantModules } from '#/api/res/grant-maintenance';
import UserTreeSelect from '#/components/user-tree-select';
import { requestErrorMessage } from '#/request-errors';

import UserGroups from './user-groups.vue';
import { availableUsers } from './user-selection';

const props = defineProps<{
  delivery?: boolean;
  fixedResource?: {
    res_id: number;
    code: string;
    name: string;
    versions: { id: number; name: string; kind?: string }[];
  };
  fixedVersion?: number;
  initialUids: number[];
  revoke?: boolean;
  userTree: DownloadUserTreeNode[];
  userTreeLoading: boolean;
  userTreeError: string;
}>();
const emit = defineEmits<{ saved: []; retry: [] }>();
const open = defineModel<boolean>('open', { default: false });
const form = reactive<DownloadBatchWrite>({
  mode: 'code',
  text: '',
  uids: [],
  grant: {
    uid: 0,
    can_download: true,
    seq_from: 0,
    seq_until: 0,
    valid_from: 0,
    valid_until: 0,
  },
});
const codeRange = reactive({
  start: '',
  end: '',
  modulus: 2,
  remainder: 0,
  distribution_region: 'all',
});
const versionKind = ref('film');
const modules = ref(['film']);
const unit = computed(() => (props.delivery ? '个交付版本' : '部剧'));
const versionKinds = [
  { label: '成片版本', value: 'film' },
  { label: '无字幕版本', value: 'clean' },
  { label: '无音乐版本', value: 'silent' },
  { label: '全部视频版本（含自定义）', value: 'video' },
  { label: '项目资料', value: 'materials' },
];
function matchId(item: DownloadBatchView['lines'][number]['matches'][number]) {
  return props.delivery ? (item.version_id ?? '') : item.res_id;
}
watch(versionKind, (kind) => {
  modules.value = kind === 'materials' ? ['prompt'] : ['film'];
});
const uids = ref<number[]>([]);
const preview = ref<DownloadBatchView>();
const applied = ref(false);
const busy = ref(false);
const submitError = ref('');

const selectedIds = ref<Array<number | string>>([]);
const validRange = computed<[Dayjs, Dayjs] | undefined>({
  get: (): [Dayjs, Dayjs] | undefined =>
    form.grant.valid_from && form.grant.valid_until
      ? [dayjs.unix(form.grant.valid_from), dayjs.unix(form.grant.valid_until)]
      : undefined,
  set: (value: [Dayjs, Dayjs] | undefined) => {
    form.grant.valid_from = value?.[0]?.unix() ?? 0;
    form.grant.valid_until = value?.[1]?.unix() ?? 0;
  },
});
const presets = [1, 3, 7, 15, 30, 90].map((days) => ({
  label: `未来 ${days} 天`,
  value: (): [Dayjs, Dayjs] => {
    const now = dayjs();
    return [now, now.add(days, 'day')];
  },
}));
const count = computed(() => selectedIds.value.length);
const selectedSet = computed(() => new Set(selectedIds.value.map(String)));
const resultMessage = computed(() => {
  if (applied.value && preview.value) {
    return props.revoke
      ? `已取消 ${preview.value.revoked_count} 条授权`
      : `已向 ${preview.value.granted_user_count} 位用户授权 ${preview.value.granted_count} ${unit.value}`;
  }
  return props.revoke
    ? `将取消 ${uids.value.length} 位用户对 ${count.value} ${unit.value}的授权，请检查下方匹配结果`
    : `将向 ${uids.value.length} 位用户授权 ${count.value} ${unit.value}，请检查下方匹配结果`;
});
function removeMatches(ids: Array<number | string>) {
  const removed = new Set(ids.map(String));
  selectedIds.value = selectedIds.value.filter(
    (id) => !removed.has(String(id)),
  );
}
function removeLine(line: DownloadBatchView['lines'][number]) {
  removeMatches(line.matches.map((item) => matchId(item)));
}
function remaining(line: DownloadBatchView['lines'][number]) {
  return line.matches.filter((item) =>
    selectedSet.value.has(String(matchId(item))),
  ).length;
}
const modes = [
  { label: '每行一个剧名关键字', value: 'name' },
  { label: '每行一个作品编码关键字', value: 'code' },
  { label: '作品编码范围取模（尾部数字）', value: 'code_range' },
];
const columns = [
  { title: '行号', dataIndex: 'line', width: 65 },
  { title: '输入', dataIndex: 'input', width: 180 },
  { title: '匹配结果', key: 'result', width: 200 },
  {
    title: props.delivery
      ? '匹配作品 / 编码 / 版本 / 集数'
      : '匹配剧目 / 作品编码 / 集数',
    key: 'matches',
  },
];

watch(open, (value) => {
  if (!value) {
    return;
  }
  uids.value = [];
  // 取消授权允许清理停用用户；新增授权只继承仍启用的用户。
  const enabled = availableUsers(props.userTree, props.revoke);
  uids.value = props.initialUids.filter((id) => enabled.has(id));
  Object.assign(codeRange, {
    start: '',
    end: '',
    modulus: 2,
    remainder: 0,
    distribution_region: 'all',
  });
  form.text =
    props.delivery && props.fixedResource ? props.fixedResource.code : '';
  const fixedKind = props.fixedResource?.versions.find(
    (v) => Number(v.id) === Number(props.fixedVersion),
  )?.kind;
  versionKind.value =
    fixedKind && ['clean', 'film', 'materials', 'silent'].includes(fixedKind)
      ? fixedKind
      : 'film';
  if (
    fixedKind &&
    !['clean', 'film', 'materials', 'silent'].includes(fixedKind)
  )
    versionKind.value = 'video';
  modules.value = versionKind.value === 'materials' ? ['prompt'] : ['film'];
  form.mode = 'code';
  const now = dayjs();
  form.grant = {
    uid: 0,
    can_download: true,
    seq_from: 0,
    seq_until: 0,
    valid_from: now.unix(),
    valid_until: now.add(7, 'day').unix(),
  };
  preview.value = undefined;
  selectedIds.value = [];
  applied.value = false;
  submitError.value = '';
});
watch(
  () => [
    versionKind.value,
    modules.value.join(','),
    props.fixedResource?.res_id,
    props.fixedVersion,
    form.mode,
    form.text,
    codeRange.distribution_region,
    codeRange.start,
    codeRange.end,
    codeRange.modulus,
    codeRange.remainder,
    uids.value.join(','),
    form.grant.valid_from,
    form.grant.valid_until,
    form.grant.seq_from,
    form.grant.seq_until,
  ],
  () => {
    preview.value = undefined;
    selectedIds.value = [];
    applied.value = false;
    submitError.value = '';
  },
);
async function submit(apply: boolean) {
  if (busy.value) return;
  submitError.value = '';
  if (
    uids.value.length === 0 ||
    (form.mode !== 'code_range' && !form.text.trim())
  ) {
    submitError.value = '请选择用户并输入剧名或作品编码';
    return;
  }
  if (
    form.mode === 'code_range' &&
    (!codeRange.start.trim() ||
      !codeRange.end.trim() ||
      !Number.isSafeInteger(codeRange.modulus) ||
      codeRange.modulus <= 0 ||
      !Number.isSafeInteger(codeRange.remainder) ||
      codeRange.remainder < 0 ||
      codeRange.remainder >= codeRange.modulus)
  ) {
    submitError.value =
      '请填写起止编码，模数须为正整数，余数须大于等于0且小于模数';
    return;
  }
  if (
    !props.revoke &&
    (!validRange.value || form.grant.valid_until <= form.grant.valid_from)
  ) {
    submitError.value = '请选择有效时间范围，失效时间必须晚于生效时间';
    return;
  }
  if (
    !props.revoke &&
    (form.grant.seq_from < 0 ||
      form.grant.seq_until < 0 ||
      (form.grant.seq_from > 0 &&
        form.grant.seq_until > 0 &&
        form.grant.seq_until < form.grant.seq_from))
  ) {
    submitError.value = '集数范围无效';
    return;
  }
  if (props.delivery && !props.revoke && modules.value.length === 0) {
    submitError.value = '请选择允许下载的材料模块';
    return;
  }
  if (apply && (!preview.value || applied.value || !count.value)) return;
  busy.value = true;
  try {
    const data: DownloadBatchWrite = {
      mode: form.mode,
      text: form.text,
      ...(form.mode === 'code_range' ? { code_range: { ...codeRange } } : {}),
      grant: {
        ...form.grant,
        uid: uids.value[0] ?? 0,
        can_download: !props.revoke,
      },
      uids: [...uids.value],
      ...(apply && !props.delivery
        ? {
            expected_res_ids: preview.value?.matched_res_ids,
            selected_res_ids: [...selectedIds.value],
          }
        : {}),
    };
    const deliveryData = {
      matching: data,
      version_kind: versionKind.value,
      modules: [...modules.value],
      scope: props.fixedResource?.res_id,
      version_id: props.fixedVersion,
      ...(apply
        ? {
            expected_version_ids: preview.value?.matched_version_ids,
            selected_version_ids: [...selectedIds.value],
          }
        : {}),
    };
    let result: DownloadBatchView;
    if (props.delivery) {
      if (!apply) result = await DeliveryBatchApi.preview(deliveryData);
      else if (props.revoke)
        result = await DeliveryBatchApi.revoke(deliveryData);
      else result = await DeliveryBatchApi.authorize(deliveryData);
    } else {
      result = await (apply
        ? ResDownloadApi.saveBatch(data)
        : ResDownloadApi.previewBatch(data));
    }
    preview.value = result;
    if (!apply)
      selectedIds.value = [
        ...(props.delivery
          ? (result.matched_version_ids ?? [])
          : result.matched_res_ids),
      ];
    if (apply) {
      applied.value = true;
      message.success(resultMessage.value);
      emit('saved');
    }
  } catch (error) {
    submitError.value = requestErrorMessage(
      error,
      apply ? '批量操作失败，请重新预览后重试' : '匹配失败',
    );
    if (apply) {
      preview.value = undefined;
      selectedIds.value = [];
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    get-container="body"
    :z-index="1200"
    :title="
      delivery
        ? revoke
          ? '批量取消交付授权'
          : '批量交付授权'
        : revoke
          ? '批量取消授权'
          : '批量剧授权'
    "
    :width="1000"
    :closable="!busy"
    :mask-closable="!busy"
    :keyboard="!busy"
    :footer="null"
  >
    <Alert
      class="mb-4"
      type="info"
      show-icon
      :message="
        form.mode === 'code_range'
          ? '范围取模按作品编码尾部数字计算，并以完整编码精确匹配；前缀、前导零保留。先预览结果，确认后才操作。'
          : '完整AIGC编码按所属序列精确匹配；其它作品编码关键字和剧名按包含匹配。同编码同地区优先保留无数字尾缀剧名，确认后才授权；英文字母不区分大小写，空行忽略，重复剧目去重。'
      "
      :description="
        delivery
          ? revoke
            ? '每次最多100位用户、200行、500个版本、5000个组合。只取消所选交付版本的授权，不影响同作品其它版本。'
            : '每次最多100位用户、200行、500个版本、5000个组合。只授权预览保留的版本，已有授权按本次有效期、集数和材料范围更新。'
          : revoke
            ? '每次最多 100 位用户、200 行、500 部剧，最多 5000 个组合。仅取消保留剧目的授权，无授权的组合自动跳过；移除仅排除本次操作。'
            : '每次最多 100 位用户、200 行、500 部剧，最多 5000 个组合。仅授权保留剧目，已有授权按本次有效期更新；移除仅排除本次操作。'
      "
    />
    <Alert
      v-if="submitError"
      :message="submitError"
      type="error"
      class="mb-4"
      show-icon
    />
    <Form layout="vertical" :disabled="busy">
      <FormItem label="授权用户" html-for="batch-grant-user" required>
        <UserTreeSelect
          id="batch-grant-user"
          v-model:value="uids"
          :tree-data="userTree"
          :loading="userTreeLoading"
          :error="userTreeError"
          :disabled="busy"
          :allow-disabled="revoke"
          @retry="emit('retry')"
        />
      </FormItem>
      <UserGroups
        class="mb-4"
        v-if="open"
        v-model:value="uids"
        :tree="userTree"
        :allow-disabled="revoke"
        :disabled="busy || userTreeLoading || !!userTreeError"
      />
      <Alert
        v-if="delivery && fixedResource"
        class="mb-3"
        type="info"
        :message="`仅匹配当前作品：${fixedResource.name} · ${fixedResource.code}${fixedVersion ? '（仅当前版本）' : ''}`"
      />
      <FormItem
        v-if="delivery"
        label="交付版本范围"
        html-for="batch-delivery-kind"
        required
      >
        <Select
          id="batch-delivery-kind"
          v-model:value="versionKind"
          :options="versionKinds"
          :disabled="busy || !!fixedVersion"
        />
        <div class="mt-1 text-xs text-muted-foreground">
          所选类别的版本全部列入预览，可逐个移除；只操作确认保留的版本。
        </div>
      </FormItem>
      <FormItem
        v-if="delivery && !revoke && versionKind === 'materials'"
        label="允许下载的材料"
        required
      >
        <CheckboxGroup
          v-model:value="modules"
          :options="grantModules.filter((m) => m.value !== 'film')"
        />
      </FormItem>
      <FormItem label="匹配方式" html-for="batch-grant-mode">
        <Select
          id="batch-grant-mode"
          v-model:value="form.mode"
          :options="modes"
        />
      </FormItem>
      <FormItem
        v-if="form.mode !== 'code_range'"
        :label="form.mode === 'name' ? '剧名列表' : '作品编码列表'"
        html-for="batch-grant-text"
        required
      >
        <Input.TextArea
          id="batch-grant-text"
          v-model:value="form.text"
          :rows="7"
          :maxlength="81920"
          :placeholder="
            form.mode === 'name'
              ? '每行输入一个剧名关键字'
              : '每行输入一个作品编码关键字'
          "
        />
      </FormItem>
      <div v-else class="mb-4">
        <Space wrap>
          <FormItem
            label="起始作品编码（含）"
            html-for="batch-code-start"
            required
          >
            <Input
              id="batch-code-start"
              v-model:value="codeRange.start"
              placeholder="例如 AIGC1000 或 解说漫AIGC1000"
              :maxlength="255"
            />
          </FormItem>
          <FormItem
            label="结束作品编码（含）"
            html-for="batch-code-end"
            required
          >
            <Input
              id="batch-code-end"
              v-model:value="codeRange.end"
              placeholder="例如 AIGC2000 或 解说漫AIGC2000"
              :maxlength="255"
            />
          </FormItem>
          <FormItem label="地区标签" html-for="batch-code-region">
            <Select
              id="batch-code-region"
              v-model:value="codeRange.distribution_region"
              :options="[
                { label: '全部地区', value: 'all' },
                ...distributionRegionOptions,
              ]"
              class="min-w-32"
            />
          </FormItem>
          <FormItem label="模数" html-for="batch-code-modulus" required>
            <InputNumber
              id="batch-code-modulus"
              v-model:value="codeRange.modulus"
              :min="1"
              :max="1000000000"
              :precision="0"
            />
          </FormItem>
          <FormItem label="余数" html-for="batch-code-remainder" required>
            <InputNumber
              id="batch-code-remainder"
              v-model:value="codeRange.remainder"
              :min="0"
              :max="Math.max(0, codeRange.modulus - 1)"
              :precision="0"
            />
          </FormItem>
        </Space>
        <div class="text-muted-foreground text-sm">
          AIGC与解说漫AIGC是两套独立编号，国内／海外通过地区标签筛选。AIGC编码中的空格会自动忽略。结果按尾部数字升序排列；带前导零时数字位数需相同，取模后最多5000个候选编码。
        </div>
      </div>
      <Space v-if="!revoke" wrap>
        <FormItem label="授权有效期" required>
          <DatePicker.RangePicker
            v-model:value="validRange"
            show-time
            :allow-clear="false"
            :presets="presets"
            :placeholder="['生效时间', '失效时间']"
            format="YYYY-MM-DD HH:mm:ss"
          />
        </FormItem>
        <FormItem label="起始集数">
          <InputNumber
            v-model:value="form.grant.seq_from"
            :min="0"
            :precision="0"
            placeholder="0=不限"
          />
        </FormItem>
        <FormItem label="结束集数">
          <InputNumber
            v-model:value="form.grant.seq_until"
            :min="0"
            :precision="0"
            placeholder="0=不限"
          />
        </FormItem>
      </Space>
    </Form>
    <Alert
      v-if="preview"
      class="mb-3"
      :type="applied ? 'success' : 'info'"
      show-icon
      :message="resultMessage"
    />
    <Table
      v-if="preview"
      :data-source="preview.lines"
      :columns="columns"
      row-key="line"
      size="small"
      :pagination="{ pageSize: 10 }"
      :scroll="{ x: 650 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'result'">
          <Tag :color="record.status === 'matched' ? 'success' : 'warning'">
            {{ record.message }}
          </Tag>
        </template>
        <template v-if="column.key === 'matches'">
          <div
            v-for="item in record.matches"
            :key="matchId(item)"
            class="mb-2 flex items-center justify-between gap-2"
          >
            <span
              class="text-xs leading-5"
              :class="{
                'text-muted-foreground line-through':
                  record.status === 'matched' &&
                  !selectedSet.has(String(matchId(item))),
              }"
            >
              {{ item.res_name }} · {{ item.resource_code || '无作品编码' }} ·
              <template v-if="delivery">{{ item.version_name }} ·</template>
              {{ item.seq_num }} 集
              <Tag
                v-if="
                  item.distribution_region &&
                  item.distribution_region !== 'unspecified'
                "
                class="ml-2"
                :color="
                  item.distribution_region === 'domestic' ? 'green' : 'blue'
                "
              >
                {{ distributionRegionLabel(item.distribution_region) }}
              </Tag>
            </span>
            <Button
              v-if="
                record.status === 'matched' &&
                selectedSet.has(String(matchId(item)))
              "
              type="link"
              danger
              size="small"
              :disabled="busy || applied"
              :aria-label="
                delivery
                  ? `移除交付版本 ${item.res_name} ${item.version_name}`
                  : `移除剧目 ${item.res_name} #${item.res_id}`
              "
              @click="removeMatches([matchId(item)])"
            >
              移除
            </Button>
            <span
              v-else-if="record.status === 'matched'"
              class="text-muted-foreground"
            >
              已移除
            </span>
          </div>
          <Button
            v-if="record.status === 'matched' && remaining(record) > 1"
            type="link"
            danger
            size="small"
            :disabled="busy || applied"
            :aria-label="`移除 ${record.input} 全部剧目`"
            :title="`移除 ${record.input} 匹配的全部剧目`"
            @click="removeLine(record)"
          >
            移除全部
          </Button>
        </template>
      </template>
    </Table>
    <Space class="mt-4 flex justify-end">
      <Button :disabled="busy" @click="open = false">
        {{ applied ? '完成' : '关闭' }}
      </Button>
      <Button :loading="busy" :disabled="applied" @click="submit(false)">
        预览匹配
      </Button>
      <Button
        type="primary"
        :danger="revoke"
        :loading="busy"
        :disabled="!preview || !count || applied"
        @click="submit(true)"
      >
        {{
          revoke
            ? `确认取消 ${uids.length} 人的 ${count} ${unit}授权`
            : `确认向 ${uids.length} 人授权 ${count} ${unit}`
        }}
      </Button>
    </Space>
  </Modal>
</template>
