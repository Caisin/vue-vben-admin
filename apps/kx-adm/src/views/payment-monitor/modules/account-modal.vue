<script setup lang="ts">
import type { Account, AccountWrite } from '#/api/payment-monitor';

import { ref, watch } from 'vue';

import {
  Alert,
  Divider,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
} from 'antdv-next';

import { PaymentApi } from '#/api/payment-monitor';

import { defaultPolicy } from './format';
const props = defineProps<{ account?: Account }>();
const emit = defineEmits<{ saved: [] }>();
const open = defineModel<boolean>('open', { required: true });
const busy = ref(false);
const form = ref<AccountWrite>({
  provider: 'stripe',
  name: '',
  connected_account: '',
  livemode: true,
  enabled: true,
  interval_seconds: 900,
  history_days: 180,
  policy: defaultPolicy(),
});
const key = ref('');
const channels = ref<{ label: string; value: number | string }[]>([]);
watch(open, async (value) => {
  if (!value) return;
  const a = props.account;
  key.value = '';
  form.value = a
    ? {
        provider: a.provider,
        name: a.name,
        connected_account: a.connected_account,
        livemode: a.livemode,
        enabled: a.enabled,
        interval_seconds: a.interval_seconds,
        history_days: a.history_days,
        policy: { ...a.policy },
        expected_version: a.version,
      }
    : {
        provider: 'stripe',
        name: '',
        connected_account: '',
        livemode: true,
        enabled: true,
        interval_seconds: 900,
        history_days: 180,
        policy: defaultPolicy(),
      };
  const availableChannels = await PaymentApi.channels();
  channels.value = availableChannels.map((c) => ({
    label: c.name,
    value: c.id,
  }));
});
async function save() {
  if (!form.value.name.trim() || (!props.account && !key.value.trim())) {
    message.warning('请填写账户名称和 API 密钥');
    return;
  }
  busy.value = true;
  try {
    await PaymentApi.save(
      { ...form.value, api_key: key.value.trim() || undefined },
      props.account?.id,
    );
    key.value = '';
    message.success('账户与预警规则已保存');
    open.value = false;
    emit('saved');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="account ? '配置账户与预警规则' : '接入支付账户'"
    :width="960"
    :confirm-loading="busy"
    @ok="save"
    @cancel="open = false"
  >
    <Alert
      type="info"
      show-icon
      message="仅通过官方只读 API 采集，不自动退款或操作资金。密钥加密保存，编辑留空表示不更换。"
      class="mb-4"
    />
    <Form layout="vertical">
      <div class="grid grid-cols-1 gap-x-5 md:grid-cols-2">
        <FormItem label="账户名称" required>
          <Input v-model:value="form.name" placeholder="公司/站点/用途" />
        </FormItem>
        <FormItem label="支付商">
          <Select
            v-model:value="form.provider"
            :disabled="!!account"
            :options="[{ label: 'Stripe', value: 'stripe' }]"
          />
        </FormItem>
        <FormItem label="生产环境">
          <Switch
            v-model:checked="form.livemode"
            :disabled="!!account"
            checked-children="生产"
            un-checked-children="测试"
          />
        </FormItem>
        <FormItem label="启用定时采集">
          <Switch v-model:checked="form.enabled" />
        </FormItem>
        <FormItem label="API 密钥" :required="!account">
          <Input.Password
            v-model:value="key"
            autocomplete="new-password"
            placeholder="优先配置 rk_live_ 受限只读密钥"
          />
        </FormItem>
        <FormItem label="Connect 子账户（独立账号留空）">
          <Input
            v-model:value="form.connected_account"
            :disabled="!!account"
            placeholder="acct_..."
          />
        </FormItem>
        <FormItem label="采集间隔（秒，至少300）">
          <InputNumber
            v-model:value="form.interval_seconds"
            :min="300"
            :max="86400"
            class="!w-full"
          />
        </FormItem>
        <FormItem label="首次回溯天数（建议至少180天）">
          <InputNumber
            v-model:value="form.history_days"
            :min="1"
            :max="3650"
            class="!w-full"
          />
        </FormItem>
      </div>
      <Divider>风险阈值与通知</Divider>
      <FormItem label="Visa 监控区域（请按收单区域核实）">
        <Select
          v-model:value="form.policy.visa_region"
          :options="[
            { label: '未确认（不判定区域阈值）', value: 'unconfirmed' },
            { label: '非 CEMEA', value: 'standard' },
            { label: 'CEMEA', value: 'cemea' },
          ]"
        />
      </FormItem>
      <Alert
        type="warning"
        show-icon
        message="比例单位为基点：50 = 0.50%，100 = 1%。这是内部预警线，不是支付商冻结资金或卡组织正式认定的阈值。"
        class="mb-4"
      />
      <div class="grid grid-cols-1 gap-x-5 md:grid-cols-3">
        <FormItem label="关注争议发生率（bp）">
          <InputNumber
            v-model:value="form.policy.watch_bps"
            :min="1"
            :max="10000"
          />
        </FormItem>
        <FormItem label="高风险争议发生率（bp）">
          <InputNumber
            v-model:value="form.policy.high_bps"
            :min="1"
            :max="10000"
          />
        </FormItem>
        <FormItem label="紧急争议发生率（bp）">
          <InputNumber
            v-model:value="form.policy.critical_bps"
            :min="1"
            :max="10000"
          />
        </FormItem>
        <FormItem label="比例预警最少成功卡支付数">
          <InputNumber
            v-model:value="form.policy.min_payments"
            :min="1"
            :max="1000000"
          />
        </FormItem>
        <FormItem label="比例预警最少争议数">
          <InputNumber
            v-model:value="form.policy.min_disputes"
            :min="1"
            :max="10000"
          />
        </FormItem>
        <FormItem label="早期欺诈预警件数">
          <InputNumber
            v-model:value="form.policy.efw_count"
            :min="1"
            :max="10000"
          />
        </FormItem>
        <FormItem label="举证截止提前预警（小时）">
          <InputNumber
            v-model:value="form.policy.deadline_hours"
            :min="1"
            :max="720"
          />
        </FormItem>
        <FormItem label="数据陈旧预警（小时）">
          <InputNumber
            v-model:value="form.policy.stale_hours"
            :min="1"
            :max="168"
          />
        </FormItem>
        <FormItem label="同级同类告警间隔（小时）">
          <InputNumber
            v-model:value="form.policy.cooldown_hours"
            :min="1"
            :max="168"
          />
        </FormItem>
      </div>
      <FormItem label="预警通知通道">
        <Select
          v-model:value="form.policy.channel_id"
          allow-clear
          :options="channels"
          placeholder="留空只在后台告警；钉钉、邮件等渠道在通知管理配置"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
