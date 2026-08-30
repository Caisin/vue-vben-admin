<script lang="ts" setup>
import type { InvoiceDuplicateUserView, InvoiceItemView } from '#/api/invoice';

import { ref, watch } from 'vue';

import {
  Alert,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { InvoiceApi } from '#/api/invoice';
import { Times } from '#/times';

const props = defineProps<{
  canAdmin?: boolean;
  canUpdate?: boolean;
  invoice?: InvoiceItemView;
  open: boolean;
}>();

const emit = defineEmits<{
  edit: [value: InvoiceItemView];
  'update:open': [value: boolean];
}>();

const duplicateUsers = ref<InvoiceDuplicateUserView[]>([]);
const duplicateLoading = ref(false);
const duplicateLoadedFor = ref<string>();

watch(
  () => [props.open, props.invoice?.invoice_id] as const,
  () => {
    duplicateUsers.value = [];
    duplicateLoadedFor.value = undefined;
  },
);

function close() {
  emit('update:open', false);
}

async function loadDuplicateUsers() {
  if (!props.invoice || !props.canAdmin) return;
  const id = String(props.invoice.invoice_id);
  if (duplicateLoadedFor.value === id) return;
  duplicateLoading.value = true;
  try {
    duplicateUsers.value = await InvoiceApi.duplicateUsers(
      props.invoice.invoice_id,
    );
    duplicateLoadedFor.value = id;
  } finally {
    duplicateLoading.value = false;
  }
}
</script>

<template>
  <Drawer :open="open" title="发票详情" size="min(920px, 100vw)" @close="close">
    <template v-if="invoice && canUpdate" #extra>
      <a @click="emit('edit', invoice)">维护字段</a>
    </template>

    <Empty v-if="!invoice" description="请选择发票" />
    <Tabs
      v-else
      @change="(key) => key === 'duplicates' && loadDuplicateUsers()"
    >
      <TabPane key="summary" tab="发票信息">
        <Alert
          v-if="invoice.duplicate_user_count"
          banner
          class="mb-3"
          :message="
            canAdmin
              ? '该发票在其它用户中也出现过，可在重复用户页签核对。'
              : '该发票在其它用户中也出现过。'
          "
          type="warning"
        />
        <Descriptions bordered :column="2" size="small">
          <DescriptionsItem label="发票号">
            {{ invoice.invoice_no }}
          </DescriptionsItem>
          <DescriptionsItem label="发票类型">
            {{ invoice.invoice_type || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="开票日期">
            {{ invoice.invoice_date || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="价税合计">
            {{ invoice.amount_tax || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="销售方">
            {{ invoice.seller_name || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="销售方税号">
            {{ invoice.seller_credit_code || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="购买方">
            {{ invoice.buyer_name || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="购买方税号">
            {{ invoice.buyer_credit_code || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="税额">
            {{ invoice.tax_amount || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="税率">
            {{ invoice.tax_rate || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="上传用户">
            {{ invoice.uid }}
          </DescriptionsItem>
          <DescriptionsItem label="上传时间">
            {{ Times.formatOptionalUnix(invoice.uploaded_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="财务状态">
            <Tag :color="invoice.submitted_to_finance ? 'success' : 'warning'">
              {{ invoice.submitted_to_finance ? '已提交' : '未提交' }}
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="提交时间">
            {{ Times.formatOptionalUnix(invoice.submitted_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="来源文件">
            {{ invoice.original_file_name }}
          </DescriptionsItem>
          <DescriptionsItem label="解析来源">
            {{ invoice.parse_source || '-' }}
          </DescriptionsItem>
        </Descriptions>
      </TabPane>
      <TabPane :tab="`明细行 ${invoice.line_items.length}`" key="lines">
        <Table
          :columns="[
            { dataIndex: 'project_name', title: '项目', width: 180 },
            { dataIndex: 'specification', title: '规格', width: 140 },
            { dataIndex: 'quantity', title: '数量', width: 90 },
            { dataIndex: 'amount', title: '金额', width: 110 },
            { dataIndex: 'tax_rate', title: '税率', width: 90 },
            { dataIndex: 'tax_amount', title: '税额', width: 110 },
            { dataIndex: 'amount_tax', title: '价税合计', width: 120 },
          ]"
          :data-source="invoice.line_items"
          :pagination="false"
          row-key="project_name"
          size="small"
        />
      </TabPane>
      <TabPane
        v-if="canAdmin"
        :tab="`重复用户 ${invoice.duplicate_user_count}`"
        key="duplicates"
      >
        <Table
          :columns="[
            { dataIndex: 'uid', title: '用户 UID', width: 110 },
            { dataIndex: 'user_name', title: '用户', width: 160 },
            { dataIndex: 'original_file_name', title: '来源文件' },
            { dataIndex: 'uploaded_at', title: '上传时间', width: 180 },
            { dataIndex: 'submitted_to_finance', title: '财务', width: 100 },
          ]"
          :data-source="duplicateUsers"
          :loading="duplicateLoading"
          row-key="uid"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'uploaded_at'">
              {{
                Times.formatOptionalUnix(
                  (record as InvoiceDuplicateUserView).uploaded_at,
                )
              }}
            </template>
            <Tag
              v-else-if="column.dataIndex === 'submitted_to_finance'"
              :color="
                (record as InvoiceDuplicateUserView).submitted_to_finance
                  ? 'success'
                  : 'warning'
              "
            >
              {{
                (record as InvoiceDuplicateUserView).submitted_to_finance
                  ? '已提交'
                  : '未提交'
              }}
            </Tag>
          </template>
        </Table>
      </TabPane>
    </Tabs>
  </Drawer>
</template>
