<script setup lang="ts">
import type { CustomSource } from './custom-source';

import { createIconifyIcon, Plus } from '@vben/icons';

import { Button, FormItem, Input, Select, Tooltip } from 'antdv-next';
const source = defineModel<CustomSource>({ required: true });
const Trash = createIconifyIcon('lucide:trash-2');
</script>

<template>
  <div class="grid min-w-0 grid-cols-2 gap-x-3 max-sm:grid-cols-1">
    <FormItem label="官方安装文档" class="col-span-full" required>
      <Input
        v-model:value="source.documentation_url"
        placeholder="https://..."
      />
    </FormItem>
    <FormItem label="版本" required>
      <Input v-model:value="source.version" />
    </FormItem>
    <FormItem label="格式" required>
      <Select
        v-model:value="source.format"
        :options="[
          { label: '可执行二进制', value: 'binary' },
          { label: 'TAR 压缩包', value: 'tar' },
          { label: 'ZIP 压缩包', value: 'zip' },
        ]"
      />
    </FormItem>
    <FormItem label="官方下载地址" class="col-span-full" required>
      <Input v-model:value="source.url" placeholder="https://..." />
    </FormItem>
    <FormItem label="SHA-256" class="col-span-full" required>
      <Input v-model:value="source.sha256" />
    </FormItem>
    <FormItem label="平台">
      <Select
        v-model:value="source.platform"
        :options="[
          { label: 'Linux', value: 'linux' },
          { label: 'macOS', value: 'darwin' },
        ]"
      />
    </FormItem>
    <FormItem label="架构">
      <Select
        v-model:value="source.arch"
        :options="[
          { label: 'x86_64', value: 'x86_64' },
          { label: 'ARM64', value: 'aarch64' },
        ]"
      />
    </FormItem>
    <FormItem label="相对可执行文件路径" class="col-span-full" required>
      <Input v-model:value="source.executable" placeholder="bin/app" />
    </FormItem>
    <FormItem label="服务启动参数" class="col-span-full">
      <Select v-model:value="source.args" mode="tags" :token-separators="[]" />
    </FormItem>
    <div class="col-span-full mb-3 flex items-center justify-between">
      <h3>安装步骤</h3>
      <Button
        :disabled="source.install_steps.length >= 32"
        @click="
          source.install_steps.push({
            program: '',
            args: [],
            working_directory: '{release}',
          })
        "
      >
        <Plus class="size-4" />添加步骤
      </Button>
    </div>
    <div
      v-for="(step, index) in source.install_steps"
      :key="index"
      class="col-span-full mb-3 border-b pb-3"
    >
      <div class="mb-2 flex items-center justify-between">
        <span>步骤 {{ index + 1 }}</span><Tooltip title="删除步骤">
          <Button
            aria-label="删除步骤"
            @click="source.install_steps.splice(index, 1)"
          >
            <Trash class="size-4" />
          </Button>
        </Tooltip>
      </div>
      <FormItem label="程序" required>
        <Input v-model:value="step.program" placeholder="make" />
      </FormItem>
      <FormItem label="参数">
        <Select v-model:value="step.args" mode="tags" />
      </FormItem>
      <FormItem label="工作目录" required>
        <Input v-model:value="step.working_directory" placeholder="{release}" />
      </FormItem>
    </div>
  </div>
</template>
