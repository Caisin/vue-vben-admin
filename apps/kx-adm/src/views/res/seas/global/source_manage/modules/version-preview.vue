<script setup lang="ts">
import type { Id, VersionDetail, VersionItem } from '#/api/res/versions';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Modal,
  Pagination,
  Spin,
  Switch,
} from 'antdv-next';

import { StorageFileApi } from '#/api/storage';
import { uploadErrorMessage } from '#/components/file-picker/internal/upload-error';

const props = defineProps<{ detail: VersionDetail; resourceName: string }>();
const emit = defineEmits<{ refresh: [] }>();
const open = ref(false);
const selectedId = ref<Id>();
const url = ref('');
const loading = ref(false);
const errorText = ref('');
const video = ref<HTMLVideoElement>();
const autoNext = ref(true);
const page = ref(1);
const mediaInfo = ref('');
const items = computed(() =>
  props.detail.items.toSorted((a, b) => Number(a.seq_no) - Number(b.seq_no)),
);
const selectedIndex = computed(() =>
  items.value.findIndex((item) => String(item.id) === String(selectedId.value)),
);
const selected = computed(() => items.value[selectedIndex.value]);
const pagedItems = computed(() =>
  items.value.slice((page.value - 1) * 50, page.value * 50),
);
let request = 0;
function release(value: string) {
  if (value.startsWith('blob:')) URL.revokeObjectURL(value);
}
function reset() {
  request++;
  video.value?.pause();
  release(url.value);
  url.value = '';
  loading.value = false;
  errorText.value = '';
  mediaInfo.value = '';
}
async function play(item: VersionItem, autoplay = true) {
  reset();
  const current = request;
  selectedId.value = item.id;
  page.value =
    Math.floor(
      items.value.findIndex((v) => String(v.id) === String(item.id)) / 50,
    ) + 1;
  loading.value = true;
  try {
    let result: string;
    if (item.link.startsWith('storage:file:')) {
      result = await StorageFileApi.url(
        item.link.slice('storage:file:'.length),
      );
    } else if (/^https?:\/\//i.test(item.link)) {
      result = item.link;
    } else {
      throw new Error('此集没有有效的视频文件');
    }
    if (current !== request || !open.value) {
      release(result);
      return;
    }
    url.value = result;
    await nextTick();
    if (autoplay && current === request)
      await video.value?.play().catch(() => {
        /* 浏览器限制自动播放时保留原生播放按钮。 */
      });
  } catch (error) {
    if (current === request)
      errorText.value = uploadErrorMessage(error, '读取视频失败，请重试');
  } finally {
    if (current === request) loading.value = false;
  }
}
function move(offset: number) {
  const item = items.value[selectedIndex.value + offset];
  if (item) void play(item);
}
function ended() {
  if (autoNext.value) move(1);
}
function loaded() {
  const player = video.value;
  if (player)
    mediaInfo.value = `${player.videoWidth} × ${player.videoHeight} · ${Number.isFinite(player.duration) ? Math.round(player.duration) : 0} 秒`;
}
function failed() {
  errorText.value =
    '视频暂时无法播放，请重试刷新地址；若仍失败，请检查存储访问权限、视频格式与编码。';
}
watch(open, (value) => {
  if (value && items.value[0]) void play(items.value[0], false);
  else reset();
});
watch(
  () => props.detail.version.id,
  () => {
    open.value = false;
    reset();
    selectedId.value = undefined;
    page.value = 1;
  },
);
watch(
  () => props.detail.items,
  () => {
    if (!open.value) return;
    const item =
      items.value.find((v) => String(v.id) === String(selectedId.value)) ??
      items.value[0];
    if (item) void play(item, false);
    else {
      reset();
      selectedId.value = undefined;
    }
  },
);
onBeforeUnmount(reset);
</script>
<template>
  <Button :disabled="!items.length" @click="open = true">播放预览</Button>
  <Modal
    v-model:open="open"
    :title="`${resourceName} · ${detail.version.name} · 播放预览`"
    :width="1100"
    :z-index="970"
    :footer="null"
    destroy-on-close
  >
    <div class="preview-layout">
      <section class="min-w-0" aria-label="视频播放">
        <Spin :spinning="loading">
          <video
            v-if="url"
            :key="url"
            ref="video"
            :src="url"
            controls
            playsinline
            preload="metadata"
            class="version-player"
            @ended="ended"
            @loadedmetadata="loaded"
            @error="failed"
          ></video>
          <Empty
            v-else
            :description="loading ? '正在读取视频…' : '请选择分集'"
            class="py-16"
          />
        </Spin>
        <Alert
          v-if="errorText"
          :message="errorText"
          type="error"
          class="my-3"
        />
        <p class="my-3 font-medium">
          {{
            selected
              ? `第 ${selected.seq_no} 集 · ${selected.title}`
              : '暂无分集'
          }}
        </p>
        <p class="mb-3 text-sm text-muted-foreground">{{ mediaInfo }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <Button :disabled="selectedIndex <= 0 || loading" @click="move(-1)">
            上一集
          </Button>
          <Button
            :disabled="
              selectedIndex < 0 || selectedIndex >= items.length - 1 || loading
            "
            @click="move(1)"
          >
            下一集
          </Button>
          <Button
            :disabled="!selected || loading"
            @click="selected && play(selected, false)"
          >
            重新加载视频
          </Button>
          <Switch v-model:checked="autoNext" aria-label="自动播放下一集" /><span>自动下一集</span>
        </div>
      </section>
      <aside aria-label="版本播放列表">
        <div class="mb-3 flex items-center justify-between gap-2">
          <strong>剧集（{{ selectedIndex + 1 }}/{{ items.length }}）</strong><Button size="small" @click="emit('refresh')">刷新列表</Button>
        </div>
        <Pagination
          v-model:current="page"
          :page-size="50"
          :total="items.length"
          :show-size-changer="false"
          size="small"
          class="mb-3"
        />
        <nav class="episode-grid" aria-label="选择分集">
          <button
            v-for="item in pagedItems"
            :key="item.id"
            type="button"
            class="episode-button"
            :class="{ selected: String(item.id) === String(selectedId) }"
            :aria-pressed="String(item.id) === String(selectedId)"
            :aria-label="`播放第 ${item.seq_no} 集：${item.title}`"
            :title="item.title"
            @click="play(item)"
          >
            {{ item.seq_no }}
          </button>
        </nav>
      </aside>
    </div>
  </Modal>
</template>
<style scoped>
.preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
}

.version-player {
  width: 100%;
  height: min(65vh, 680px);
  object-fit: contain;
  background: #000;
}

.episode-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}

.episode-button {
  min-height: 40px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.episode-button.selected {
  color: hsl(var(--primary));
  background: hsl(var(--accent));
  border-color: hsl(var(--primary));
}

@media (max-width: 767px) {
  .preview-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .version-player {
    height: 45vh;
  }

  .episode-grid {
    max-height: 240px;
  }
}
</style>
