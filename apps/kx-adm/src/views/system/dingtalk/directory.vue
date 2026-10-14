<script setup lang="ts">
import type { RawDepartment, RawMember } from '#/api/system/dingtalk-directory';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  TreeSelect,
} from 'antdv-next';

import { DingtalkDirectoryApi as api } from '#/api/system/dingtalk-directory';
import { requestErrorMessage } from '#/request-errors';

import { organizationOptions } from './organization';
const sources = ref<{ code: string; name: string }[]>([]);
const source = ref<string>();
const departments = ref<RawDepartment[]>([]);
const members = ref<RawMember[]>([]);
const selected = ref<string>();
const children = ref(true);
const keyword = ref('');
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const errorText = ref('');
const detail = ref<{ title: string; raw: unknown }>();
let generation = 0;
const tree = computed(() => organizationOptions(departments.value));
const columns = [
  { title: '姓名', dataIndex: 'name' },
  { title: '钉钉员工ID', dataIndex: 'id' },
  { title: '所属部门', key: 'departments' },
  { title: '最近同步', key: 'synced' },
  { title: '操作', key: 'actions' },
];
async function loadMembers(reset = true) {
  if (!source.value) return;
  const ticket = ++generation;
  if (reset) page.value = 1;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await api.members({
      source_id: source.value,
      department_id: selected.value,
      include_children: children.value,
      keyword: keyword.value.trim() || undefined,
      page: page.value,
      size: 50,
    });
    if (ticket === generation) {
      members.value = result.items;
      total.value = result.total;
    }
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取钉钉成员失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
async function changeSource() {
  const ticket = ++generation;
  selected.value = undefined;
  departments.value = [];
  members.value = [];
  total.value = 0;
  detail.value = undefined;
  errorText.value = '';
  if (!source.value) return;
  loading.value = true;
  try {
    const rows = await api.departments(source.value);
    if (ticket !== generation) return;
    departments.value = rows;
    await loadMembers();
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取原始组织失败');
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
onMounted(initialize);
onBeforeUnmount(() => generation++);
</script>
<template>
  <Page
    title="钉钉原始组织信息"
    description="查看最近同步保存的钉钉部门和成员原始快照；不受系统本地部门编辑影响。"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-4" />
    <div class="mb-4 flex flex-wrap gap-3">
      <Select
        v-model:value="source"
        aria-label="钉钉公司"
        class="w-72"
        :options="sources.map((s) => ({ label: s.name, value: s.code }))"
        @change="changeSource"
      />
      <Button
        :loading="loading"
        @click="source ? changeSource() : initialize()"
      >
        刷新组织
      </Button>
    </div>
    <Empty
      v-if="!source && !loading"
      description="没有可查看的钉钉公司，请联系管理员配置公司数据权限并同步组织。"
    />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <TreeSelect
          v-model:value="selected"
          class="w-80"
          aria-label="钉钉部门"
          :tree-data="tree"
          tree-node-filter-prop="title"
          show-search
          allow-clear
          placeholder="全部公司成员"
          @change="loadMembers()"
        />
        <Checkbox v-model:checked="children" @change="loadMembers()">
          包含子部门
        </Checkbox>
        <Input
          v-model:value="keyword"
          class="!w-64"
          placeholder="姓名或钉钉员工ID"
          @press-enter="loadMembers()"
        />
        <Button @click="loadMembers()">查询成员</Button>
        <Button
          v-if="selected"
          @click="
            detail = {
              title: '部门原始快照',
              raw: departments.find((d) => d.id === selected)?.raw,
            }
          "
        >
          查看部门原始信息
        </Button>
      </div>
      <p class="mb-3 text-sm text-muted-foreground">
        {{ departments.length }} 个已同步部门，其中
        {{ departments.filter((d) => !d.active).length }}
        个已失效；当前只查询在职成员。
      </p>
      <details class="mb-4 rounded border p-3">
        <summary class="cursor-pointer">全部原始部门（含失效部门）</summary>
        <Table
          :data-source="departments"
          row-key="id"
          :pagination="{ pageSize: 20 }"
          :columns="[
            { title: '部门名称', dataIndex: 'name' },
            { title: '钉钉部门ID', dataIndex: 'id' },
            { title: '上级部门ID', dataIndex: 'parent_id' },
            { title: '状态', key: 'status' },
            { title: '操作', key: 'raw' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Tag v-if="column.key === 'status'">
              {{ record.active ? '有效' : '已失效' }}
            </Tag>
            <Button
              v-if="column.key === 'raw'"
              type="link"
              @click="
                detail = {
                  title: `${record.name} · 部门原始信息`,
                  raw: record.raw,
                }
              "
            >
              查看原始信息
            </Button>
          </template>
        </Table>
      </details>
      <Table
        :columns="columns"
        :data-source="members"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: page,
          pageSize: 50,
          total,
          showSizeChanger: false,
        }"
        @change="
          (p: any) => {
            page = p.current;
            loadMembers(false);
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'departments'">
            <Tag v-for="id in record.departments" :key="id">
              {{ departments.find((d) => d.id === id)?.name ?? id }}
            </Tag>
          </template>
          <template v-if="column.key === 'synced'">
            {{ new Date(record.synced_at * 1000).toLocaleString() }}
          </template>
          <Button
            v-if="column.key === 'actions'"
            type="link"
            @click="
              detail = { title: `${record.name} · 原始信息`, raw: record.raw }
            "
          >
            查看原始信息
          </Button>
        </template>
      </Table>
      <section
        v-if="detail"
        class="mt-5 rounded-lg border p-4"
        aria-label="钉钉原始信息"
      >
        <div class="mb-3 flex justify-between">
          <h3>{{ detail.title }}</h3>
          <Button @click="detail = undefined">收起</Button>
        </div>
        <pre class="max-h-96 overflow-auto whitespace-pre-wrap break-all">{{
          JSON.stringify(detail.raw, null, 2)
        }}</pre>
      </section>
    </template>
  </Page>
</template>
