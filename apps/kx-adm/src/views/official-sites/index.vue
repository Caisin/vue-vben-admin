<script setup lang="ts">
import type {
  Site,
  SiteBuild,
  SiteConfig,
  SiteWrite,
} from '#/api/official-sites';

import { computed, onMounted, ref, toRaw } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Select,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { OfficialSitesApi, siteResourceUrl } from '#/api/official-sites';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import ImageField from './image-field.vue';
import { layouts, themes } from './style-options';

const { hasAccessByCodes } = useAccess();
const manage = computed(() => hasAccessByCodes(['official-site:manage']));
const canPreview = computed(() => hasAccessByCodes(['official-site:preview']));
const canPublish = computed(() => hasAccessByCodes(['official-site:publish']));
const canExport = computed(() => hasAccessByCodes(['official-site:export']));
const rows = ref<Site[]>([]);
const keyword = ref('');
const busy = ref(false);
const errorText = ref('');
const page = ref(1);
const total = ref(0);
const editorOpen = ref(false);
const selected = ref<Site>();
const form = ref<SiteWrite>();
const defaults = ref<SiteWrite>();
const domainsText = ref('');
const tab = ref('basic');
const progressOpen = ref(false);
const build = ref<SiteBuild>();
const history = ref<SiteBuild[]>([]);
const historyOpen = ref(false);
const previewOpen = ref(false);
const previewWidth = ref('100%');
const doneId = ref<number>();
const previewUrl = computed(() =>
  build.value?.preview_path ? siteResourceUrl(build.value.preview_path) : '',
);
const buildActive = computed(
  () => !!build.value && ['queued', 'running'].includes(build.value.state),
);
const images: Array<{
  key: keyof Pick<
    SiteConfig,
    | 'about_image'
    | 'app_icon'
    | 'contact_image'
    | 'explore_image'
    | 'hero_background'
    | 'hero_image'
    | 'logo'
  >;
  label: string;
}> = [
  { key: 'logo', label: '导航Logo' },
  { key: 'app_icon', label: '应用图标' },
  { key: 'hero_image', label: '首页主图' },
  { key: 'hero_background', label: '首页背景' },
  { key: 'about_image', label: '介绍配图' },
  { key: 'explore_image', label: '探索背景' },
  { key: 'contact_image', label: '联系配图' },
];
const textFields: Array<{
  key: keyof Pick<
    SiteConfig,
    | 'about_subtitle'
    | 'about_title'
    | 'contact_description'
    | 'contact_title'
    | 'download_title'
    | 'explore_description'
    | 'explore_subtitle'
    | 'explore_title'
    | 'hero_description'
    | 'hero_title'
    | 'screenshots_title'
  >;
  label: string;
  long?: boolean;
}> = [
  { key: 'hero_title', label: '首页标题' },
  { key: 'hero_description', label: '首页介绍', long: true },
  { key: 'about_title', label: '应用介绍标题' },
  { key: 'about_subtitle', label: '应用介绍副标题' },
  { key: 'explore_title', label: '探索标签' },
  { key: 'explore_subtitle', label: '探索标题' },
  { key: 'explore_description', label: '探索介绍', long: true },
  { key: 'contact_title', label: '联系区标题' },
  { key: 'contact_description', label: '联系区说明', long: true },
  { key: 'screenshots_title', label: '截图区标题' },
  { key: 'download_title', label: '下载区标题' },
];
async function load() {
  try {
    const result = await OfficialSitesApi.list({
      page: page.value,
      size: 15,
      keyword: keyword.value || undefined,
    });
    rows.value = result.items;
    total.value = result.total;
    errorText.value = '';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '官网列表加载失败');
  }
}
async function edit(site?: Site) {
  busy.value = true;
  try {
    defaults.value ??= await OfficialSitesApi.defaults();
    selected.value = site ? await OfficialSitesApi.get(site.id) : undefined;
    const data = selected.value;
    form.value = data
      ? {
          name: data.name,
          domains: [...data.domains],
          config: structuredClone(toRaw(data.config)),
          version: data.version,
        }
      : structuredClone(toRaw(defaults.value));
    domainsText.value = form.value.domains.join('\n');
    tab.value = 'basic';
    editorOpen.value = true;
    errorText.value = '';
  } catch (error) {
    message.error(requestErrorMessage(error, '官网配置加载失败'));
  } finally {
    busy.value = false;
  }
}
async function save(): Promise<Site | undefined> {
  if (!form.value || !manage.value) return selected.value;
  const payload: SiteWrite = {
    ...form.value,
    domains: domainsText.value
      .split(/[\n,，]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const site = await OfficialSitesApi.save(payload, selected.value?.id);
  selected.value = site;
  form.value.version = site.version;
  form.value.domains = site.domains;
  domainsText.value = site.domains.join('\n');
  await load();
  return site;
}
async function saveClick() {
  busy.value = true;
  try {
    await save();
    message.success('草稿已保存，发布后更新线上网站');
  } catch (error) {
    message.error(requestErrorMessage(error, '保存失败'));
  } finally {
    busy.value = false;
  }
}
async function duplicate(site: Site) {
  busy.value = true;
  try {
    const next = await OfficialSitesApi.copy(site.id);
    await load();
    await edit(next);
    message.success('网站已复制，请为副本配置独立域名');
  } catch (error) {
    message.error(requestErrorMessage(error, '复制失败'));
  } finally {
    busy.value = false;
  }
}
async function offline(site: Site) {
  Modal.confirm({
    title: '下线这个网站？',
    content: '域名将不再展示官网，已生成的静态包仍可下载。',
    okText: '下线',
    onOk: async () => {
      await OfficialSitesApi.unpublish(await OfficialSitesApi.get(site.id));
      await load();
      message.success('网站已下线');
    },
  });
}
function chooseTheme(value: SiteConfig['theme']) {
  const theme = themes.find((item) => item.value === value);
  if (form.value && manage.value && theme) {
    Object.assign(form.value.config, {
      theme: theme.value,
      accent: theme.accent,
      layout: theme.layout,
    });
  }
}
function moveSection(index: number, direction: number) {
  if (!form.value) return;
  const next = index + direction;
  const items = form.value.config.sections;
  if (next < 0 || next >= items.length) return;
  const value = items[index];
  const other = items[next];
  if (value && other) {
    items[index] = other;
    items[next] = value;
  }
}
async function start(mode: SiteBuild['mode'], site?: Site) {
  if (
    (mode === 'publish' && !canPublish.value) ||
    (mode === 'export' && !canExport.value) ||
    (mode === 'preview' && !canPreview.value)
  )
    return;
  const action = async () => {
    busy.value = true;
    try {
      const current = site ? await OfficialSitesApi.get(site.id) : await save();
      if (!current) throw new Error('请先保存网站配置');
      build.value = await OfficialSitesApi.build(current, mode);
      progressOpen.value = true;
      doneId.value = undefined;
      polling.start();
    } catch (error) {
      message.error(requestErrorMessage(error, '官网构建提交失败'));
    } finally {
      busy.value = false;
    }
  };
  if (mode === 'publish')
    Modal.confirm({
      title: '发布官网？',
      content:
        '保存并发布当前配置。只有配置的域名会展示这份官网；请确认应用链接和协议内容。',
      okText: '发布',
      zIndex: 2600,
      onOk: action,
    });
  else await action();
}
const polling = useTaskPolling({
  delay: 1000,
  load: () => {
    if (!build.value) throw new Error('请选择构建记录');
    return OfficialSitesApi.progress(build.value.id);
  },
  accept: async (value) => {
    build.value = value;
    if (
      !['queued', 'running'].includes(value.state) &&
      doneId.value !== value.id
    ) {
      doneId.value = value.id;
      await load();
      if (value.state === 'succeeded' && value.mode === 'preview')
        previewOpen.value = true;
    }
  },
  done: (value) => !['queued', 'running'].includes(value.state),
  onError: (error) => {
    errorText.value = requestErrorMessage(error, '构建进度读取失败，正在重试');
  },
});
async function download(value = build.value) {
  if (!value) return;
  busy.value = true;
  try {
    const blob = await OfficialSitesApi.download(value.id);
    downloadFileFromBlob({
      source: blob,
      fileName: `official-site-${value.site_id}-v${value.site_version}.zip`,
    });
    message.success('静态网站压缩包已下载');
  } catch (error) {
    message.error(requestErrorMessage(error, '下载失败'));
  } finally {
    busy.value = false;
  }
}
async function showHistory(site: Site) {
  try {
    const result = await OfficialSitesApi.builds(site.id);
    history.value = result.items;
    historyOpen.value = true;
  } catch (error) {
    message.error(requestErrorMessage(error, '构建历史加载失败'));
  }
}
async function viewBuild(value: SiteBuild) {
  build.value = await OfficialSitesApi.progress(value.id);
  progressOpen.value = true;
  if (buildActive.value) polling.start();
}
onMounted(load);
</script>
<template>
  <Page
    title="官网管理"
    description="独立维护每个应用的官网、域名、主题和协议，在线发布或导出静态部署包。"
  >
    <div class="toolbar">
      <Input.Search
        v-model:value="keyword"
        placeholder="搜索网站名称"
        class="search"
        @search="
          page = 1;
          load();
        "
      /><Button @click="load">刷新网站</Button><Button v-if="manage" type="primary" :loading="busy" @click="edit()">
        新增官网
      </Button>
    </div>
    <Alert v-if="errorText" type="error" :message="errorText" show-icon />
    <Table
      :data-source="rows"
      row-key="id"
      :pagination="{ current: page, pageSize: 15, total }"
      :scroll="{ x: 1050 }"
      :columns="[
        { title: '网站', key: 'name', width: 220 },
        { title: '域名', key: 'domains', width: 240 },
        { title: '主题与布局', key: 'theme', width: 180 },
        { title: '发布状态', key: 'state', width: 170 },
        { title: '操作', key: 'actions', width: 360 },
      ]"
      @change="
        (p) => {
          page = p.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <a v-if="column.key === 'name'" @click="edit(record)">{{ record.name }}
          <div class="muted">{{ record.config.app_name }}</div></a>
        <div v-else-if="column.key === 'domains'">
          <Tag v-for="domain in record.domains" :key="domain">{{ domain }}</Tag><span v-if="!record.domains.length" class="muted">尚未绑定域名</span>
        </div>
        <span v-else-if="column.key === 'theme'">{{ themes.find((t) => t.value === record.config.theme)?.label }} /
          {{
            layouts.find((t) => t.value === record.config.layout)?.label
          }}</span>
        <div v-else-if="column.key === 'state'">
          <Tag :color="record.enabled ? 'success' : 'default'">
            {{
              record.enabled
                ? '已发布'
                : record.published_bundle_id
                  ? '已下线'
                  : '草稿'
            }}
          </Tag>
          <div
            v-if="record.enabled && record.version !== record.published_version"
            class="muted"
          >
            有未发布修改
          </div>
        </div>
        <div v-else-if="column.key === 'actions'" class="actions">
          <Button size="small" @click="edit(record)">维护</Button><Button
            v-if="canPreview"
            size="small"
            :disabled="busy"
            @click="start('preview', record)"
          >
            预览
</Button><Button
            v-if="manage"
            size="small"
            :disabled="busy"
            @click="duplicate(record)"
          >
            复制
</Button><Button
            v-if="canPublish"
            size="small"
            :disabled="busy || !record.domains.length"
            @click="start('publish', record)"
          >
            发布
</Button><Button
            v-if="canExport"
            size="small"
            :disabled="busy"
            @click="start('export', record)"
          >
            导出ZIP
</Button><Button
            v-if="canPublish && record.enabled"
            size="small"
            danger
            @click="offline(record)"
          >
            下线
</Button><Button size="small" type="link" @click="showHistory(record)">
            构建记录
          </Button>
        </div>
      </template>
    </Table>
    <Modal
      v-model:open="editorOpen"
      :title="selected ? `维护官网 · ${selected.name}` : '新增官网'"
      width="min(1240px,96vw)"
      :footer="null"
      :z-index="900"
      :styles="{
        body: { maxHeight: 'calc(100dvh - 170px)', overflowY: 'auto' },
      }"
    >
      <template v-if="form">
        <div class="editor-actions">
          <Button
            v-if="manage"
            type="primary"
            :loading="busy"
            @click="saveClick"
          >
            保存草稿
</Button><Button v-if="canPreview" :disabled="busy" @click="start('preview')">
            {{ manage ? '保存并预览' : '预览网站' }}
</Button><Button v-if="canPublish" :disabled="busy" @click="start('publish')">
            保存并发布
</Button><Button v-if="canExport" :disabled="busy" @click="start('export')">
            保存并导出ZIP
</Button><span class="muted">保存草稿不会改变线上网站</span>
        </div>
        <fieldset :disabled="!manage || busy" class="form-body">
          <Tabs v-model:active-key="tab">
            <TabPane key="basic" tab="网站与应用">
              <div class="fields">
                <label>网站名称<Input
                    v-model:value="form.name"
                    aria-label="网站名称"
                    :maxlength="128"
/></label><label>应用名称<Input
                    v-model:value="form.config.app_name"
                    aria-label="应用名称"
                /></label>
                <label>公司 / 品牌名称<Input
                    v-model:value="form.config.company_name"
/></label><label>应用版本<Input v-model:value="form.config.app_version" /></label>
                <label class="wide">绑定域名<Input.TextArea
                    v-model:value="domainsText"
                    aria-label="绑定域名"
                    :rows="3"
                    placeholder="每行一个，例如 app.example.com、www.example.com"
                  /><small>发布后生效。DNS需指向官网服务或静态托管平台；下线后保留域名归属。</small></label>
                <label>Google Play 下载地址<Input
                    v-model:value="form.config.android_url"
                    aria-label="Google Play 下载地址"
/></label><label>App Store 下载地址<Input
                    v-model:value="form.config.ios_url"
                    aria-label="App Store 下载地址"
                /></label>
                <label>Android 包名<Input
                    v-model:value="form.config.android_package"
/></label><label>iOS Bundle ID<Input v-model:value="form.config.ios_bundle" /></label>
                <label>联系邮箱<Input
                    v-model:value="form.config.contact_email"
                    aria-label="联系邮箱"
/></label><label>页面语言<Select
                    :disabled="!manage"
                    v-model:value="form.config.language"
                    :options="[
                      { label: 'English', value: 'en' },
                      { label: '简体中文', value: 'zh-CN' },
                      { label: '繁體中文', value: 'zh-TW' },
                      { label: 'Español', value: 'es' },
                      { label: 'Português', value: 'pt' },
                      { label: '日本語', value: 'ja' },
                      { label: '한국어', value: 'ko' },
                    ]"
                /></label>
                <label class="wide">SEO 标题<Input
                    v-model:value="form.config.title"
                    aria-label="SEO 标题"
/></label><label class="wide">SEO 描述<Input.TextArea
                    v-model:value="form.config.description"
                    :rows="3"
/></label><label class="wide">页脚版权信息<Input v-model:value="form.config.copyright" /></label>
              </div>
            </TabPane>
            <TabPane key="style" tab="主题与排版">
              <p class="muted">
                选择主题会应用推荐排版和强调色，文案与图片保留；下方可独立调整排版。
              </p>
              <div class="themes">
                <button
                  v-for="theme in themes"
                  :key="theme.value"
                  type="button"
                  class="theme-card"
                  :class="{ chosen: form.config.theme === theme.value }"
                  :aria-pressed="form.config.theme === theme.value"
                  @click="chooseTheme(theme.value)"
                >
                  <span
                    class="theme-sample"
                    :class="`sample-${theme.value}`"
                    :style="{ background: theme.color }"
                    aria-hidden="true"
                    ><span>{{ theme.sample }}</span><i></i><em></em></span><strong>{{ theme.label }}</strong><small>{{ theme.detail }}</small>
                </button>
              </div>
              <div class="fields">
                <label>页面排版<Select
                    :disabled="!manage"
                    v-model:value="form.config.layout"
                    aria-label="页面排版"
                    :options="layouts"
/></label><label>主题强调色<input
                    v-model="form.config.accent"
                    aria-label="主题强调色"
                    type="color"
                    class="color-input"
                /></label>
              </div>
              <p class="muted">
                {{
                  layouts.find((item) => item.value === form?.config.layout)
                    ?.detail
                }}
              </p>
              <h3>区块顺序与显示</h3>
              <div
                v-for="(section, index) in form.config.sections"
                :key="section.id"
                class="section-row"
              >
                <Checkbox v-model:checked="section.enabled">显示</Checkbox><Input
                  v-model:value="section.label"
                  :aria-label="`区块 ${section.id} 名称`"
                /><Button
                  :disabled="index === 0"
                  :aria-label="`上移 ${section.label}`"
                  @click="moveSection(index, -1)"
                >
                  ↑
</Button><Button
                  :disabled="index === form.config.sections.length - 1"
                  :aria-label="`下移 ${section.label}`"
                  @click="moveSection(index, 1)"
                >
                  ↓
                </Button>
              </div>
            </TabPane>
            <TabPane key="content" tab="文案与内容">
              <div class="fields">
                <label
                  v-for="field in textFields"
                  :key="field.key"
                  :class="{ wide: field.long }"
                  >{{ field.label
                  }}<Input.TextArea
                    v-if="field.long"
                    v-model:value="form.config[field.key]"
                    :aria-label="field.label"
                    :rows="3"
/><Input
                    v-else
                    v-model:value="form.config[field.key]"
                    :aria-label="field.label"
                /></label>
              </div>
              <h3>内容分类</h3>
              <div
                v-for="(feature, index) in form.config.features"
                :key="index"
                class="item-card"
              >
                <label>分类标题<Input v-model:value="feature.title" /></label><label>分类介绍<Input.TextArea
                    v-model:value="feature.description"
                    :rows="3"
/></label><Button
                  danger
                  size="small"
                  @click="form.config.features.splice(index, 1)"
                >
                  删除分类
                </Button>
              </div>
              <Button
                :disabled="form.config.features.length >= 8"
                @click="
                  form.config.features.push({
                    title: '新分类',
                    description: '',
                  })
                "
              >
                添加分类
              </Button>
              <h3>展示统计</h3>
              <div
                v-for="(stat, index) in form.config.statistics"
                :key="index"
                class="stat-row"
              >
                <Input v-model:value="stat.value" placeholder="数值" /><Input
                  v-model:value="stat.label"
                  placeholder="说明"
                /><Button
                  danger
                  @click="form.config.statistics.splice(index, 1)"
                >
                  删除
                </Button>
              </div>
              <Button
                :disabled="form.config.statistics.length >= 6"
                @click="
                  form.config.statistics.push({
                    value: '100+',
                    label: 'Downloads',
                  })
                "
              >
                添加统计
              </Button>
            </TabPane>
            <TabPane key="images" tab="图片与截图">
              <Alert
                type="info"
                message="支持PNG、JPEG、WebP和GIF；单图不超过8MiB。构建时会复制所有图片，静态包无需连接文件库。"
              />
              <div class="image-grid">
                <ImageField
                  v-for="image in images"
                  :key="image.key"
                  v-model="form.config[image.key]"
                  :label="image.label"
                  :default-value="defaults?.config[image.key]"
                  :disabled="!manage"
                />
              </div>
              <h3>应用截图</h3>
              <div class="image-grid">
                <div v-for="(_, index) in form.config.screenshots" :key="index">
                  <ImageField
                    :model-value="form.config.screenshots[index] ?? ''"
                    :label="`应用截图 ${index + 1}`"
                    :disabled="!manage"
                    @update:model-value="
                      (value) => {
                        if (form) form.config.screenshots[index] = value;
                      }
                    "
                  /><Button
                    class="mt-2"
                    size="small"
                    danger
                    @click="form.config.screenshots.splice(index, 1)"
                  >
                    删除截图
                  </Button>
                </div>
              </div>
              <Button
                :disabled="form.config.screenshots.length >= 16"
                @click="
                  form.config.screenshots.push('builtin:screenshots01.png')
                "
              >
                添加截图
              </Button>
            </TabPane>
            <TabPane key="legal" tab="隐私与协议">
              <Alert
                type="info"
                message="支持Markdown，可用 {app_name}、{company_name}、{contact_email}、{website_domain} 引用当前网站信息。请根据实际业务维护协议。"
              />
              <div
                v-for="(legal, index) in form.config.legal"
                :key="index"
                class="item-card"
              >
                <div class="fields">
                  <label>协议标题<Input
                      v-model:value="legal.title"
                      :aria-label="`协议标题 ${index + 1}`"
/></label><label>页面地址<Input
                      v-model:value="legal.slug"
                      :aria-label="`协议地址 ${index + 1}`"
                  /></label>
                </div>
                <label>协议内容<Input.TextArea
                    v-model:value="legal.markdown"
                    :aria-label="`协议内容 ${index + 1}`"
                    :rows="12"
/></label><Button
                  danger
                  size="small"
                  @click="form.config.legal.splice(index, 1)"
                >
                  删除协议
                </Button>
              </div>
              <Button
                :disabled="form.config.legal.length >= 8"
                @click="
                  form.config.legal.push({
                    slug: `policy-${form.config.legal.length + 1}`,
                    title: '新协议',
                    markdown: '# 新协议\n\n请编辑协议内容。',
                  })
                "
              >
                添加协议
              </Button>
            </TabPane>
          </Tabs>
        </fieldset>
      </template>
    </Modal>
    <Modal
      v-model:open="progressOpen"
      title="官网构建进度"
      :footer="null"
      :z-index="2700"
    >
      <template v-if="build">
        <p>构建 #{{ build.id }} · 配置版本 {{ build.site_version }}</p>
        <Alert
          :type="
            build.state === 'failed'
              ? 'error'
              : buildActive
                ? 'info'
                : 'success'
          "
          :message="
            build.error ||
            (buildActive ? '正在处理图片并生成静态页面…' : '静态网站构建完成')
          "
          show-icon
        />
        <div class="toolbar mt-4">
          <Button v-if="previewUrl" @click="previewOpen = true">
            查看网站预览
</Button><Button
            v-if="canExport && build.state === 'succeeded'"
            :loading="busy"
            @click="download()"
          >
            下载静态ZIP
</Button><Button @click="progressOpen = false">关闭</Button>
        </div>
      </template>
    </Modal>
    <Modal
      v-model:open="previewOpen"
      title="官网预览"
      width="min(1440px,98vw)"
      :footer="null"
      :z-index="2800"
    >
      <div class="toolbar">
        <Button @click="previewWidth = '100%'">桌面</Button><Button @click="previewWidth = '390px'">手机</Button><a
          v-if="previewUrl"
          :href="previewUrl"
          target="_blank"
          rel="noopener noreferrer"
          >新窗口打开</a><small>预览链接一小时内有效</small>
      </div>
      <div class="preview-shell">
        <iframe
          v-if="previewUrl"
          :src="previewUrl"
          title="官网预览页面"
          :style="{ width: previewWidth }"
          sandbox="allow-scripts allow-same-origin allow-popups"
        ></iframe>
      </div>
    </Modal>
    <Modal
      v-model:open="historyOpen"
      title="官网构建记录"
      :width="900"
      :footer="null"
    >
      <Table
        :data-source="history"
        row-key="id"
        :columns="[
          { title: '编号', dataIndex: 'id' },
          { title: '类型', dataIndex: 'mode' },
          { title: '配置版本', dataIndex: 'site_version' },
          { title: '状态', dataIndex: 'state' },
          { title: '错误', dataIndex: 'error' },
          { title: '操作', key: 'actions' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'actions'" class="actions">
            <Button size="small" @click="viewBuild(record)">查看</Button><Button
              v-if="canExport && record.state === 'succeeded'"
              size="small"
              @click="download(record)"
            >
              下载ZIP
            </Button>
          </div>
        </template>
      </Table>
    </Modal>
  </Page>
</template>
<style scoped>
.toolbar,
.actions,
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.toolbar {
  margin-bottom: 18px;
}

.search {
  max-width: 320px;
}

.muted,
small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.editor-actions {
  padding-bottom: 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.form-body {
  min-width: 0;
  padding: 0;
  border: 0;
}

.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 20px 0;
}

.fields label,
.item-card > label {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.wide {
  grid-column: 1/-1;
}

.themes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin: 20px 0;
}

.theme-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  text-align: left;
  background: hsl(var(--background));
  border: 2px solid hsl(var(--border));
  border-radius: 12px;
}

.theme-card.chosen {
  border-color: hsl(var(--primary));
}

.theme-sample {
  position: relative;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  height: 120px;
  overflow: hidden;
  color: white;
  border-radius: 6px;
}

.theme-sample span {
  z-index: 1;
  font:
    900 24px/1 Arial,
    sans-serif;
  letter-spacing: -1px;
}

.theme-sample i {
  width: 34px;
  height: 76px;
  background: #fffc;
  border: 3px solid #fff;
  border-radius: 7px;
  transform: rotate(-6deg);
}

.theme-sample em {
  position: absolute;
  bottom: 12px;
  left: 18px;
  width: 36px;
  height: 8px;
  background: #fff9;
}

.sample-light {
  flex-direction: column;
  gap: 12px;
  color: #202437;
}

.sample-light i {
  width: 28px;
  height: 42px;
  background: #b3bcdf;
  transform: none;
}

.sample-light em {
  display: none;
}

.sample-cinema {
  align-items: flex-end;
  padding-bottom: 25px;
}

.sample-cinema span {
  font-size: 21px;
}

.sample-cinema i {
  position: absolute;
  top: 4px;
  right: 30px;
  width: 55px;
  height: 125px;
  opacity: 0.3;
  transform: rotate(20deg);
}

.sample-cinema em {
  bottom: 12px;
  background: #d99946;
}

.sample-editorial {
  flex-direction: column;
  gap: 12px;
  color: #282a24;
}

.sample-editorial span {
  font:
    italic 34px/1 Georgia,
    serif;
}

.sample-editorial i {
  width: 78%;
  height: 38px;
  background: #b7472944;
  border: 0;
  border-top: 1px solid #282a24;
  border-radius: 0;
  transform: none;
}

.sample-editorial em {
  display: none;
}

.sample-neon {
  color: #d5ff47;
  background-image:
    linear-gradient(#ffffff14 1px, transparent 1px),
    linear-gradient(90deg, #ffffff14 1px, transparent 1px) !important;
  background-size: 15px 15px !important;
}

.sample-neon span {
  padding: 14px 8px;
  font-family: monospace;
  border: 1px solid #d5ff4755;
  border-radius: 10px;
}

.sample-neon i {
  background: #d5ff47;
  border: 0;
  border-radius: 12px;
  transform: none;
}

.sample-neon em {
  background: #d5ff47;
  border-radius: 10px;
}

.sample-playful span {
  font-size: 30px;
  color: #f6dc54;
  transform: rotate(-8deg);
}

.sample-playful i {
  background: #f6dc54;
  border: 2px solid #17245c;
  border-radius: 0;
  box-shadow: 5px 5px 0 #17245c;
  transform: rotate(12deg);
}

.sample-playful em {
  background: #fff;
  border: 1px solid #17245c;
}

.color-input {
  width: 100%;
  height: 38px;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.section-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
}

.section-row .ant-input {
  max-width: 350px;
}

.item-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  margin: 18px 0;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.stat-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 10px;
  margin: 12px 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin: 22px 0;
}

h3 {
  margin: 28px 0 12px;
  font-size: 16px;
}

.preview-shell {
  display: flex;
  justify-content: center;
  padding: 6px;
  overflow: auto;
  background: #e5e7eb;
}

.preview-shell iframe {
  max-width: 100%;
  height: 72vh;
  background: white;
  border: 0;
  border-radius: 5px;
}

@media (max-width: 700px) {
  .fields {
    grid-template-columns: 1fr;
  }

  .themes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .theme-card {
    padding: 8px;
  }

  .theme-card small {
    display: none;
  }

  .image-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-row {
    grid-template-columns: 1fr;
  }

  .section-row {
    gap: 5px;
  }
}
</style>
