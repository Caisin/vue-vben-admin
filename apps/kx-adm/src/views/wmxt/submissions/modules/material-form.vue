<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtMaterialWrite } from '#/api/wmxt';
import type { StorageFileReference } from '#/components/file-picker';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { fileRefsToJson } from '../../utils';

interface MaterialFormValues {
  attachments_refs: StorageFileReference[];
  note: string;
  title: string;
}

const emit = defineEmits<{ success: [] }>();

const schema: VbenFormSchema<MaterialFormValues>[] = [
  {
    component: 'Input',
    fieldName: 'title',
    formItemClass: 'md:col-span-2',
    help: '公共资料在小程序资料列表中展示的标题。',
    label: '标题',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
    fieldName: 'note',
    formItemClass: 'md:col-span-2',
    help: '资料说明或使用提示。',
    label: '说明',
  },
  {
    component: 'FileUrlsInput',
    componentProps: { buttonText: '选择附件', valueMode: 'ref-list' },
    fieldName: 'attachments_refs',
    formItemClass: 'md:col-span-2',
    help: '公共资料附件；保存 file_id 等稳定引用，打开预览时再换取临时 URL。',
    label: '附件',
  },
];

const [Form, formApi] = useVbenForm<MaterialFormValues>({
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

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      const payload: WmxtMaterialWrite = {
        attachments: fileRefsToJson(values.attachments_refs),
        note: values.note,
        title: values.title,
      };
      await WmxtAdminApi.create_public_material(payload);
      message.success('公共资料已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    await formApi.reset();
    await formApi.setValues({ attachments_refs: [], note: '', title: '' });
  },
});
</script>

<template>
  <Drawer class="w-full max-w-140" title="新增公共资料">
    <Form class="mx-4" />
  </Drawer>
</template>
