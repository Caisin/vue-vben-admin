<script setup lang="ts">
import type { RenewalContact } from '#/api/developer-account';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
} from 'antdv-next';

import { DeveloperAccountApi } from '#/api/developer-account';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{ readonly?: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const model = defineModel<null | number | string>();
const { hasAccessByCodes } = useAccess();
const contacts = ref<RenewalContact[]>([]);
const current = computed(() =>
  contacts.value.find((c) => String(c.id) === String(model.value)),
);
const loading = ref(false);
const errorText = ref('');
const open = ref(false);
const editing = ref<RenewalContact>();
const name = ref('');
const phone = ref('');
const remark = ref('');
const saving = ref(false);
const saveError = ref('');
const canCreate = computed(() =>
  hasAccessByCodes(['developer-account:create', 'developer-account:update']),
);
const canEdit = computed(
  () =>
    hasAccessByCodes(['developer-account:update']) && current.value?.can_edit,
);
async function load() {
  loading.value = true;
  try {
    contacts.value = await DeveloperAccountApi.renewalContacts();
    errorText.value = '';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取续费人失败，请重试');
  } finally {
    loading.value = false;
  }
}
function edit(contact?: RenewalContact) {
  editing.value = contact;
  name.value = contact?.name || '';
  phone.value = contact?.phone || '';
  remark.value = contact?.remark || '';
  saveError.value = '';
  open.value = true;
}
async function save() {
  if (!name.value.trim() || saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const payload = {
      name: name.value.trim(),
      phone: phone.value.trim(),
      remark: remark.value.trim(),
      expected_version: editing.value?.version,
    };
    const saved = editing.value
      ? await DeveloperAccountApi.updateRenewalContact(
          editing.value.id,
          payload,
        )
      : await DeveloperAccountApi.createRenewalContact(payload);
    contacts.value = [
      ...contacts.value.filter((c) => String(c.id) !== String(saved.id)),
      saved,
    ];
    model.value = saved.id;
    open.value = false;
    message.success('续费人已保存并选中，请保存账户完成关联');
    emit('changed');
  } catch (error) {
    saveError.value = requestErrorMessage(
      error,
      '保存续费人失败，请刷新后重试',
    );
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <template v-if="readonly">
      <span>{{ current?.name || (model ? '资料不可用' : '未设置') }}</span>
      <span v-if="current?.phone" class="ml-3">{{ current.phone }}</span>
      <p v-if="current?.remark" class="text-muted-foreground">
        {{ current.remark }}
      </p>
    </template>
    <template v-else>
      <Space wrap class="w-full">
        <Select
          :value="model == null ? undefined : String(model)"
          allow-clear
          show-search
          option-filter-prop="label"
          :loading="loading"
          class="!min-w-56"
          placeholder="选择续费人（可与认证人不同）"
          :options="
            contacts.map((c) => ({
              value: String(c.id),
              label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}`,
            }))
          "
          @change="
            (value) => {
              model = value == null ? null : String(value);
            }
          "
        />
        <Button v-if="canCreate" @click="edit()">新增续费人</Button>
        <Button v-if="canEdit" :disabled="!current" @click="edit(current)">
          编辑续费人
        </Button>
        <Button :loading="loading" @click="load">刷新</Button>
      </Space>
      <p class="mt-1 text-xs text-muted-foreground">
        续费人独立于认证人；编辑资料会同步到关联该续费人的账户。
      </p>
    </template>
    <Alert v-if="errorText" type="error" :message="errorText" class="mt-2" />
    <Modal
      :open="open"
      :title="editing ? '编辑续费人' : '新增续费人'"
      :width="520"
      :z-index="1200"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: !name.trim() }"
      :mask-closable="false"
      @ok="save"
      @cancel="open = false"
    >
      <Form layout="vertical">
        <FormItem label="续费人姓名" required>
          <Input
            v-model:value="name"
            placeholder="输入续费人姓名"
            :maxlength="100"
          />
        </FormItem>
        <FormItem label="续费人电话">
          <Input
            v-model:value="phone"
            placeholder="输入续费人电话"
            :maxlength="64"
          />
        </FormItem>
        <FormItem label="备注">
          <Input.TextArea v-model:value="remark" :maxlength="1000" :rows="3" />
        </FormItem>
      </Form>
      <Alert v-if="saveError" type="error" :message="saveError" />
    </Modal>
  </div>
</template>
