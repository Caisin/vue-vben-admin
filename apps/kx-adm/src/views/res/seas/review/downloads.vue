<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Checkbox, Empty, Spin, Tag } from 'antdv-next';

import { requestClient } from '#/api/request';
import { desktop, desktopDownloads } from '#/desktop';
import { requestErrorMessage } from '#/request-errors';
interface Package {
  scope: number;
  version: number;
  name: string;
  version_name: string;
  modules: string[];
  files: { file_id: number; name: string; kind: string; seq_no: number }[];
}
const rows = ref<Package[]>([]);
const selected = ref<Record<string, number[]>>({});
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const success = ref('');
const labels: Record<string, string> = {
  film: '成片',
  clean: '无字幕版',
  silent: '无音乐版',
  prompt: '提示词',
  project_image: '工程截图',
  poster: '海报',
  synopsis: '剧本简介',
  srt: 'SRT',
  demo: 'DEMO',
  youtube: 'YouTube',
};
async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Package[]>(
      '/adm/res/delivery-downloads',
    );
    selected.value = {};
  } catch (error) {
    errorText.value = requestErrorMessage(error, '加载下载授权失败');
  } finally {
    loading.value = false;
  }
}
async function download(row: Package) {
  busy.value = true;
  errorText.value = '';
  try {
    const ids = selected.value[String(row.version)] ?? [];
    const dir = await desktopDownloads.pickDirectory();
    if (dir) {
      await desktopDownloads.add(row.scope, row.version, ids, dir);
      success.value = '已加入客户端下载队列，请在下载中心查看进度。';
    }
  } catch (error) {
    errorText.value = requestErrorMessage(error, '下载失败，请核对最新授权');
  } finally {
    busy.value = false;
  }
}
function toggle(row: Package, id: number, checked: boolean) {
  const key = String(row.version);
  const ids = selected.value[key] ?? [];
  selected.value[key] = checked
    ? [...new Set([...ids, id])]
    : ids.filter((v) => v !== id);
}
onMounted(load);
</script>
<template>
  <Page
    title="交付下载"
    description="仅显示当前授权版本、材料模块和集数；更换版本需负责人重新授权。"
  >
    <div class="rounded-xl bg-background p-6">
      <Alert
        v-if="!desktop"
        type="info"
        message="请在 Tauri 客户端打开本页下载。网页可以查看授权范围。"
        class="mb-4"
      /><Alert
        v-if="errorText"
        type="error"
        :message="errorText"
        class="mb-3"
      /><Alert
        v-if="success"
        type="success"
        :message="success"
        class="mb-3"
      /><Button :loading="loading" :disabled="busy" @click="load">
        刷新授权
</Button><Spin :spinning="loading">
        <section
          v-for="row in rows"
          :key="row.version"
          class="mt-5 rounded-xl border p-5"
        >
          <h3 class="mb-3 text-lg font-semibold">
            {{ row.name }} · {{ row.version_name }}
          </h3>
          <Tag v-for="kind in row.modules" :key="kind">
            {{ labels[kind] || kind }}
          </Tag>
          <div class="my-4">
            <Button
              :disabled="busy"
              @click="
                selected[String(row.version)] = [
                  ...new Set(row.files.map((f) => f.file_id)),
                ]
              "
            >
              选择全部授权文件（每批最多1000）
</Button><Button
              class="ml-2"
              :disabled="busy"
              @click="selected[String(row.version)] = []"
            >
              清空
            </Button>
          </div>
          <div
            v-for="file in row.files"
            :key="`${file.kind}/${file.seq_no}/${file.file_id}`"
            class="mb-2"
          >
            <Checkbox
              :disabled="busy"
              :checked="selected[String(row.version)]?.includes(file.file_id)"
              @change="(e: any) => toggle(row, file.file_id, e.target.checked)"
            >
              {{ labels[file.kind] }} ·
              {{ file.seq_no ? `第${file.seq_no}集` : '作品级' }} ·
              {{ file.name }}
            </Checkbox>
          </div>
          <Button
            class="mt-3"
            type="primary"
            :loading="busy"
            :disabled="
              !desktop ||
              !selected[String(row.version)]?.length ||
              (selected[String(row.version)]?.length || 0) > 1000
            "
            @click="download(row)"
          >
            选择本地目录并下载
          </Button>
        </section>
        <Empty
          v-if="!loading && !rows.length"
          description="没有生效的交付下载授权，请让负责人选择版本、材料模块并授权。"
        />
      </Spin>
    </div>
  </Page>
</template>
