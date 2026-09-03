<script lang="ts" setup>
import type {
  DeveloperSubject,
  DeveloperSubjectWrite,
} from '#/api/developer-account';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { ArrowUpToLine, Download, Plus } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Button,
  Collapse,
  CollapsePanel,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Upload,
} from 'antdv-next';

import { DeveloperAccountApi } from '#/api/developer-account';
import { BusinessImport } from '#/components/import-export';
import { Times } from '#/times';

const rows = ref<DeveloperSubject[]>([]);
const { hasAccessByCodes } = useAccess();
const canUpdateSubject = computed(() =>
  hasAccessByCodes(['developer-account:subject-update']),
);
const loading = ref(false);
const saving = ref(false);
const open = ref(false);
const editing = ref<DeveloperSubject>();
const form = reactive<DeveloperSubjectWrite>(emptyForm());
const keyword = ref('');
const countryOrRegion = ref<string>();
const subjectId = ref<number>();
const duns = ref<string>();
const certifierName = ref<string>();
const filterOptions = ref<DeveloperSubject[]>([]);
const uploadingDocument = ref<'business_license' | 'duns'>();
const advancedSections = ref<string[]>([]);
const quickEditOpen = ref(false);
const quickEditSaving = ref(false);
const quickEditSubject = ref<DeveloperSubject>();
const quickEditField = ref<QuickEditField>();
const quickEditValue = ref('');

type QuickEditField =
  | 'certifier_name'
  | 'country_or_region'
  | 'duns'
  | 'registration_number'
  | 'subject_name_cn'
  | 'subject_name_en'
  | 'unified_social_credit_code';

const quickEditLabels: Record<QuickEditField, string> = {
  certifier_name: '法人',
  country_or_region: '国家或区域',
  duns: 'D-U-N-S',
  registration_number: '注册编号',
  subject_name_cn: '主体中文名称',
  subject_name_en: '主体英文名称',
  unified_social_credit_code: '统一社会信用代码',
};

const countryOrRegionOptions = computed(() =>
  uniqueOptions(filterOptions.value.map((item) => item.country_or_region)),
);
const subjectOptions = computed(() =>
  filterOptions.value.map((item) => ({
    label: item.subject_name_cn,
    value: item.id,
  })),
);
const dunsOptions = computed(() =>
  uniqueOptions(filterOptions.value.map((item) => item.duns)),
);
const certifierNameOptions = computed(() =>
  uniqueOptions(filterOptions.value.map((item) => item.certifier_name)),
);

const columns = [
  { dataIndex: 'country_or_region', title: '国家或区域', width: 140 },
  { dataIndex: 'subject_name_cn', title: '主体中文名称', width: 240 },
  { dataIndex: 'subject_name_en', title: '主体英文名称', width: 240 },
  { dataIndex: 'certifier_name', title: '法人', width: 120 },
  {
    dataIndex: 'unified_social_credit_code',
    title: '统一社会信用代码',
    width: 190,
  },
  { dataIndex: 'registration_number', title: '注册编号', width: 170 },
  { dataIndex: 'duns', title: 'D-U-N-S', width: 140 },
  { dataIndex: 'updated_at', title: '更新时间', width: 180 },
  { fixed: 'right' as const, key: 'actions', title: '操作', width: 130 },
];

function emptyForm(): DeveloperSubjectWrite {
  return {
    business_license_file_id: undefined,
    certifier_address: '',
    certifier_id_no: '',
    certifier_name: '',
    certifier_phone: '',
    company_address: '',
    country_or_region: '',
    unified_social_credit_code: '',
    registration_number: '',
    duns: '',
    enterprise_email: '',
    remark: '',
    subject_name_cn: '',
    subject_name_en: '',
    website: '',
    duns_file_id: undefined,
  };
}

function writeData(value: DeveloperSubjectWrite): DeveloperSubjectWrite {
  return {
    business_license_file_id: value.business_license_file_id,
    certifier_address: value.certifier_address,
    certifier_id_no: value.certifier_id_no,
    certifier_name: value.certifier_name,
    certifier_phone: value.certifier_phone,
    company_address: value.company_address,
    country_or_region: value.country_or_region,
    duns: value.duns,
    duns_file_id: value.duns_file_id,
    enterprise_email: value.enterprise_email,
    expected_version: value.expected_version,
    registration_number: value.registration_number,
    remark: value.remark,
    subject_name_cn: value.subject_name_cn,
    subject_name_en: value.subject_name_en,
    unified_social_credit_code: value.unified_social_credit_code,
    website: value.website,
  };
}

async function refresh() {
  loading.value = true;
  try {
    const all = await DeveloperAccountApi.subjects();
    filterOptions.value = all;
    const params = {
      certifier_name: certifierName.value,
      country_or_region: countryOrRegion.value,
      duns: duns.value,
      keyword: keyword.value.trim() || undefined,
      subject_id: subjectId.value,
    };
    rows.value = Object.values(params).some((value) => value !== undefined)
      ? await DeveloperAccountApi.subjects(params)
      : all;
  } finally {
    loading.value = false;
  }
}

function uniqueOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].map(
    (value) => ({ label: value, value }),
  );
}

function openCreate() {
  editing.value = undefined;
  Object.assign(form, emptyForm());
  advancedSections.value = [];
  open.value = true;
}

function openEdit(row: DeveloperSubject) {
  editing.value = row;
  Object.assign(form, row, { expected_version: row.updated_at });
  advancedSections.value = [];
  open.value = true;
}

function isQuickEditField(value: unknown): value is QuickEditField {
  return typeof value === 'string' && Object.hasOwn(quickEditLabels, value);
}

function openQuickEdit(row: DeveloperSubject, field: unknown) {
  if (!canUpdateSubject.value || !isQuickEditField(field)) return;
  quickEditSubject.value = row;
  quickEditField.value = field;
  quickEditValue.value = row[field];
  quickEditOpen.value = true;
}

function quickCellValue(row: DeveloperSubject, field: unknown) {
  return isQuickEditField(field) ? row[field] || '-' : '-';
}

async function saveQuickEdit() {
  const subject = quickEditSubject.value;
  const field = quickEditField.value;
  if (!subject || !field) return;
  const value = quickEditValue.value.trim();
  if (field === 'subject_name_cn' && !value) {
    message.warning('主体中文名称不能为空');
    return;
  }
  quickEditSaving.value = true;
  try {
    await DeveloperAccountApi.updateSubject(
      subject.id,
      writeData({
        ...subject,
        [field]: value,
        expected_version: subject.updated_at,
      }),
    );
    quickEditOpen.value = false;
    message.success(`${quickEditLabels[field]}已更新`);
    await refresh();
  } finally {
    quickEditSaving.value = false;
  }
}

async function save() {
  if (!form.subject_name_cn.trim()) {
    message.error('请输入主体名称');
    return;
  }
  saving.value = true;
  try {
    const data = writeData(form);
    await (editing.value
      ? DeveloperAccountApi.updateSubject(editing.value.id, data)
      : DeveloperAccountApi.createSubject(data));
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
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <Space class="min-w-0 flex-1" wrap>
        <Input.Search
          v-model:value="keyword"
          allow-clear
          class="w-72"
          placeholder="全文搜索主体信息"
          @change="() => !keyword && refresh()"
          @search="refresh"
        />
        <Select
          v-model:value="countryOrRegion"
          allow-clear
          class="w-44"
          :options="countryOrRegionOptions"
          placeholder="国家或区域"
          show-search
          @change="refresh"
        />
        <Select
          v-model:value="subjectId"
          allow-clear
          class="w-56"
          :options="subjectOptions"
          placeholder="主体"
          show-search
          @change="refresh"
        />
        <Select
          v-model:value="duns"
          allow-clear
          class="w-44"
          :options="dunsOptions"
          placeholder="D-U-N-S"
          show-search
          @change="refresh"
        />
        <Select
          v-model:value="certifierName"
          allow-clear
          class="w-44"
          :options="certifierNameOptions"
          placeholder="法人"
          show-search
          @change="refresh"
        />
      </Space>
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
      :scroll="{ x: 1330 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="isQuickEditField(column.dataIndex)">
          <button
            v-if="canUpdateSubject"
            class="cell-action text-left"
            type="button"
            @click="openQuickEdit(record, column.dataIndex)"
          >
            {{ quickCellValue(record, column.dataIndex) }}
          </button>
          <span v-else>{{ quickCellValue(record, column.dataIndex) }}</span>
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
      v-model:open="quickEditOpen"
      :confirm-loading="quickEditSaving"
      :title="`编辑${quickEditField ? quickEditLabels[quickEditField] : '字段'}`"
      width="520px"
      @ok="saveQuickEdit"
    >
      <Form layout="vertical">
        <FormItem
          :label="quickEditField ? quickEditLabels[quickEditField] : '字段值'"
          :required="quickEditField === 'subject_name_cn'"
        >
          <Input
            v-model:value="quickEditValue"
            autofocus
            @press-enter="saveQuickEdit"
          />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      :title="editing ? '编辑主体' : '新增主体'"
      width="820px"
      @ok="save"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="主体中文名称" required>
            <Input v-model:value="form.subject_name_cn" />
          </FormItem>
          <FormItem label="主体英文名称">
            <Input v-model:value="form.subject_name_en" />
          </FormItem>
          <FormItem label="国家或区域">
            <Input v-model:value="form.country_or_region" />
          </FormItem>
          <FormItem label="法人">
            <Input v-model:value="form.certifier_name" />
          </FormItem>
          <FormItem label="统一社会信用代码">
            <Input v-model:value="form.unified_social_credit_code" />
          </FormItem>
          <FormItem label="注册编号">
            <Input v-model:value="form.registration_number" />
          </FormItem>
          <FormItem label="D-U-N-S">
            <Input v-model:value="form.duns" />
          </FormItem>
          <FormItem class="col-span-2" label="注册地址">
            <Input.TextArea v-model:value="form.company_address" :rows="2" />
          </FormItem>
          <FormItem label="认证官网">
            <Input v-model:value="form.website" />
          </FormItem>
        </div>

        <Collapse v-model:active-key="advancedSections" ghost>
          <CollapsePanel key="more" header="更多字段">
            <div class="grid grid-cols-2 gap-x-4">
              <FormItem label="法人证件号码">
                <Input v-model:value="form.certifier_id_no" />
              </FormItem>
              <FormItem label="法人手机号">
                <Input v-model:value="form.certifier_phone" />
              </FormItem>
              <FormItem class="col-span-2" label="法人地址">
                <Input v-model:value="form.certifier_address" />
              </FormItem>
              <FormItem label="企业邮箱">
                <Input v-model:value="form.enterprise_email" />
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
                      form.duns_file_id
                        ? `文件 #${form.duns_file_id}`
                        : '未上传'
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
                    @click="
                      downloadDocument(form.duns_file_id, '邓白氏证明资料')
                    "
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
          </CollapsePanel>
        </Collapse>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.cell-action {
  color: hsl(var(--primary));
  cursor: pointer;
}

.cell-action:hover {
  text-decoration: underline;
}
</style>
