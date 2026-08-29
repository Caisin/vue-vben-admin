<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';

type ReportRow = Record<string, any>;

export interface ReportColumn {
  dataIndex?: string;
  key: string;
  title: string;
  width?: number;
}

export interface ReportFilter {
  field: string;
  label: string;
  placeholder?: string;
  type?: 'date' | 'number' | 'text';
}

const props = withDefaults(
  defineProps<{
    columns?: ReportColumn[];
    dateField?: string;
    defaultDate?: string;
    fetchList: (params: Record<string, any>) => Promise<any>;
    fetchTotal?: (params: Record<string, any>) => Promise<any>;
    filters?: ReportFilter[];
    postCost?: (params: Record<string, any>) => Promise<any>;
    rowKey?: string;
    title: string;
  }>(),
  {
    columns: () => [],
    dateField: 'stat_day',
    defaultDate: '',
    fetchTotal: undefined,
    filters: () => [],
    postCost: undefined,
    rowKey: 'id',
  },
);

const totalLoading = ref(false);
const savingCost = ref(false);
const summary = ref<null | ReportRow>(null);
const detailOpen = ref(false);
const detailRecord = ref<null | ReportRow>(null);
const costOpen = ref(false);
let latestQuery: Record<string, any> = { page: 1, size: 20 };
const costForm = reactive({
  link_id: undefined as number | string | undefined,
  stat_cost: 0,
  stat_day: '',
});

const summaryItems = computed(() => {
  if (!summary.value) return [];
  return Object.entries(summary.value).filter(
    ([, value]) => typeof value !== 'object',
  );
});

function inferColumns(row: ReportRow): ReportColumn[] {
  return Object.keys(row)
    .filter((key) => typeof row[key] !== 'object')
    .slice(0, 16)
    .map((key) => ({ key, title: labelOf(key), width: 120 }));
}

function labelOf(key: string) {
  const labels: Record<string, string> = {
    ad_count: '广告唤起量',
    ad_id: '广告ID',
    ad_name: '广告名称',
    ad_platform: '广告平台',
    campaign_id: '广告系列ID',
    campaign_name: '广告系列名称',
    click_count: '点击',
    complete_count: '完播',
    in_link_day: '进链日期',
    link_id: '链接ID',
    pay_amount: '付费金额',
    pay_num: '笔数',
    pay_user_num: '付费人数',
    res_id: '资源ID',
    res_name: '资源名称',
    show_count: '展示',
    stat_cost: '消耗',
    stat_day: '日期',
    total_amount: '充值金额',
    uid: 'UID',
    user_count: '用户数',
  };
  return labels[key] ?? key;
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: `${labelOf(props.dateField)}，如 20260823 / 2026-08-23`,
      },
      defaultValue: props.defaultDate || undefined,
      fieldName: props.dateField,
      label: labelOf(props.dateField),
    },
    ...props.filters.map((filter) => ({
      component: filter.type === 'number' ? 'InputNumber' : 'Input',
      componentProps: {
        allowClear: true,
        placeholder: filter.placeholder ?? filter.label,
      },
      fieldName: filter.field,
      label: filter.label,
    })),
  ] as VbenFormSchema[];
}

function useColumns(): VxeTableGridColumns {
  const configured =
    props.columns.length > 0 ? props.columns : inferColumns({});
  return [
    ...configured.map((column) => ({
      field: column.dataIndex ?? column.key,
      minWidth: column.width ?? 120,
      showOverflow: 'tooltip' as const,
      slots: { default: 'value' },
      title: column.title,
    })),
    {
      align: 'right' as const,
      field: '__operation',
      fixed: 'right' as const,
      headerAlign: 'center' as const,
      slots: { default: 'operation' },
      title: '操作',
      width: props.postCost ? 140 : 90,
    },
  ];
}

const [Grid, gridApi] = useVbenVxeGrid<ReportRow>({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          latestQuery = {
            page: page.currentPage,
            size: page.pageSize,
            ...Object.fromEntries(
              Object.entries(formValues).filter(
                ([, value]) =>
                  value !== undefined && value !== null && value !== '',
              ),
            ),
          };
          const payload = await props.fetchList(latestQuery);
          if (props.fetchTotal) await loadTotal(latestQuery);
          const source = Array.isArray(payload)
            ? payload
            : (payload?.items ?? []);
          const items = source.map((row: ReportRow, index: number) => ({
            ...row,
            __rowKey:
              row[props.rowKey] ??
              row.id ??
              `${row.stat_day ?? row.in_link_day ?? page.currentPage}-${index}`,
          }));
          return {
            items,
            total: Number(payload?.total ?? items.length),
          };
        },
      },
    },
    rowConfig: { keyField: '__rowKey' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ReportRow>,
});

async function loadTotal(params: Record<string, any>) {
  if (!props.fetchTotal) return;
  totalLoading.value = true;
  try {
    summary.value = await props.fetchTotal(params);
  } finally {
    totalLoading.value = false;
  }
}

function openDetail(record: ReportRow) {
  detailRecord.value = record;
  detailOpen.value = true;
}

function openCost(record: ReportRow) {
  costForm.stat_cost = Number(record.stat_cost ?? 0);
  costForm.stat_day = String(
    record.in_link_day ?? record.stat_day ?? latestQuery[props.dateField] ?? '',
  );
  costForm.link_id = record.link_id;
  costOpen.value = true;
}

async function submitCost() {
  if (!props.postCost) return;
  if (!costForm.stat_day) {
    message.warning('请先填写日期');
    return;
  }
  savingCost.value = true;
  try {
    const payload: Record<string, any> = { stat_cost: costForm.stat_cost };
    if (costForm.link_id !== undefined && costForm.link_id !== '') {
      payload.link_id = costForm.link_id;
      payload.in_link_day = costForm.stat_day;
    } else {
      payload.stat_day = costForm.stat_day;
    }
    await props.postCost(payload);
    costOpen.value = false;
    message.success('成本已保存');
    await gridApi.query();
  } finally {
    savingCost.value = false;
  }
}

function valueAt(record: ReportRow, key?: string) {
  if (!key) return undefined;
  let value: any = record;
  for (const part of key.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

function formatValue(key: string, value: any, record: ReportRow) {
  if (value === undefined || value === null || value === '') return '-';
  const number = Number(value);
  if (
    (key.includes('roi') || key.toLowerCase() === 'roi') &&
    !Number.isNaN(number)
  ) {
    return `${(number <= 10 ? number * 100 : number).toFixed(2)}%`;
  }
  if (key.includes('rate') && !Number.isNaN(number)) {
    return `${(number <= 1 ? number * 100 : number).toFixed(2)}%`;
  }
  if (
    (key.includes('amount') ||
      key.includes('cost') ||
      key.includes('income')) &&
    !Number.isNaN(number)
  ) {
    return `$${number.toFixed(2)}`;
  }
  if ((key === 'click_rate' || key === 'complete_rate') && record.show_count) {
    const base = Number(record.show_count);
    if (base > 0) return `${((Number(value) / base) * 100).toFixed(2)}%`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    :title="title"
  >
    <div v-if="summaryItems.length > 0" class="mb-3 rounded border bg-card p-3">
      <Descriptions bordered :column="4" :loading="totalLoading" size="small">
        <DescriptionsItem
          v-for="[key, value] in summaryItems"
          :key="key"
          :label="labelOf(key)"
        >
          {{ formatValue(key, value, summary ?? {}) }}
        </DescriptionsItem>
      </Descriptions>
    </div>

    <Grid class="management-grid" :table-title="title">
      <template #value="{ row, column }">
        <Tag
          v-if="
            String(column.field).includes('roi') ||
            String(column.field).includes('rate')
          "
          color="blue"
        >
          {{
            formatValue(
              String(column.field),
              valueAt(row, String(column.field)),
              row,
            )
          }}
        </Tag>
        <template v-else>
          {{
            formatValue(
              String(column.field),
              valueAt(row, String(column.field)),
              row,
            )
          }}
        </template>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:eye',
              onClick: () => openDetail(row),
              text: '明细',
            },
            ...(postCost
              ? [
                  {
                    icon: 'lucide:badge-dollar-sign',
                    onClick: () => openCost(row),
                    text: '成本',
                  },
                ]
              : []),
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="detailOpen"
      :footer="null"
      :title="`${title}明细`"
      width="820px"
    >
      <pre class="max-h-[65vh] overflow-auto whitespace-pre-wrap">{{
        JSON.stringify(detailRecord, null, 2)
      }}</pre>
    </Modal>

    <Modal
      v-model:open="costOpen"
      :confirm-loading="savingCost"
      title="编辑消耗成本"
      width="460px"
      @ok="submitCost"
    >
      <Form :label-col="{ span: 6 }" :model="costForm">
        <FormItem v-if="costForm.link_id" label="链接ID">
          <Input v-model:value="costForm.link_id" disabled />
        </FormItem>
        <FormItem label="日期" required>
          <Input v-model:value="costForm.stat_day" />
        </FormItem>
        <FormItem label="消耗($)" required>
          <InputNumber
            v-model:value="costForm.stat_cost"
            class="w-full"
            :min="0"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
