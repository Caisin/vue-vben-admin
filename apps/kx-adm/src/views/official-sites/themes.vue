<script setup lang="ts">
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Col, Modal, Row, Tag } from 'antdv-next';

import { layouts, themes } from './style-options';

const previewTheme = ref<(typeof themes)[number]>();
const previewOpen = ref(false);
function openPreview(theme: (typeof themes)[number]) {
  previewTheme.value = theme;
  previewOpen.value = true;
}
</script>

<template>
  <Page auto-content-height title="主题示例">
    <p class="mb-4 text-muted-foreground">
      官网主题与推荐排版示例，配置官网时可直接选择。
    </p>
    <Card class="mb-4" title="模板预览">
      <p>
        以下示例由官网模板渲染器生成，点击主题卡片会在系统内打开独立预览页面。
      </p>
    </Card>
    <Row :gutter="[16, 16]">
      <Col v-for="theme in themes" :key="theme.value" :span="8">
        <Card :title="theme.label" hoverable>
          <div
            class="mb-3 h-24 rounded-lg"
            :style="{
              background: theme.color,
              border: `4px solid ${theme.accent}`,
            }"
          >
            <div
              class="flex h-full items-center justify-center text-2xl font-bold"
              :style="{ color: theme.accent }"
            >
              {{ theme.sample }}
            </div>
          </div>
          <div>{{ theme.detail }}</div>
          <Tag class="mt-2">
            {{ layouts.find((layout) => layout.value === theme.layout)?.label }}
          </Tag>
          <Button class="mt-3" type="link" @click="openPreview(theme)">
            打开预览
          </Button>
        </Card>
      </Col>
    </Row>
    <Modal
      v-model:open="previewOpen"
      :footer="null"
      :title="previewTheme ? `${previewTheme.label} · 临时预览` : '临时预览'"
      width="1100"
    >
      <div
        v-if="previewTheme"
        class="min-h-[620px] rounded-xl p-10"
        :style="{ background: previewTheme.color, color: previewTheme.accent }"
      >
        <iframe
          :src="`/_official/theme/${previewTheme.value}-${previewTheme.layout}/index.html`"
          :title="`${previewTheme.label}预览`"
          class="h-[620px] w-full rounded-xl border-0"
        >
        </iframe>
        <p class="text-sm uppercase tracking-[0.3em]">
          {{ previewTheme.detail }}
        </p>
        <h2 class="mt-10 text-4xl md:text-7xl font-bold">
          {{ previewTheme.sample }}
        </h2>
        <p class="mt-5 text-xl">
          {{
            layouts.find((item) => item.value === previewTheme?.layout)?.detail
          }}
        </p>
        <div class="mt-20 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            v-for="item in ['应用介绍', '功能亮点', '立即下载']"
            :key="item"
            class="rounded-2xl border border-current/30 p-8 text-2xl"
          >
            {{ item }}
          </div>
        </div>
      </div>
    </Modal>
  </Page>
</template>
