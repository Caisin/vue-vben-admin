<script lang="ts" setup>
import { ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  TextArea,
} from 'antdv-next';

import {
  getLangList,
  translateText,
} from '#/api/res/seas/global/page_module_manage';
import { postSave } from '#/api/res/seas/set/category';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    record?: null | Record<string, any>;
  }>(),
  {
    open: false,
    record: null,
  },
);

const emit = defineEmits<{
  saved: [];
  'update:open': [boolean];
}>();

const loading = ref(false);
const saving = ref(false);
const rows = ref<
  {
    description: string;
    locale: string;
    name: string;
    title: string;
  }[]
>([]);

function langKey(lang: any) {
  return lang.locale ?? lang.lang ?? lang.code;
}

function langName(lang: any) {
  return lang.name ?? lang.c_name ?? lang.label ?? langKey(lang);
}

async function load() {
  if (!props.record) return;
  loading.value = true;
  try {
    const result = await getLangList();
    const languages = Array.isArray(result) ? result : (result?.items ?? []);
    rows.value = languages
      .map((lang: any) => {
        const locale = langKey(lang);
        if (!locale) return null;
        const old = props.record?.lang_info?.[locale] ?? {};
        return {
          description: old.description ?? '',
          locale,
          name: langName(lang),
          title: old.name ?? old.title ?? '',
        };
      })
      .filter(Boolean) as typeof rows.value;
  } finally {
    loading.value = false;
  }
}

function close() {
  emit('update:open', false);
}

async function translateAll() {
  const source = String(props.record?.name ?? '').trim();
  if (!source) {
    message.warning('分类名称为空，无法翻译');
    return;
  }
  saving.value = true;
  try {
    for (const row of rows.value) {
      const translated = await translateText(source, row.locale);
      row.title =
        translated?.text ?? translated?.value ?? String(translated ?? '');
    }
  } finally {
    saving.value = false;
  }
}

async function submit() {
  if (!props.record) return;
  saving.value = true;
  try {
    const langInfo = Object.fromEntries(
      rows.value.map((row) => [
        row.locale,
        { description: row.description, name: row.title },
      ]),
    );
    await postSave({ ...props.record, lang_info: langInfo });
    message.success('多语言配置已保存');
    emit('saved');
    close();
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) load();
  },
);
</script>

<template>
  <Modal
    :confirm-loading="saving"
    destroy-on-close
    :open="open"
    title="分类多语言"
    width="760px"
    @cancel="close"
    @ok="submit"
  >
    <Space class="mb-3" wrap>
      <Button :loading="saving" @click="translateAll">按分类名称翻译</Button>
    </Space>
    <Form layout="vertical">
      <div v-if="loading" class="py-8 text-center text-muted-foreground">
        加载语言中...
      </div>
      <div v-for="row in rows" v-else :key="row.locale" class="language-row">
        <div class="language-title">{{ row.name }}（{{ row.locale }}）</div>
        <FormItem label="分类名称" required>
          <Input v-model:value="row.title" />
        </FormItem>
        <FormItem label="分类描述">
          <TextArea v-model:value="row.description" :rows="2" />
        </FormItem>
      </div>
    </Form>
  </Modal>
</template>

<style scoped>
.language-row + .language-row {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid hsl(var(--border));
}

.language-title {
  margin-bottom: 8px;
  font-weight: 600;
}
</style>
