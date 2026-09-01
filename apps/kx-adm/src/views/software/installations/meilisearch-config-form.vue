<script lang="ts" setup>
import type { MeilisearchInstallConfig } from '#/api/software';

import { computed } from 'vue';

import {
  Collapse,
  CollapsePanel,
  FormItem,
  Input,
  InputNumber,
  Select,
  Switch,
} from 'antdv-next';

const config = defineModel<MeilisearchInstallConfig>({ required: true });

const snapshotEnabled = computed({
  get: () => config.value.schedule_snapshot !== false,
  set: (enabled: boolean) => {
    config.value.schedule_snapshot = enabled ? 3600 : false;
  },
});
const snapshotInterval = computed({
  get: () =>
    typeof config.value.schedule_snapshot === 'number'
      ? config.value.schedule_snapshot
      : 3600,
  set: (value: null | number) => {
    config.value.schedule_snapshot = value && value > 0 ? value : 3600;
  },
});
</script>

<template>
  <div class="meili-config">
    <section>
      <h3>基础配置</h3>
      <div class="config-grid">
        <FormItem label="监听地址" required>
          <Input v-model:value="config.listen" placeholder="localhost" />
        </FormItem>
        <FormItem label="端口" required>
          <InputNumber
            v-model:value="config.port"
            class="w-full"
            :min="1"
            :max="65535"
          />
        </FormItem>
        <FormItem label="运行环境">
          <Select
            v-model:value="config.env"
            :options="[
              { label: 'development', value: 'development' },
              { label: 'production', value: 'production' },
            ]"
          />
        </FormItem>
        <FormItem label="日志级别">
          <Select
            v-model:value="config.log_level"
            :options="
              ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].map(
                (value) => ({ label: value, value }),
              )
            "
          />
        </FormItem>
        <FormItem label="数据库路径">
          <Input v-model:value="config.db_path" />
        </FormItem>
        <FormItem label="请求体上限">
          <Input v-model:value="config.http_payload_size_limit" />
        </FormItem>
      </div>
      <div class="toggle-row">
        <span>关闭匿名分析</span>
        <Switch v-model:checked="config.no_analytics" />
      </div>
    </section>

    <Collapse ghost>
      <CollapsePanel key="performance" header="索引性能">
        <div class="config-grid">
          <FormItem label="最大索引内存">
            <Input
              v-model:value="config.max_indexing_memory"
              allow-clear
              placeholder="未设置，例如 2 GiB"
            />
          </FormItem>
          <FormItem label="最大索引线程">
            <InputNumber
              v-model:value="config.max_indexing_threads"
              class="w-full"
              :min="1"
            />
          </FormItem>
        </div>
      </CollapsePanel>

      <CollapsePanel key="dump" header="Dump 与 Snapshot">
        <div class="config-grid">
          <FormItem label="Dump 目录">
            <Input v-model:value="config.dump_dir" />
          </FormItem>
          <FormItem label="导入 Dump 文件">
            <Input v-model:value="config.import_dump" allow-clear />
          </FormItem>
          <FormItem label="Snapshot 目录">
            <Input v-model:value="config.snapshot_dir" />
          </FormItem>
          <FormItem label="导入 Snapshot 文件">
            <Input v-model:value="config.import_snapshot" allow-clear />
          </FormItem>
        </div>
        <div class="toggle-grid">
          <label><span>忽略缺失 Dump</span><Switch v-model:checked="config.ignore_missing_dump" /></label>
          <label><span>已有数据库时忽略 Dump</span><Switch v-model:checked="config.ignore_dump_if_db_exists" /></label>
          <label><span>忽略缺失 Snapshot</span><Switch v-model:checked="config.ignore_missing_snapshot" /></label>
          <label><span>已有数据库时忽略 Snapshot</span><Switch v-model:checked="config.ignore_snapshot_if_db_exists" /></label>
          <label><span>定时 Snapshot</span><Switch v-model:checked="snapshotEnabled" /></label>
        </div>
        <FormItem
          v-if="snapshotEnabled"
          class="mt-3"
          label="Snapshot 间隔（秒）"
        >
          <InputNumber v-model:value="snapshotInterval" :min="1" />
        </FormItem>
      </CollapsePanel>

      <CollapsePanel key="ssl" header="SSL">
        <div class="config-grid">
          <FormItem label="客户端 CA 路径">
            <Input v-model:value="config.ssl_auth_path" allow-clear />
          </FormItem>
          <FormItem label="证书路径">
            <Input v-model:value="config.ssl_cert_path" allow-clear />
          </FormItem>
          <FormItem label="私钥路径">
            <Input v-model:value="config.ssl_key_path" allow-clear />
          </FormItem>
          <FormItem label="OCSP 路径">
            <Input v-model:value="config.ssl_ocsp_path" allow-clear />
          </FormItem>
        </div>
        <div class="toggle-grid">
          <label><span>强制客户端认证</span><Switch v-model:checked="config.ssl_require_auth" /></label>
          <label><span>SSL Session Resumption</span><Switch v-model:checked="config.ssl_resumption" /></label>
          <label><span>SSL Tickets</span><Switch v-model:checked="config.ssl_tickets" /></label>
        </div>
      </CollapsePanel>

      <CollapsePanel key="experimental" header="实验功能">
        <div class="toggle-grid">
          <label><span>Prometheus Metrics</span><Switch v-model:checked="config.experimental_enable_metrics" /></label>
          <label><span>降低索引内存</span><Switch
              v-model:checked="
                config.experimental_reduce_indexing_memory_usage
              "
          /></label>
        </div>
        <FormItem class="mt-3" label="单批最大任务数">
          <InputNumber
            v-model:value="config.experimental_max_number_of_batched_tasks"
            :min="1"
          />
        </FormItem>
      </CollapsePanel>
    </Collapse>
  </div>
</template>

<style scoped>
.meili-config {
  display: grid;
  gap: 12px;
}

.meili-config h3 {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
}

.config-grid,
.toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.toggle-row,
.toggle-grid label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
}

.toggle-row :deep(.ant-switch),
.toggle-grid :deep(.ant-switch) {
  width: fit-content;
  min-width: 44px;
}

@media (max-width: 640px) {
  .config-grid,
  .toggle-grid {
    grid-template-columns: 1fr;
  }
}
</style>
