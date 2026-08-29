<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { ArticleDoc } from '#/api/article';
import type {
  ContentStatus,
  WmxtModule,
  WmxtModuleItem,
  WmxtModuleItemWrite,
} from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { ArticleApi } from '#/api/article';
import { WmxtAdminApi } from '#/api/wmxt';

type ContentType = 'article' | 'link' | 'video' | 'wechat';

interface DrawerData {
  module?: WmxtModule;
  modules?: WmxtModule[];
  row?: WmxtModuleItem;
  sort_order?: number;
}

interface ModuleItemFormValues {
  article_id?: number | string;
  content_type: ContentType;
  content_url: string;
  cover_url: string;
  description: string;
  module_id: number | string;
  sort_order: number;
  status: ContentStatus;
  title: string;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtModuleItem>();
const currentModule = ref<WmxtModule>();
const defaultSortOrder = ref(0);
const moduleOptions = ref<Array<{ label: string; value: number | string }>>([]);
const articleOptions = ref<Array<{ label: string; value: number | string }>>(
  [],
);

const schema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: [] },
    fieldName: 'module_id',
    help: '内容所属模块；从左侧模块进入时自动带入，也可在下拉框中按模块名称选择。',
    label: '所属模块',
    rules: 'selectRequired',
  },
  {
    component: 'DicRadioGroup',
    componentProps: {
      code: 'wmxt_content_type',
      onChange: (event: ContentType | { target?: { value?: ContentType } }) => {
        const value = typeof event === 'string' ? event : event.target?.value;
        if (value) syncContentTypeSchema(value);
      },
    },
    fieldName: 'content_type',
    help: '系统文章复用内容发布模块；微信公众号文章和指定链接使用经过校验的 HTTPS 地址。',
    label: '内容类型',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      optionFilterProp: 'label',
      options: [],
      placeholder: '请选择已发布文章',
      showSearch: true,
    },
    dependencies: {
      show: (values) => values.content_type === 'article',
      triggerFields: ['content_type'],
    },
    fieldName: 'article_id',
    formItemClass: 'md:col-span-2',
    help: '仅展示内容发布模块中已经成功发布的文章。',
    label: '系统文章',
  },
  {
    component: 'Input',
    componentProps: { placeholder: '请输入标题' },
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    help: '小程序模块内容列表展示的标题。',
    label: '标题',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 10, minRows: 4 } },
    fieldName: 'description',
    formItemClass: 'md:col-span-2',
    help: '用于小程序列表和详情页的简短摘要，不保存系统文章正文。',
    label: '内容摘要',
  },
  {
    component: 'FileUrlInput',
    componentProps: {
      accept: 'image/*',
      buttonText: '选择封面',
      placeholder: '可粘贴公开图片 URL，或从文件库选择/上传（保存文件 ID）',
    },
    fieldName: 'cover_url',
    formItemClass: 'md:col-span-2',
    help: '小程序内容卡片展示封面；文件库选择时保存文件 ID，公开外链才直接填写 URL。',
    label: '封面图',
  },
  {
    component: 'Input',
    componentProps: { placeholder: '请输入内容地址' },
    dependencies: {
      show: (values) => values.content_type !== 'article',
      triggerFields: ['content_type'],
    },
    fieldName: 'content_url',
    formItemClass: 'md:col-span-2',
    help: '微信公众号文章和指定链接必须使用 HTTPS；视频可从文件库选择。',
    label: '内容地址',
  },
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_content_status' },
    fieldName: 'status',
    help: '草稿不展示；发布后小程序可见；归档后隐藏但保留记录。',
    label: '状态',
    rules: 'selectRequired',
  },
];

const [Form, formApi] = useVbenForm({
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

async function syncContentTypeSchema(type: ContentType) {
  const isArticle = type === 'article';
  const isLink = type === 'link' || type === 'wechat';
  let contentUrlComponent: 'FileUrlInput' | 'Input' = 'FileUrlInput';
  let contentUrlComponentProps: Record<string, unknown> = {
    accept: 'video/*',
    buttonText: '选择视频',
    placeholder: '可粘贴公开视频 URL，或从文件库选择/上传（保存文件 ID）',
  };
  let contentUrlHelp =
    '视频类型必填；点击“选择视频”从文件库选择或上传时仅保存文件 ID，播放时再换取临时 URL。';
  let contentUrlLabel = '视频文件';

  if (isLink) {
    contentUrlComponent = 'Input';
    contentUrlComponentProps = {
      placeholder:
        type === 'wechat'
          ? 'https://mp.weixin.qq.com/s/...'
          : 'https://example.com/...',
    };
    contentUrlHelp =
      type === 'wechat'
        ? '仅允许 mp.weixin.qq.com 的微信公众号文章 HTTPS 地址。'
        : '仅允许公开可访问的 HTTPS 地址，不支持本机或私网地址。';
    contentUrlLabel = type === 'wechat' ? '微信文章地址' : '指定链接';
  }

  await formApi.updateSchema([
    {
      componentProps: {
        placeholder: '可选，填写内容摘要',
      },
      fieldName: 'description',
      help: isArticle
        ? '正文由内容发布模块维护，此处只填写列表摘要。'
        : undefined,
      label: '内容摘要',
    },
    {
      component: contentUrlComponent,
      componentProps: contentUrlComponentProps,
      fieldName: 'content_url',
      help: contentUrlHelp,
      label: contentUrlLabel,
    },
  ]);
}

function normalizeValues(values: ModuleItemFormValues): WmxtModuleItemWrite {
  return {
    article_id:
      values.content_type === 'article' ? Number(values.article_id) : undefined,
    content_type: values.content_type,
    content_url: values.content_url ?? '',
    cover_url: values.cover_url ?? '',
    description: values.description ?? '',
    id: current.value?.id,
    module_id: Number(values.module_id),
    sort_order:
      current.value?.sort_order ??
      Number(values.sort_order ?? defaultSortOrder.value),
    status: values.status,
    title: values.title,
  };
}

function normalizeContentType(
  value: string | undefined,
): ContentType | undefined {
  return value === 'article' ||
    value === 'wechat' ||
    value === 'link' ||
    value === 'video'
    ? value
    : undefined;
}

function validateByType(values: ModuleItemFormValues): boolean {
  if (!String(values.title ?? '').trim()) {
    message.warning('请输入标题');
    return false;
  }
  if (values.content_type === 'article' && !Number(values.article_id)) {
    message.warning('请选择已发布的系统文章');
    return false;
  }
  if (
    (values.content_type === 'link' || values.content_type === 'wechat') &&
    !String(values.content_url ?? '').trim()
  ) {
    message.warning('请填写 HTTPS 链接地址');
    return false;
  }
  if (
    values.content_type === 'video' &&
    !String(values.content_url ?? '').trim()
  ) {
    message.warning('视频类型请填写视频地址');
    return false;
  }
  return true;
}

const [Drawer, drawerApi] = useVbenDrawer<DrawerData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = (await formApi.getValues()) as ModuleItemFormValues;
    if (!validateByType(values)) return;

    drawerApi.lock();
    try {
      const payload = normalizeValues(values);
      await (current.value?.id
        ? WmxtAdminApi.update_module_item(current.value.id, payload)
        : WmxtAdminApi.create_module_item(payload));
      message.success('模块内容已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    current.value = data?.row;
    currentModule.value = data?.module;
    defaultSortOrder.value = data?.sort_order ?? 0;
    moduleOptions.value = (data?.modules ?? []).map((item) => ({
      label: `${item.page_code} / ${item.module_name}`,
      value: item.id,
    }));
    if (
      currentModule.value &&
      !moduleOptions.value.some(
        (item) => item.value === currentModule.value?.id,
      )
    ) {
      moduleOptions.value.unshift({
        label: `${currentModule.value.page_code} / ${currentModule.value.module_name}`,
        value: currentModule.value.id,
      });
    }
    const type =
      normalizeContentType(current.value?.content_type) ??
      (currentModule.value?.module_code === 'civilization_news'
        ? 'article'
        : 'video');
    await formApi.reset();
    const articlePage = await ArticleApi.list({
      size: 100,
      state: 'published',
    });
    articleOptions.value = articlePage.items.map((article: ArticleDoc) => ({
      label: article.title,
      value: article.id,
    }));
    await formApi.updateSchema([
      {
        componentProps: {
          disabled: Boolean(currentModule.value?.id),
          options: moduleOptions.value,
        },
        fieldName: 'module_id',
      },
      {
        componentProps: {
          options: articleOptions.value,
        },
        fieldName: 'article_id',
      },
    ]);
    await syncContentTypeSchema(type);
    await formApi.setValues({
      article_id: current.value?.article_id,
      content_type: type,
      content_url: current.value?.content_url ?? '',
      cover_url: current.value?.cover_url ?? '',
      description: current.value?.description ?? '',
      module_id: current.value?.module_id ?? currentModule.value?.id ?? 0,
      status: current.value?.status ?? 'draft',
      title: current.value?.title ?? '',
    });
  },
});

const drawerTitle = computed(() => {
  const prefix = current.value?.id ? '编辑内容' : '新增内容';
  return currentModule.value?.module_name
    ? `${prefix} - ${currentModule.value.module_name}`
    : prefix;
});
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
