<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtSnapshot } from '#/api/wmxt';
import type { StorageFileReference } from '#/components/file-picker';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { fileRefsToJson } from '../../utils';

interface RectifyFormValues {
  rectify_media_refs: StorageFileReference[];
  review_comment: string;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtSnapshot>();

const schema: VbenFormSchema<RectifyFormValues>[] = [
  {
    component: 'FileUrlsInput',
    componentProps: {
      accept: 'image/*,video/*',
      buttonText: '选择材料',
      valueMode: 'ref-list',
    },
    fieldName: 'rectify_media_refs',
    formItemClass: 'md:col-span-2',
    help: '整改后的图片或视频；保存稳定文件引用，展示时用当前授权换取临时 URL。',
    label: '整改材料',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 4 } },
    fieldName: 'review_comment',
    formItemClass: 'md:col-span-2',
    help: '整改说明或反馈意见，用于后台追溯。',
    label: '整改说明',
  },
];

const [Form, formApi] = useVbenForm<RectifyFormValues>({
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

const [Drawer, drawerApi] = useVbenDrawer<WmxtSnapshot>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !current.value) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      await WmxtAdminApi.rectify_snapshot(current.value.id, {
        rectify_media_urls: fileRefsToJson(values.rectify_media_refs),
        review_comment: values.review_comment ?? '',
      });
      message.success('整改信息已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    current.value = drawerApi.getData();
    await formApi.reset();
    await formApi.setValues({ rectify_media_refs: [], review_comment: '' });
  },
});
</script>

<template>
  <Drawer class="w-full max-w-120" title="随手拍整改">
    <Form class="mx-4" />
  </Drawer>
</template>
