<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  SurveyStatus,
  SurveyTarget,
  WmxtSurvey,
  WmxtSurveyDetail,
  WmxtSurveyQuestion,
  WmxtSurveyWrite,
} from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { linesToOptionObjects, toNumber } from '../../utils';
import { targetRoleOptions } from '../data';

interface SurveyFormValues {
  deadline_at?: number | string;
  description: string;
  points: number;
  status: SurveyStatus;
  target: SurveyTarget;
  title: string;
}

interface QuestionFormValue {
  id: number | string;
  options_text: string;
  q_type: 'multiple' | 'single' | 'text';
  required: boolean;
  sort: number;
  title: string;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtSurvey>();
const questions = ref<QuestionFormValue[]>([]);

const surveyStatusOptions = [
  { label: '进行中', value: 'active' },
  { label: '已结束', value: 'closed' },
];

const questionTypeOptions = [
  { label: '单选题', value: 'single' },
  { label: '多选题', value: 'multiple' },
  { label: '问答题', value: 'text' },
];

const schema: VbenFormSchema<SurveyFormValues>[] = [
  {
    component: 'Input',
    componentProps: { placeholder: '请输入问卷标题' },
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    help: '小程序问卷列表和详情页展示的标题。',
    label: '标题',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 4 } },
    fieldName: 'description',
    formItemClass: 'md:col-span-2',
    help: '问卷说明，会在小程序答题前展示。',
    label: '说明',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: targetRoleOptions },
    fieldName: 'target',
    help: '控制个人端、家庭端、单位端或全部用户是否可见。',
    label: '对象',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: surveyStatusOptions },
    fieldName: 'status',
    help: '进行中可答题；已结束不可继续提交。',
    label: '状态',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'points',
    help: '用户完成问卷后获得的积分。',
    label: '积分',
  },
  {
    component: 'DatePicker',
    componentProps: { class: 'w-full', showTime: true, valueFormat: 'X' },
    fieldName: 'deadline_at',
    help: '超过截止时间后，小程序端不再允许提交。',
    label: '截止时间',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm<SurveyFormValues>({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
    labelClass: 'whitespace-nowrap',
    labelWidth: 96,
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

function optionsText(value: WmxtSurveyQuestion['options_json']): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const label = item.label;
        const optionValue = item.value;
        if (typeof label === 'string') return label;
        if (typeof optionValue === 'string') return optionValue;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function normalizeQuestionType(type: string): QuestionFormValue['q_type'] {
  if (type === 'multi') return 'multiple';
  if (type === 'multiple' || type === 'single' || type === 'text') return type;
  return 'single';
}

function addQuestion() {
  questions.value.push({
    id: `new-${Date.now()}`,
    options_text: '',
    q_type: 'single',
    required: true,
    sort: questions.value.length + 1,
    title: '',
  });
}

function removeQuestion(index: number) {
  questions.value.splice(index, 1);
  questions.value.forEach((question, questionIndex) => {
    question.sort = questionIndex + 1;
  });
}

function validateQuestions(): boolean {
  if (questions.value.length === 0) {
    message.warning('请至少添加一个问题');
    return false;
  }
  for (const [index, question] of questions.value.entries()) {
    if (!question.title.trim()) {
      message.warning(`请输入第 ${index + 1} 题标题`);
      return false;
    }
    if (
      question.q_type !== 'text' &&
      linesToOptionObjects(question.options_text).length === 0
    ) {
      message.warning(`请输入第 ${index + 1} 题选项`);
      return false;
    }
  }
  return true;
}

function buildPayload(values: SurveyFormValues): WmxtSurveyWrite {
  return {
    questions: questions.value.map((question, index) => ({
      id: typeof question.id === 'number' ? question.id : undefined,
      options_json:
        question.q_type === 'text'
          ? []
          : linesToOptionObjects(question.options_text),
      q_type: question.q_type,
      required: question.required,
      sort: index + 1,
      survey_id: current.value?.id,
      title: question.title,
    })),
    survey: {
      deadline_at: toNumber(values.deadline_at),
      description: values.description ?? '',
      id: current.value?.id,
      points: toNumber(values.points),
      status: values.status,
      target: values.target,
      title: values.title,
    },
  };
}

async function loadSurvey(row: undefined | WmxtSurvey) {
  if (!row?.id) {
    current.value = undefined;
    questions.value = [];
    addQuestion();
    return;
  }
  const detail = await WmxtAdminApi.survey(row.id);
  const data = detail as WmxtSurveyDetail;
  current.value = data.survey;
  questions.value = [...data.questions]
    .toSorted((a, b) => a.sort - b.sort)
    .map((question) => ({
      id: question.id ?? `new-${Date.now()}`,
      options_text: optionsText(question.options_json),
      q_type: normalizeQuestionType(question.q_type),
      required: question.required,
      sort: question.sort,
      title: question.title,
    }));
  if (questions.value.length === 0) addQuestion();
}

const [Drawer, drawerApi] = useVbenDrawer<WmxtSurvey>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !validateQuestions()) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      const payload = buildPayload(values);
      await (current.value?.id
        ? WmxtAdminApi.update_survey(current.value.id, payload)
        : WmxtAdminApi.create_survey(payload));
      message.success('问卷已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const row = drawerApi.getData();
    await formApi.reset();
    await loadSurvey(row);
    await formApi.setValues({
      deadline_at: current.value?.deadline_at
        ? String(current.value.deadline_at)
        : undefined,
      description: current.value?.description ?? '',
      points: toNumber(current.value?.points, 10),
      status: current.value?.status ?? 'active',
      target: current.value?.target ?? 'personal',
      title: current.value?.title ?? '',
    });
  },
});

const drawerTitle = computed(() =>
  current.value?.id ? '编辑问卷' : '新增问卷',
);
</script>

<template>
  <Drawer class="w-full max-w-220" :title="drawerTitle">
    <Form class="mx-4" />
    <div
      class="mx-4 mt-4 rounded border border-gray-200 p-4 dark:border-gray-700"
    >
      <div class="mb-3 flex items-center justify-between">
        <div class="font-medium">问题列表（{{ questions.length }}）</div>
        <Button
          v-access:code="'wmxt:survey:write'"
          size="small"
          type="primary"
          @click="addQuestion"
        >
          <Plus class="size-4" />添加问题
        </Button>
      </div>
      <div
        v-for="(question, index) in questions"
        :key="question.id"
        class="mb-3 grid grid-cols-1 gap-3 rounded bg-gray-50 p-3 md:grid-cols-12 dark:bg-gray-900"
      >
        <InputNumber
          v-model:value="question.sort"
          class="md:col-span-1"
          :min="1"
          :precision="0"
        />
        <Input
          v-model:value="question.title"
          class="md:col-span-4"
          placeholder="问题标题"
        />
        <Select
          v-model:value="question.q_type"
          class="md:col-span-2"
          :options="questionTypeOptions"
        />
        <Input
          v-model:value="question.options_text"
          class="md:col-span-3"
          :disabled="question.q_type === 'text'"
          placeholder="选项，逗号或换行分隔"
        />
        <div class="flex items-center gap-2 md:col-span-1">
          <Switch v-model:checked="question.required" size="small" />必填
        </div>
        <Button
          danger
          size="small"
          type="link"
          class="md:col-span-1"
          @click="removeQuestion(index)"
        >
          删除
        </Button>
      </div>
      <div class="text-xs text-gray-500">
        单选/多选题的选项支持逗号或换行分隔；问答题不需要填写选项。
      </div>
    </div>
  </Drawer>
</template>
