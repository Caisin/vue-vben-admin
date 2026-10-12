<script setup lang="ts">
import type { ReviewNote, ReviewView } from '#/api/res/review';
import type { Id } from '#/api/res/versions';

import { computed, nextTick, ref } from 'vue';

import {
  Alert,
  Avatar,
  Button,
  Empty,
  Select,
  Tag,
  TextArea,
} from 'antdv-next';

import { reviewApi } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{
  res: Id;
  version: Id;
  view: ReviewView;
  currentSeq: number;
  editable: boolean;
}>();
const emit = defineEmits<{
  refresh: [];
  select: [seq: number];
  updateFile: [seq: number];
}>();
const body = ref('');
const kind = ref<'comment' | 'suggestion'>('comment');
const seq = ref(props.currentSeq);
const quote = ref<ReviewNote>();
const mentions = ref<number[]>([]);
const busy = ref(false);
const errorText = ref('');
const scroller = ref<HTMLElement>();
const messages = computed(() =>
  [...props.view.notes].toSorted(
    (a, b) => Number(a.created_at) - Number(b.created_at),
  ),
);
const users = computed(() => Object.entries(props.view.users));
function username(uid: number) {
  return props.view.users[String(uid)] || `用户 ${uid}`;
}
function time(at: number) {
  return new Date(Number(at) * 1000).toLocaleString();
}
function quoteMessage(note: ReviewNote) {
  quote.value = note;
  body.value = `> ${username(Number(note.uid))}：${note.body}\n\n`;
  seq.value = note.seq_no;
  nextTick(() =>
    document
      .querySelector<HTMLTextAreaElement>('.chat-composer textarea')
      ?.focus(),
  );
}
function toggleMention(uid: number) {
  mentions.value = mentions.value.includes(uid)
    ? mentions.value.filter((v) => v !== uid)
    : [...mentions.value, uid];
}
async function send() {
  if (!body.value.trim() || busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    await reviewApi.addChat(props.res, props.version, {
      expected_revision: props.view.detail.version.revision,
      seq_no: seq.value,
      kind: kind.value,
      body: `${mentions.value.map((uid) => `@${username(uid)}`).join(' ')}${mentions.value.length > 0 ? '\n' : ''}${body.value.trim()}`,
      position_ms: 0,
      reply_to: quote.value ? Number(quote.value.id) : undefined,
      mentions: mentions.value,
      attachments: [],
    });
    body.value = '';
    quote.value = undefined;
    mentions.value = [];
    emit('refresh');
    nextTick(() =>
      scroller.value?.scrollTo({
        top: scroller.value.scrollHeight,
        behavior: 'smooth',
      }),
    );
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '发送讨论消息失败，请刷新后重试',
    );
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="review-chat" aria-label="审片讨论">
    <header class="chat-header">
      <div>
        <h3>审片讨论</h3>
        <p>
          站内群聊替代方案：自由发言、引用回复、@协作者，消息与每集审核记录同步。
        </p>
      </div>
      <Tag color="blue">不依赖钉钉 API</Tag>
    </header>
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <div ref="scroller" class="chat-stream">
      <Empty
        v-if="!messages.length"
        description="还没有讨论消息，先发起第一条审片意见"
      />
      <article
        v-for="message in messages"
        :key="String(message.id)"
        class="chat-message"
        :class="{
          mine: Number(message.uid) === Number(view.detail.version.id),
        }"
      >
        <Avatar :size="34">
          {{ username(Number(message.uid)).slice(0, 1) }}
        </Avatar>
        <div class="chat-bubble">
          <header>
            <strong>{{ username(Number(message.uid)) }}</strong>
            <span>{{ time(message.created_at) }}</span>
            <Tag v-if="message.kind === 'suggestion'" color="orange">
              修改建议 ·
              {{ message.state === 'resolved' ? '已完成' : '待处理' }}
            </Tag>
            <Tag v-else>评论</Tag>
          </header>
          <button
            v-if="message.seq_no"
            class="chat-episode"
            @click="emit('select', message.seq_no)"
          >
            第 {{ message.seq_no }} 集 · 查看原片
          </button>
          <div v-if="message.reply_to" class="chat-quote">
            引用消息 #{{ message.reply_to }}
          </div>
          <p class="chat-body">{{ message.body }}</p>
          <div v-if="message.media_link" class="chat-source">
            <span>
              原片信息：{{
                message.media_link.startsWith('storage:file:')
                  ? '当前视频文件'
                  : '历史/外部视频引用'
              }}
            </span>
            <Button
              size="small"
              type="link"
              @click="emit('select', message.seq_no)"
            >
              查看原片
            </Button>
            <Button
              v-if="message.seq_no"
              size="small"
              type="link"
              @click="emit('updateFile', message.seq_no)"
            >
              更新修改文件
            </Button>
          </div>
          <footer>
            <Button size="small" type="link" @click="quoteMessage(message)">
              引用回复
            </Button>
            <span v-if="message.resolution" class="resolution">
              {{ username(Number(message.resolved_by)) }}：{{
                message.resolution
              }}
            </span>
          </footer>
        </div>
      </article>
    </div>
    <div class="chat-composer">
      <div v-if="quote" class="composer-quote">
        正在回复 #{{ quote.id }} · {{ username(Number(quote.uid)) }}
        <Button type="link" @click="quote = undefined">取消引用</Button>
      </div>
      <div class="composer-tools">
        <Select
          v-model:value="seq"
          :options="
            Array.from(
              {
                length: Math.max(
                  1,
                  Number(view.detail.version.planned_episodes),
                ),
              },
              (_, i) => ({ value: i + 1, label: `第 ${i + 1} 集` }),
            )
          "
          class="w-32"
        />
        <Select
          v-model:value="kind"
          :options="[
            { value: 'comment', label: '自由评论' },
            { value: 'suggestion', label: '修改建议' },
          ]"
          class="w-36"
        />
        <div class="mentions">
          <Button
            v-for="[uid, name] in users"
            :key="uid"
            size="small"
            :type="mentions.includes(Number(uid)) ? 'primary' : 'default'"
            @click="toggleMention(Number(uid))"
          >
            @{{ name }}
          </Button>
        </div>
      </div>
      <TextArea
        v-model:value="body"
        :rows="4"
        :maxlength="4000"
        placeholder="像群聊一样发言：说明问题、引用消息、@剪辑或导演……"
        :disabled="busy"
        @keydown.meta.enter="send"
        @keydown.ctrl.enter="send"
      />
      <footer>
        <small>Ctrl / ⌘ + Enter 发送 · 消息会同步到对应集的审核记录</small>
        <Button
          type="primary"
          :loading="busy"
          :disabled="!body.trim()"
          @click="send"
          v-access:code="'api:res.review.chat.add'"
        >
          发送消息
        </Button>
      </footer>
    </div>
  </section>
</template>
<style scoped>
.review-chat {
  display: flex;
  flex-direction: column;
  min-height: 600px;
  background: #f5f7fa;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: hsl(var(--background));
  border-bottom: 1px solid hsl(var(--border));
}

.chat-header h3 {
  font-size: 18px;
  font-weight: 600;
}

.chat-header p {
  margin-top: 6px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.chat-stream {
  flex: 1;
  max-height: 60vh;
  padding: 20px;
  overflow: auto;
}

.chat-message {
  display: flex;
  gap: 10px;
  max-width: 880px;
  margin: 0 auto 18px;
}

.chat-bubble {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.chat-bubble header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.chat-bubble header span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.chat-episode {
  padding: 3px 8px;
  margin: 10px 0 6px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border: 0;
  border-radius: 5px;
}

.chat-body {
  margin: 6px 0;
  line-height: 1.75;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.chat-quote,
.composer-quote {
  padding: 8px;
  margin: 8px 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 50%);
  border-left: 3px solid hsl(var(--primary));
}

.chat-source {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border));
}

.chat-bubble footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}

.resolution {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.chat-composer {
  padding: 16px;
  background: hsl(var(--background));
  border-top: 1px solid hsl(var(--border));
}

.composer-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.mentions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chat-composer textarea {
  width: 100%;
  resize: vertical;
}

.chat-composer footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 700px) {
  .chat-header,
  .chat-composer footer {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .chat-stream {
    padding: 12px;
  }
}
</style>
