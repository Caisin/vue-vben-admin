<script lang="ts" setup>
import type {
  DeveloperCertifier,
  DeveloperCertifierWrite,
} from '#/api/developer-account';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { ArrowUpToLine, Plus } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  Table,
  Upload,
} from 'antdv-next';

import { DeveloperAccountApi } from '#/api/developer-account';
import { FileRefPreview } from '#/components/file-picker';
import { Times } from '#/times';

const { hasAccessByCodes } = useAccess();
const canCreate = computed(() =>
  hasAccessByCodes(['developer-account:certifier-create']),
);
const canUpdate = computed(() =>
  hasAccessByCodes(['developer-account:certifier-update']),
);
const canDelete = computed(() =>
  hasAccessByCodes(['developer-account:certifier-delete']),
);
const rows = ref<DeveloperCertifier[]>([]);
const loading = ref(false);
const saving = ref(false);
const documentUploading = ref(false);
const open = ref(false);
const keyword = ref('');
const editing = ref<DeveloperCertifier>();
const form = reactive<DeveloperCertifierWrite>(emptyForm());

const columns = [
  { dataIndex: 'name', title: '姓名', width: 140 },
  { dataIndex: 'id_no', title: '证件号码', width: 210 },
  { dataIndex: 'phone', title: '手机号', width: 150 },
  { dataIndex: 'enterprise_email', title: '企业邮箱', width: 220 },
  { dataIndex: 'address', title: '地址', minWidth: 220 },
  { dataIndex: 'updated_at', title: '更新时间', width: 180 },
  { key: 'actions', title: '操作', width: 130, fixed: 'right' as const },
];

function emptyForm(): DeveloperCertifierWrite {
  return {
    address: '',
    document_file_id: undefined,
    enterprise_email: '',
    expected_updated_at: undefined,
    id_no: '',
    name: '',
    phone: '',
    remark: '',
  };
}

async function refresh() {
  loading.value = true;
  try {
    rows.value = await DeveloperAccountApi.certifiers({
      keyword: keyword.value.trim() || undefined,
    });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = undefined;
  Object.assign(form, emptyForm());
  open.value = true;
}

function openEdit(row: DeveloperCertifier) {
  editing.value = row;
  Object.assign(form, row, { expected_updated_at: row.updated_at });
  open.value = true;
}

async function save() {
  if (!form.name.trim()) {
    message.warning('请输入认证人姓名');
    return;
  }
  saving.value = true;
  try {
    await (editing.value
      ? DeveloperAccountApi.updateCertifier(editing.value.id, form)
      : DeveloperAccountApi.createCertifier(form));
    message.success('认证人已保存');
    open.value = false;
    await refresh();
  } finally {
    saving.value = false;
  }
}

async function uploadDocument(file: File) {
  documentUploading.value = true;
  try {
    const [uploaded] = await DeveloperAccountApi.uploadSubjectDocument(file);
    if (!uploaded) {
      message.error('认证资料上传失败');
      return Upload.LIST_IGNORE;
    }
    form.document_file_id = Number(uploaded.file.file_id);
    message.success('认证资料已上传');
  } finally {
    documentUploading.value = false;
  }
  return Upload.LIST_IGNORE;
}

function remove(row: DeveloperCertifier) {
  Modal.confirm({
    content: row.name,
    okButtonProps: { danger: true },
    title: '删除认证人',
    async onOk() {
      await DeveloperAccountApi.removeCertifier(row.id);
      message.success('认证人已删除');
      await refresh();
    },
  });
}

onMounted(refresh);
</script>

<template>
  <Page auto-content-height class="management-page">
    <div class="mb-3 flex items-center justify-between gap-3">
      <Input.Search
        v-model:value="keyword"
        allow-clear
        class="max-w-100"
        placeholder="姓名、证件号码、手机号或企业邮箱"
        @search="refresh"
      />
      <Button v-if="canCreate" type="primary" @click="openCreate">
        <Plus class="size-4" />新增认证人
      </Button>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
      :scroll="{ x: 1250 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'updated_at'">
          {{ Times.formatUnix(record.updated_at) }}
        </template>
        <Space v-else-if="column.key === 'actions'">
          <Button v-if="canUpdate" type="link" @click="openEdit(record)">
            编辑
          </Button>
          <Button v-if="canDelete" danger type="link" @click="remove(record)">
            删除
          </Button>
        </Space>
      </template>
    </Table>

    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      :title="editing ? '编辑认证人' : '新增认证人'"
      width="720px"
      @ok="save"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="姓名" required>
            <Input v-model:value="form.name" />
          </FormItem>
          <FormItem label="证件号码">
            <Input v-model:value="form.id_no" />
          </FormItem>
          <FormItem label="手机号">
            <Input v-model:value="form.phone" />
          </FormItem>
          <FormItem label="企业邮箱">
            <Input v-model:value="form.enterprise_email" />
          </FormItem>
          <FormItem class="col-span-2" label="地址">
            <Input v-model:value="form.address" />
          </FormItem>
          <FormItem class="col-span-2" label="认证资料">
            <div class="flex items-center gap-3">
              <FileRefPreview
                v-if="form.document_file_id"
                :value="form.document_file_id"
              />
              <Upload :before-upload="uploadDocument" :show-upload-list="false">
                <Button :loading="documentUploading">
                  <ArrowUpToLine class="size-4" />
                  {{ form.document_file_id ? '替换资料' : '上传资料' }}
                </Button>
              </Upload>
              <Button
                v-if="form.document_file_id"
                type="link"
                @click="form.document_file_id = undefined"
              >
                移除
              </Button>
            </div>
          </FormItem>
          <FormItem class="col-span-2" label="备注">
            <Input.TextArea v-model:value="form.remark" :rows="3" />
          </FormItem>
        </div>
      </Form>
    </Modal>
  </Page>
</template>
