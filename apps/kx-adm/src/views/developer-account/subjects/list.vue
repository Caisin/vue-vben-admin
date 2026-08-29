<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type {
  DeveloperSubject,
  DeveloperSubjectWrite,
} from '#/api/developer-account';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { ArrowUpToLine, Download, Plus } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  Table,
  Upload,
} from 'antdv-next';
import dayjs from 'dayjs';

import { DeveloperAccountApi } from '#/api/developer-account';
import { BusinessImport } from '#/components/import-export';
import { Times } from '#/times';

const rows = ref<DeveloperSubject[]>([]);
const loading = ref(false);
const saving = ref(false);
const open = ref(false);
const editing = ref<DeveloperSubject>();
const form = reactive<DeveloperSubjectWrite>(emptyForm());
const registeredAt = ref<Dayjs>();
const smallBusinessAppliedAt = ref<Dayjs>();
const uploadingDocument = ref<'business_license' | 'duns'>();

const columns = [
  { dataIndex: 'subject_name_cn', title: '主体名称' },
  { dataIndex: 'company_name', title: '公司主体' },
  { dataIndex: 'duns', title: 'D-U-N-S' },
  { dataIndex: 'registered_at', title: '注册时间' },
  { dataIndex: 'updated_at', title: '更新时间' },
  { key: 'actions', title: '操作' },
];

function emptyForm(): DeveloperSubjectWrite {
  return {
    business_license_file_id: undefined,
    certifier_address: '',
    certifier_id_no: '',
    certifier_name: '',
    certifier_phone: '',
    company_address: '',
    company_name: '',
    unified_social_credit_code: '',
    registration_number: '',
    duns: '',
    enterprise_email: '',
    remark: '',
    registered_at: 0,
    small_business_applied_at: '',
    small_business_status: '',
    subject_name_cn: '',
    subject_name_en: '',
    tiktok_us_registered: false,
    website: '',
    duns_file_id: undefined,
  };
}

async function refresh() {
  loading.value = true;
  try {
    rows.value = await DeveloperAccountApi.subjects();
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = undefined;
  Object.assign(form, emptyForm());
  registeredAt.value = undefined;
  smallBusinessAppliedAt.value = undefined;
  open.value = true;
}

function openEdit(row: DeveloperSubject) {
  editing.value = row;
  Object.assign(form, row, { expected_version: row.updated_at });
  registeredAt.value = row.registered_at
    ? dayjs.unix(row.registered_at)
    : undefined;
  const appliedAt = row.small_business_applied_at
    ? dayjs(row.small_business_applied_at)
    : undefined;
  smallBusinessAppliedAt.value = appliedAt?.isValid() ? appliedAt : undefined;
  open.value = true;
}

async function save() {
  if (!form.subject_name_cn.trim()) {
    message.error('请输入主体名称');
    return;
  }
  saving.value = true;
  try {
    form.registered_at = registeredAt.value?.unix() ?? 0;
    form.small_business_applied_at =
      smallBusinessAppliedAt.value?.format('YYYY-MM-DD HH:mm:ss') ?? '';
    await (editing.value
      ? DeveloperAccountApi.updateSubject(editing.value.id, form)
      : DeveloperAccountApi.createSubject(form));
    open.value = false;
    message.success('主体已保存');
    await refresh();
  } finally {
    saving.value = false;
  }
}

async function uploadDocument(
  field: 'business_license_file_id' | 'duns_file_id',
  file: File,
) {
  uploadingDocument.value =
    field === 'business_license_file_id' ? 'business_license' : 'duns';
  try {
    const [uploaded] = await DeveloperAccountApi.uploadSubjectDocument(file);
    if (!uploaded) {
      message.error('资料上传失败');
      return Upload.LIST_IGNORE;
    }
    form[field] = Number(uploaded.file.file_id);
    message.success('资料已上传');
  } finally {
    uploadingDocument.value = undefined;
  }
  return Upload.LIST_IGNORE;
}

function uploadBusinessLicense(file: File) {
  return uploadDocument('business_license_file_id', file);
}

function uploadDunsProof(file: File) {
  return uploadDocument('duns_file_id', file);
}

async function downloadDocument(id: number, fileName: string) {
  const blob = await DeveloperAccountApi.downloadSubjectDocument(id);
  downloadFileFromBlob({ fileName, source: blob });
}

function remove(row: DeveloperSubject) {
  Modal.confirm({
    title: '删除主体',
    content: row.subject_name_cn,
    okButtonProps: { danger: true },
    onOk: async () => {
      await DeveloperAccountApi.removeSubject(row.id);
      message.success('主体已删除');
      await refresh();
    },
  });
}

onMounted(refresh);
</script>

<template>
  <Page auto-content-height class="management-page">
    <div class="mb-3 flex justify-end">
      <Space>
        <Button @click="refresh">刷新</Button>
        <span v-access:code="'developer-account:subject-import'">
          <BusinessImport
            button-text="导入主体"
            definition-code="developer_account.subject"
            @completed="refresh"
          />
        </span>
        <Button
          v-access:code="'developer-account:subject-create'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-4" />新增主体
        </Button>
      </Space>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'registered_at'">
          {{ Times.formatOptionalUnix(record.registered_at) }}
        </template>
        <template v-else-if="column.dataIndex === 'updated_at'">
          {{ Times.formatOptionalUnix(record.updated_at) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <Space>
            <Button
              v-access:code="'developer-account:subject-update'"
              type="link"
              @click="openEdit(record)"
            >
              编辑
            </Button>
            <Button
              v-access:code="'developer-account:subject-delete'"
              danger
              type="link"
              @click="remove(record)"
            >
              删除
            </Button>
          </Space>
        </template>
      </template>
    </Table>

    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      title="主体信息"
      width="760px"
      @ok="save"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="主体名称" required>
            <Input v-model:value="form.subject_name_cn" />
          </FormItem>
          <FormItem label="英文名称">
            <Input v-model:value="form.subject_name_en" />
          </FormItem>
          <FormItem label="公司主体">
            <Input v-model:value="form.company_name" />
          </FormItem>
          <FormItem label="D-U-N-S">
            <Input v-model:value="form.duns" />
          </FormItem>
          <FormItem class="col-span-2" label="公司地址">
            <Input v-model:value="form.company_address" />
          </FormItem>
          <FormItem label="注册时间">
            <DatePicker
              v-model:value="registeredAt"
              class="w-full"
              format="YYYY-MM-DD HH:mm:ss"
              show-time
            />
          </FormItem>
          <FormItem label="认证官网">
            <Input v-model:value="form.website" />
          </FormItem>
          <FormItem label="小企业状态">
            <Input v-model:value="form.small_business_status" />
          </FormItem>
          <FormItem label="小企业申请时间">
            <DatePicker
              v-model:value="smallBusinessAppliedAt"
              class="w-full"
              format="YYYY-MM-DD HH:mm:ss"
              show-time
            />
          </FormItem>
          <FormItem class="col-span-2" label="营业执照资料">
            <Space wrap>
              <span class="text-sm text-muted-foreground">
                {{
                  form.business_license_file_id
                    ? `文件 #${form.business_license_file_id}`
                    : '未上传'
                }}
              </span>
              <Upload
                accept="image/*,.pdf"
                :before-upload="uploadBusinessLicense"
                :show-upload-list="false"
              >
                <Button :loading="uploadingDocument === 'business_license'">
                  <ArrowUpToLine class="size-4" />上传或替换
                </Button>
              </Upload>
              <Button
                v-if="form.business_license_file_id"
                type="text"
                @click="
                  downloadDocument(
                    form.business_license_file_id,
                    '营业执照资料',
                  )
                "
              >
                <Download class="size-4" />下载
              </Button>
              <Button
                v-if="form.business_license_file_id"
                danger
                type="text"
                @click="form.business_license_file_id = undefined"
              >
                移除
              </Button>
            </Space>
          </FormItem>
          <FormItem class="col-span-2" label="邓白氏证明资料">
            <Space wrap>
              <span class="text-sm text-muted-foreground">
                {{
                  form.duns_file_id ? `文件 #${form.duns_file_id}` : '未上传'
                }}
              </span>
              <Upload
                accept="image/*,.pdf,.doc,.docx"
                :before-upload="uploadDunsProof"
                :show-upload-list="false"
              >
                <Button :loading="uploadingDocument === 'duns'">
                  <ArrowUpToLine class="size-4" />上传或替换
                </Button>
              </Upload>
              <Button
                v-if="form.duns_file_id"
                type="text"
                @click="downloadDocument(form.duns_file_id, '邓白氏证明资料')"
              >
                <Download class="size-4" />下载
              </Button>
              <Button
                v-if="form.duns_file_id"
                danger
                type="text"
                @click="form.duns_file_id = undefined"
              >
                移除
              </Button>
            </Space>
          </FormItem>
          <FormItem class="col-span-2" label="备注">
            <Input.TextArea v-model:value="form.remark" :rows="3" />
          </FormItem>
        </div>
      </Form>
    </Modal>
  </Page>
</template>
