<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  TextArea,
} from 'antdv-next';

import { getListAll as getSourceListAll } from '#/api/res/seas/global/source_manage';

import EditModal from './EditModal.vue';

const props = defineProps<{ open: boolean; record?: Record<string, any> }>();
const emit = defineEmits<{
  submit: [value: any];
  'update:open': [value: boolean];
}>();

const saving = ref(false);
const sourceOptions = ref<Array<{ label: string; value: any }>>([]);
const segmentOpen = ref(false);
const segmentIndex = ref(0);
const form = reactive<Record<string, any>>({});
const resRows = ref<Array<{ list?: any[]; res_id?: any }>>([]);

const isVideo = computed(() => form.event_name === 'Video');

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
    const record = JSON.parse(JSON.stringify(props.record ?? {}));
    const cfg = record.cfg ?? record;
    Object.assign(form, {
      id: cfg.id ?? record.id,
      event_name: cfg.event_name,
      task_title: cfg.task_title ?? cfg.title,
      task_type: cfg.task_type ?? 1,
      reward: cfg.reward,
      state: cfg.state ?? 1,
      lang_zh: cfg.lang?.zh,
      lang_zh_hk: cfg.lang?.zh_hk,
      lang_en: cfg.lang?.en,
      lang_ja: cfg.lang?.ja,
      lang_ko: cfg.lang?.ko,
      lang_vi: cfg.lang?.vi,
      lang_fr: cfg.lang?.fr,
      lang_it: cfg.lang?.it,
    });
    resRows.value = (record.twoList ?? record.two_list ?? []).map(
      (item: any) => ({ res_id: item.res_id, list: item.list ?? [] }),
    );
    if (form.event_name === 'Video' && resRows.value.length === 0)
      resRows.value.push({ res_id: undefined, list: [] });
    await loadSources();
  },
);

async function loadSources() {
  if (sourceOptions.value.length > 0) return;
  const list = await getSourceListAll({});
  sourceOptions.value = (Array.isArray(list) ? list : []).map((item: any) => ({
    label: item.res_name ?? item.title ?? `${item.id}`,
    value: item.id,
  }));
}

function addRes() {
  resRows.value.push({ res_id: undefined, list: [] });
}
function removeRes(index: number) {
  resRows.value.splice(index, 1);
}
function editSegments(index: number) {
  segmentIndex.value = index;
  segmentOpen.value = true;
}
function setSegments(data: { list: any[] }) {
  const row = resRows.value[segmentIndex.value];
  if (row) row.list = data.list;
}

async function submit() {
  const selected = resRows.value.map((item) => item.res_id).filter(Boolean);
  if (isVideo.value && new Set(selected).size !== selected.length) {
    message.error('存在重复的剧集');
    return;
  }
  if (
    isVideo.value &&
    resRows.value.some((item) => !item.res_id || !item.list?.length)
  ) {
    message.error('视频任务必须选择剧集并设置分段奖励');
    return;
  }
  saving.value = true;
  try {
    emit('submit', {
      cfg: {
        id: form.id,
        event_name: form.event_name,
        task_title: form.task_title,
        task_type: form.task_type,
        reward: form.reward,
        lang: {
          zh: form.lang_zh,
          zh_hk: form.lang_zh_hk,
          en: form.lang_en,
          ja: form.lang_ja,
          ko: form.lang_ko,
          vi: form.lang_vi,
          fr: form.lang_fr,
          it: form.lang_it,
        },
        state: form.state,
      },
      two_list: isVideo.value
        ? resRows.value.map((item) => ({
            task_id: form.id,
            res_id: item.res_id,
            list: item.list,
            state: 1,
          }))
        : [],
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    title="任务配置"
    width="980px"
    :confirm-loading="saving"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <Space class="w-full" direction="vertical">
        <FormItem label="任务名称" required>
          <Input v-model:value="form.task_title" />
        </FormItem>
        <Space wrap>
          <FormItem label="事件名称" required>
            <Input
              v-model:value="form.event_name"
              :disabled="!!form.id"
              class="w-[180px]"
            />
          </FormItem>
          <FormItem label="任务类型" required>
            <Select
              v-model:value="form.task_type"
              class="w-[160px]"
              :options="[
                { label: '新手任务', value: 1 },
                { label: '日常任务', value: 2 },
              ]"
            />
          </FormItem>
          <FormItem v-if="!isVideo" label="任务奖励" required>
            <InputNumber
              v-model:value="form.reward"
              addon-after="赠币"
              :min="0"
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              v-model:value="form.state"
              class="w-[120px]"
              :options="[
                { label: '正常', value: 1 },
                { label: '停用', value: 0 },
              ]"
            />
          </FormItem>
        </Space>
        <FormItem label="中文名称" required>
          <Input v-model:value="form.lang_zh" />
        </FormItem>
        <Space wrap>
          <FormItem label="繁体">
            <Input v-model:value="form.lang_zh_hk" class="w-[180px]" />
          </FormItem>
          <FormItem label="英文">
            <Input v-model:value="form.lang_en" class="w-[180px]" />
          </FormItem>
          <FormItem label="日文">
            <Input v-model:value="form.lang_ja" class="w-[180px]" />
          </FormItem>
          <FormItem label="韩文">
            <Input v-model:value="form.lang_ko" class="w-[180px]" />
          </FormItem>
          <FormItem label="越南文">
            <Input v-model:value="form.lang_vi" class="w-[180px]" />
          </FormItem>
          <FormItem label="法文">
            <Input v-model:value="form.lang_fr" class="w-[180px]" />
          </FormItem>
          <FormItem label="意大利文">
            <Input v-model:value="form.lang_it" class="w-[180px]" />
          </FormItem>
        </Space>
        <template v-if="isVideo">
          <FormItem label="剧集分段奖励">
            <Space
              v-for="(item, index) in resRows"
              :key="index"
              class="mb-2"
              wrap
            >
              <Select
                v-model:value="item.res_id"
                show-search
                class="w-[300px]"
                :options="sourceOptions"
              />
              <Button @click="editSegments(index)">
                设置分段({{ item.list?.length || 0 }})
              </Button>
              <Button
                danger
                :disabled="resRows.length <= 1"
                @click="removeRes(index)"
              >
                删除
              </Button>
            </Space>
            <Button type="dashed" @click="addRes">新增剧集</Button>
          </FormItem>
        </template>
      </Space>
      <TextArea class="hidden" />
    </Form>
    <EditModal
      v-model:open="segmentOpen"
      :list="resRows[segmentIndex]?.list"
      @success="setSegments"
    />
  </Modal>
</template>
