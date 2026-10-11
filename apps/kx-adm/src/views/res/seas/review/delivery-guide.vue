<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { Button, Modal } from 'antdv-next';
const open = ref(false);
const step = ref(0);
const store = useUserStore();
const key = computed(
  () =>
    `kx:delivery-guide:v2:${location.origin}:${store.userInfo?.userId ?? store.userInfo?.username ?? 'current'}`,
);
const steps = [
  {
    title: '先建制作项目，不进入资源库',
    body: '在作品交付中创建作品，设置计划集数，再添加剪辑、编剧和导演。制作阶段的资料和视频不会出现在资源管理。',
  },
  {
    title: '按清单提交整套材料',
    body: '每集需要成片、无字幕版、无音乐版。前6集还需提示词和工程截图；不足6集时按实际集数。作品还需海报和剧本简介。SRT、DEMO、YouTube为可选项。',
  },
  {
    title: '缺项补齐后提交交片',
    body: '点击“定位缺项”快速补交。文件在 Tauri 客户端选择并流式上传，可暂停、失败重试和恢复已完成文件。上传后还需填写说明并提交材料。成片支持整版上传和补集；所有必交材料齐全后才能提交交片。',
  },
  {
    title: '审片和材料意见分别定位',
    body: '在逐集审片中播放成片、标记时间点、提出意见。在材料弹窗中选择具体快照提建议。剪辑上传修订后填写处理结果，不要只换视频却遗漏无字幕版或无音乐版。',
  },
  {
    title: '定稿后不能随意替换',
    body: '负责人可逐集定稿，冻结该集视频及材料。需要修改时先填写原因重新打开；定稿、替换和历史恢复都有操作人及时间记录。整包定稿后只能复制新交付版本修改。',
  },
  {
    title: '定稿入库后交给运营',
    body: '全部材料齐全、意见完成后确认整包定稿。拥有入库权限的人再执行“定稿入库”。资源管理接收独立固定版本，负责后续上架、下载授权和分发；入库不会自动上架。交付文件另在“下载权限”按版本、模块、集数授权，接收人在客户端“交付下载”获取，不自动继承审片权限。',
  },
];
function done() {
  try {
    localStorage.setItem(key.value, 'seen');
  } catch {}
  open.value = false;
}
onMounted(() => {
  try {
    open.value = localStorage.getItem(key.value) !== 'seen';
  } catch {
    open.value = true;
  }
});
</script>
<template>
  <Button
    @click="
      step = 0;
      open = true;
    "
  >
    操作指引
</Button><Modal
    v-model:open="open"
    title="从交付到入库 · 操作指引"
    width="min(760px,94vw)"
    :footer="null"
    :z-index="1100"
  >
    <div class="delivery-guide">
      <nav aria-label="指引步骤">
        <button
          v-for="(item, index) in steps"
          :key="item.title"
          :class="{ active: step === index }"
          @click="step = index"
        >
          {{ index + 1 }}. {{ item.title }}
        </button>
      </nav>
      <section>
        <p>第 {{ step + 1 }} / {{ steps.length }} 步</p>
        <h3>{{ steps[step]?.title }}</h3>
        <p>{{ steps[step]?.body }}</p>
      </section>
    </div>
    <footer class="guide-footer">
      <Button @click="open = false">稍后再看</Button><Button v-if="step > 0" @click="step--">上一步</Button><Button v-if="step < steps.length - 1" type="primary" @click="step++">
        下一步
</Button><Button v-else type="primary" @click="done">我知道了，开始交付</Button>
    </footer>
  </Modal>
</template>
<style scoped>
.delivery-guide {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  margin: 20px 0;
}

.delivery-guide nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delivery-guide nav button {
  padding: 12px;
  text-align: left;
  border-radius: 8px;
}

.delivery-guide nav .active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.delivery-guide h3 {
  margin: 12px 0;
  font-size: 20px;
  font-weight: 600;
}

.delivery-guide section p {
  line-height: 1.9;
  color: hsl(var(--muted-foreground));
}

.guide-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 600px) {
  .delivery-guide {
    grid-template-columns: minmax(0, 1fr);
  }

  .delivery-guide nav {
    display: none;
  }
}
</style>
