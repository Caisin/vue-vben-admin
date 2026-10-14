<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type {
  AttendanceRecord,
  AttendanceView,
  RawDepartment,
} from '#/api/system/dingtalk-directory';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Select,
  Table,
  TreeSelect,
} from 'antdv-next';
import dayjs from 'dayjs';

import { DingtalkDirectoryApi as api } from '#/api/system/dingtalk-directory';
import { requestErrorMessage } from '#/request-errors';

import {
  attendanceLabel,
  attendanceTime,
  organizationOptions,
} from './organization';
const { hasAccessByCodes } = useAccess();
const sources = ref<{ code: string; name: string }[]>([]);
const source = ref<string>();
const department = ref<string>();
const departments = ref<RawDepartment[]>([]);
const children = ref(true);
const dates = ref<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()]);
const jobs = ref<AttendanceView[]>([]);
const selected = ref<AttendanceView>();
const records = ref<AttendanceRecord[]>([]);
const total = ref(0);
const page = ref(1);
const historyPage = ref(1);
const historyTotal = ref(0);
const loading = ref(false);
const submitting = ref(false);
const downloading = ref(false);
const errorText = ref('');
const ready = ref(false);
const tree = computed(() => organizationOptions(departments.value));
let generation = 0;
let recordGeneration = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let alive = true;
const pending = (j: AttendanceView) => ['pending', 'running'].includes(j.state);
function stop() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}
async function loadRecords(job: AttendanceView, p = 1) {
  const ticket = ++recordGeneration;
  selected.value = job;
  page.value = p;
  records.value = [];
  total.value = 0;
  if (job.state !== 'succeeded') return;
  try {
    const result = await api.records(job.id, p);
    if (alive && ticket === recordGeneration) {
      records.value = result.items;
      total.value = result.total;
    }
  } catch (error) {
    if (ticket === recordGeneration)
      errorText.value = requestErrorMessage(error, '读取考勤结果失败');
  }
}
async function refresh() {
  if (!source.value) return;
  const ticket = generation;
  const key = source.value;
  try {
    const result = await api.history(key, historyPage.value);
    if (!alive || ticket !== generation) return;
    jobs.value = result.items;
    historyTotal.value = result.total;
    if (selected.value) {
      const current = jobs.value.find(
        (j) => String(j.id) === String(selected.value?.id),
      );
      if (current) {
        const finished =
          selected.value.state !== 'succeeded' && current.state === 'succeeded';
        selected.value = current;
        if (finished) await loadRecords(current);
      }
    }
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取查询进度失败');
  } finally {
    if (alive && ticket === generation && jobs.value.some(pending)) {
      stop();
      timer = setTimeout(() => void refresh(), 2000);
    }
  }
}
async function changeSource() {
  stop();
  generation++;
  recordGeneration++;
  jobs.value = [];
  selected.value = undefined;
  records.value = [];
  total.value = 0;
  department.value = undefined;
  departments.value = [];
  ready.value = false;
  historyPage.value = 1;
  errorText.value = '';
  if (!source.value) return;
  const ticket = generation;
  loading.value = true;
  try {
    const rows = await api.departments(source.value);
    if (ticket !== generation) return;
    departments.value = rows;
    ready.value = true;
    await refresh();
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取组织失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
async function initialize() {
  try {
    const result = await api.sources();
    sources.value = result.map((s) => ({
      ...s,
      code: s.code.replace(/^dingtalk:/, ''),
    }));
    source.value = sources.value[0]?.code;
    await changeSource();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取公司列表失败');
  }
}
async function submit() {
  if (submitting.value || !ready.value || !source.value) return;
  errorText.value = '';
  const [from, to] = dates.value ?? [];
  if (!from || !to || to.diff(from, 'day') < 0 || to.diff(from, 'day') >= 31) {
    errorText.value = '请选择1至31天的日期范围';
    return;
  }
  submitting.value = true;
  const ticket = generation;
  try {
    const job = await api.create({
      source_id: source.value,
      department_id: department.value,
      include_children: children.value,
      date_from: from.format('YYYY-MM-DD'),
      date_to: to.format('YYYY-MM-DD'),
    });
    if (ticket !== generation) return;
    selected.value = job;
    records.value = [];
    total.value = 0;
    historyPage.value = 1;
    if (job.state === 'succeeded') await loadRecords(job);
    await refresh();
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '提交考勤查询失败');
  } finally {
    submitting.value = false;
  }
}
async function download() {
  const job = selected.value;
  if (!job || downloading.value) return;
  const ticket = generation;
  downloading.value = true;
  try {
    const blob = await api.download(job.id);
    if (alive && ticket === generation)
      downloadFileFromBlob({
        source: blob,
        fileName: `考勤-${job.request.date_from}-${job.request.date_to}.xlsx`,
      });
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '下载考勤失败');
  } finally {
    downloading.value = false;
  }
}
const labels: Record<string, string> = {
  pending: '等待查询',
  running: '查询中',
  succeeded: '已完成',
  failed: '失败',
};
const recordColumns = [
  { title: '姓名', dataIndex: 'userName' },
  { title: '钉钉员工ID', dataIndex: 'userId' },
  { title: '工作日', key: 'workDate' },
  { title: '类型', key: 'checkType' },
  { title: '应打卡', key: 'baseCheckTime' },
  { title: '实际打卡', key: 'userCheckTime' },
  { title: '时间结果', key: 'timeResult' },
  { title: '位置结果', key: 'locationResult' },
];
onMounted(initialize);
onBeforeUnmount(() => {
  alive = false;
  generation++;
  recordGeneration++;
  stop();
});
</script>
<template>
  <Page
    title="组织考勤"
    description="按北京时间查询钉钉排班打卡结果，完成后可查看和下载 Excel。"
  >
    <Alert
      type="info"
      message="需为钉钉应用开通“查询企业考勤数据”权限。支持最近半年内1–31天、最多1000名已同步成员；按钉钉限制自动分批查询。未返回打卡结果不代表缺勤。"
      class="mb-4"
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-4" />
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <Select
        v-model:value="source"
        :disabled="submitting"
        aria-label="钉钉公司"
        class="w-72"
        :options="sources.map((s) => ({ label: s.name, value: s.code }))"
        @change="changeSource"
      />
      <TreeSelect
        v-model:value="department"
        aria-label="钉钉部门"
        class="w-72"
        :tree-data="tree"
        :disabled="!ready || submitting"
        tree-node-filter-prop="title"
        allow-clear
        show-search
        placeholder="整家公司"
      />
      <Checkbox v-model:checked="children">包含子部门</Checkbox>
      <DatePicker.RangePicker
        v-model:value="dates"
        :allow-clear="false"
        :disabled-date="
          (d: Dayjs) =>
            d.isAfter(dayjs(), 'day') ||
            d.isBefore(dayjs().subtract(6, 'month'), 'day')
        "
      />
      <Button
        v-if="hasAccessByCodes(['api:auth.dingtalk.attendance.query'])"
        type="primary"
        :disabled="!ready"
        :loading="submitting"
        @click="submit"
      >
        查询考勤
      </Button>
      <Button
        :loading="loading"
        @click="source ? changeSource() : initialize()"
      >
        刷新组织与记录
      </Button>
    </div>
    <Empty
      v-if="!source"
      description="没有已授权的钉钉公司，请先同步组织并配置公司数据权限。"
    />
    <template v-else>
      <Table
        row-key="id"
        :data-source="jobs"
        :pagination="{
          current: historyPage,
          pageSize: 20,
          total: historyTotal,
          showSizeChanger: false,
        }"
        :columns="[
          { title: '查询时间', key: 'created' },
          { title: '日期范围', key: 'dates' },
          { title: '组织', key: 'org' },
          { title: '状态', key: 'state' },
          { title: '人数 / 结果数', key: 'counts' },
          { title: '操作', key: 'actions' },
        ]"
        @change="
          (p: any) => {
            historyPage = p.current;
            refresh();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created'">
            {{ new Date(record.created_at * 1000).toLocaleString() }}
          </template>
          <template v-if="column.key === 'dates'">
            {{ record.request.date_from }} ～ {{ record.request.date_to }}
          </template>
          <template v-if="column.key === 'org'">
            {{
              departments.find((d) => d.id === record.request.department_id)
                ?.name ??
              (record.request.department_id || '整家公司')
            }}
          </template>
          <template v-if="column.key === 'state'">
            {{ labels[record.state] ?? record.state }}
            <span v-if="pending(record)">
              {{ record.completed }} / {{ record.total }}
            </span>
          </template>
          <template v-if="column.key === 'counts'">
            {{ record.member_count }} 人 / {{ record.record_count }} 条
          </template>
          <Button
            v-if="column.key === 'actions'"
            type="link"
            @click="loadRecords(record)"
          >
            查看结果
          </Button>
        </template>
      </Table>
      <section v-if="selected" class="mt-5 rounded-lg border p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3>
            {{ selected.request.date_from }} ～ {{ selected.request.date_to }} ·
            {{ labels[selected.state] }}
          </h3>
          <Button
            v-if="hasAccessByCodes(['api:auth.dingtalk.attendance.download'])"
            :disabled="selected.state !== 'succeeded'"
            :loading="downloading"
            @click="download"
          >
            下载 Excel
          </Button>
        </div>
        <Alert
          v-if="selected.error"
          type="error"
          :message="selected.error"
          class="mb-3"
        />
        <p v-if="pending(selected)">
          正在后台查询，完成后自动显示结果。关闭页面后可从查询历史继续查看。
        </p>
        <template v-if="selected.state === 'succeeded'">
          <p class="mb-3">
            {{ selected.member_count }} 名成员，{{ selected.record_count }}
            条打卡结果。Excel 同时包含查询成员清单。
          </p>
          <Table
            :columns="recordColumns"
            :data-source="records"
            row-key="id"
            :scroll="{ x: 1100 }"
            :pagination="{
              current: page,
              pageSize: 50,
              total,
              showSizeChanger: false,
            }"
            @change="(p: any) => selected && loadRecords(selected, p.current)"
          >
            <template #bodyCell="{ column, record }">
              <template
                v-if="
                  ['workDate', 'baseCheckTime', 'userCheckTime'].includes(
                    String(column.key),
                  )
                "
              >
                {{
                  attendanceTime(
                    Number(
                      record[String(column.key) as keyof AttendanceRecord],
                    ),
                  )
                }}
              </template>
              <template
                v-else-if="
                  ['checkType', 'timeResult', 'locationResult'].includes(
                    String(column.key),
                  )
                "
              >
                {{
                  attendanceLabel(
                    String(
                      record[String(column.key) as keyof AttendanceRecord],
                    ),
                  )
                }}
              </template>
            </template>
          </Table>
        </template>
      </section>
    </template>
  </Page>
</template>
