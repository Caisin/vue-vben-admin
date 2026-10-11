<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Alert, Button, Modal, Tag } from 'antdv-next';

import { apiURL } from '#/api/request';

const props = defineProps<{ canEdit: boolean; canManage: boolean }>();
const userStore = useUserStore();
const open = ref(false);
const step = ref(0);
const storageWarning = ref('');
// 按服务与账号区分，换剧不重复提示；指引改版时升级版本号。
const storageKey = computed(() => {
  const uid = userStore.userInfo?.userId;
  return uid
    ? `kx:resource-review:guide:v1:${encodeURIComponent(apiURL)}:${uid}`
    : undefined;
});
const role = computed(() => {
  if (props.canManage) return '作品负责人';
  if (props.canEdit) return '剪辑';
  return '编剧 / 导演';
});
const steps = computed(() => [
  {
    title: '先看流程与分工',
    location: '工作台顶部 · 版本与状态',
    summary: '一部作品可以有多个版本。先确认版本，再选集、审片和修改。',
    actions: [
      '制作中：设置计划集数，上传视频；全集上传完成即可交片。',
      '已交片 · 审片修改：继续提建议、替换问题集，反复调整。',
      '定版成片 → 已上架：固定当前版本；后续修改要复制或新建版本。',
    ],
    tip: '交片不等于定版。有未完成的建议也能交片，全部建议完成后才能定版。',
  },
  {
    title: '选作品、版本与协作者',
    location: '作品列表行按钮 / 工作台右上角',
    summary: props.canManage
      ? '先添加一起审片的成员，明确每个人的分工。'
      : '在已参与的作品中，选中本轮需要审核的版本。',
    actions: [
      '作品列表点“协作者”可直接添加成员；也可在工作台右上角查看成员。',
      '剪辑：上传与替换视频、处理建议。编剧 / 导演：预览、评论和提建议。',
      '负责人管理成员、确认定版与上架；协作者可查看本作品的全部版本。',
    ],
    tip: '没有操作按钮时，请联系负责人确认角色。添加协作者不需要先创建版本。',
  },
  {
    title: '上传完整版本，再交片',
    location: '顶部“计划集数”“整版 / 补集上传”',
    summary:
      '剪辑或负责人保存计划集数，上传计划内全部分集，再点“交片，开始审片”。',
    actions: [
      '多集上传：选择多个视频，核对文件与集数的对应关系，再开始上传。',
      '单集上传：左侧选中缺少的一集，点击播放器旁的“上传这一集”。',
      '上传完还要等待后台登记成功。任务失败可查看逐集原因并重试。',
    ],
    tip: '文件上传期间保留页面。提交后台登记任务后可关闭；网页单视频上限 512 MB。',
  },
  {
    title: '边预览，边提出具体意见',
    location: '左侧分集 → 中间播放器 → 下方意见输入框',
    summary:
      '选中问题集，播放到问题位置，点击“标记当前时间”，再描述需要调整的内容。',
    actions: [
      '修改建议：需要剪辑处理，会计入待完成数量。评论：交流记录，不阻止定版。',
      '示例：00:23 字幕“再见”应为“再见面”，请替换并核对这一段字幕。',
      '右侧时间点可跳转到对应位置；左侧筛选“有待处理建议”能快速定位问题集。',
    ],
    tip: '切换分集会保留当前页面的未发送草稿；关闭页面前请先提交需要保留的意见。',
  },
  {
    title: '替换问题集，完成对应建议',
    location: '播放器旁“替换这一集” / 右侧建议卡片',
    summary:
      '剪辑先标记“开始处理”，改完后上传替换指定集，播放核对后再完成建议。',
    actions: [
      '“替换这一集”只更新当前集，不改其他集；批量补集不会覆盖已有视频。',
      '点“完成建议”并填写处理说明；仍需调整时可“重新打开”，处理记录保留。',
      '针对替换前视频的意见会单独标注，避免把旧时间点当成新视频的问题。',
    ],
    tip: '上传成功不会自动完成所有建议。请逐条核对，避免漏改。',
  },
  {
    title: '本轮完成后确认定版',
    location: '顶部“修改完成，确认定版” → “确认上架”',
    summary: '全集齐全、修改建议全部完成后，由负责人确认定版。',
    actions: [
      '还有待处理建议时，继续在本版本的审片周期中修改，不需要每改一集就建新版。',
      '定版后视频与审核记录固定；上架保持只读，旧上传任务也不能覆盖它。',
      '需要再次改片：点“复制版本修改”保留原视频再改问题集，或“全新版本”从头上传。',
    ],
    tip: '以后忘记步骤，随时点击工作台顶部“操作指引”重新查看。',
  },
]);
const current = computed(() => steps.value[step.value] ?? steps.value[0]);
function show() {
  step.value = 0;
  storageWarning.value = '';
  open.value = true;
}
watch(
  storageKey,
  (key) => {
    open.value = false;
    step.value = 0;
    if (!key) return;
    try {
      if (window.localStorage.getItem(key) !== 'seen') show();
    } catch {
      show();
    }
  },
  { immediate: true },
);
function finish() {
  if (storageKey.value) {
    try {
      window.localStorage.setItem(storageKey.value, 'seen');
    } catch {
      storageWarning.value = '此设备无法保存已读状态，下次可能仍会显示指引。';
      return;
    }
  }
  open.value = false;
}
</script>
<template>
  <Button @click="show">操作指引</Button>
  <Modal
    v-model:open="open"
    title="作品审核 · 操作指引"
    :width="860"
    :z-index="1100"
    :footer="null"
    :mask-closable="false"
    :styles="{ body: { maxHeight: '75vh', overflowY: 'auto' } }"
  >
    <div class="guide-intro">
      <Tag color="blue">当前身份：{{ role }}</Tag><span>从上传交片到定版，按步骤完成一次审核</span>
    </div>
    <div class="guide-layout">
      <nav aria-label="操作指引步骤" class="guide-nav">
        <button
          v-for="(entry, index) in steps"
          :key="entry.title"
          type="button"
          :aria-current="step === index ? 'step' : undefined"
          @click="step = index"
        >
          <span>{{ index + 1 }}</span>{{ entry.title }}
        </button>
      </nav>
      <section v-if="current" class="guide-content" aria-live="polite">
        <p class="guide-location">{{ current.location }}</p>
        <h3>{{ current.title }}</h3>
        <p class="guide-summary">{{ current.summary }}</p>
        <ol>
          <li v-for="action in current.actions" :key="action">{{ action }}</li>
        </ol>
        <Alert type="info" show-icon :message="current.tip" />
      </section>
    </div>
    <Alert
      v-if="storageWarning"
      class="mt-3"
      type="warning"
      :message="storageWarning"
    />
    <footer class="guide-footer">
      <Button @click="open = false">稍后再看</Button><span>{{ step + 1 }} / {{ steps.length }}</span>
      <div class="flex gap-2">
        <Button :disabled="step === 0" @click="step--">上一步</Button><Button v-if="step < steps.length - 1" type="primary" @click="step++">
          下一步
</Button><Button v-else type="primary" @click="finish">
          我知道了，开始操作
        </Button>
      </div>
    </footer>
  </Modal>
</template>
<style scoped>
.guide-intro {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 4px 0 20px;
  color: hsl(var(--muted-foreground));
}

.guide-layout {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 24px;
}

.guide-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guide-nav button {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 10px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
}

.guide-nav button span {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 24px;
  height: 24px;
  background: hsl(var(--muted));
  border-radius: 50%;
}

.guide-nav button:hover {
  background: hsl(var(--muted));
}

.guide-nav button[aria-current='step'] {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 35%);
}

.guide-content {
  min-height: 370px;
  padding: 8px 0;
}

.guide-location {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.guide-content h3 {
  margin: 10px 0;
  font-size: 22px;
  font-weight: 650;
}

.guide-summary {
  line-height: 1.8;
}

.guide-content ol {
  padding-left: 20px;
  margin: 20px 0;
  list-style: decimal;
}

.guide-content li {
  padding-left: 4px;
  margin-bottom: 14px;
  line-height: 1.8;
}

.guide-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  margin-top: 20px;
  border-top: 1px solid hsl(var(--border));
}

.guide-footer > span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 650px) {
  .guide-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .guide-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }

  .guide-nav button {
    padding: 8px;
    font-size: 12px;
  }

  .guide-content {
    min-height: 0;
  }

  .guide-footer {
    flex-wrap: wrap;
  }
}
</style>
