<script setup lang="ts">
import { computed } from 'vue';

import { Alert } from 'antdv-next';

import { recoveryAdvice } from './operation-data';
const props = defineProps<{ code?: null | string; message?: null | string }>();
const explanations: Record<string, string> = {
  data_sync_databend_connect_failed:
    '无法连接Databend，请检查目标服务、网络和账号权限。',
  data_sync_databend_connect_timeout:
    '连接Databend超时，请检查目标服务与网络。',
  data_sync_databend_read_failed:
    'Databend查询失败，使用下方查询编号和服务端错误码核对目标查询日志。',
  data_sync_databend_read_timeout:
    'Databend查询超时，请检查计算仓库负载和查询耗时。',
  data_sync_databend_write_failed:
    'Databend写入失败，须先核对回执。下方保留服务端错误码和查询编号。',
  data_sync_databend_write_timeout:
    'Databend写入超时，提交结果尚未确认，请先回执对账。',
  data_sync_databend_csv_load_failed:
    'CSV批量加载失败，请检查目标字段类型、存储和仓库资源；先核对回执再续传。',
  data_sync_databend_csv_load_timeout:
    'CSV批量加载超时，请检查仓库资源并核对回执。',
  data_sync_databend_upload_failed:
    '上传批次到Databend Stage失败，请检查网络及目标存储。',
  data_sync_source_query_failed:
    '源数据库读取失败，请检查源表权限、字段类型和数据库日志。',
  data_sync_source_query_timeout:
    '源数据库读取超过时限，请检查索引、查询负载及批次大小。',
  data_sync_execution_failed:
    '旧记录仅保存了通用错误码，无法还原当时的底层错误。请核对该次运行及批次查询编号；更新后新失败将保留安全诊断。',
  data_sync_pending_batches:
    '本次同步已停止，仍有未确认批次。先回执对账，再恢复调度并续传。',
  data_sync_database_tables_failed:
    '部分表处理失败，请查看失败运行定位具体目标表和批次。',
};
const description = computed(
  () =>
    explanations[props.code ?? ''] ??
    recoveryAdvice[props.code ?? ''] ??
    props.code ??
    '',
);
</script>
<template>
  <Alert v-if="code" type="error" show-icon class="mb-3" :message="description">
    <template #description>
      <div class="break-all text-xs">错误码：{{ code }}</div>
      <div
        v-if="message && message !== code"
        class="whitespace-pre-wrap break-all"
      >
        {{ message }}
      </div>
    </template>
  </Alert>
</template>
