<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { MembershipPlan } from '#/api/asset/membership';
import type { MembershipPlanFormValues } from '#/views/asset/catalog-form';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MembershipApi } from '#/api/asset/membership';
import {
  decodeMembershipPlan,
  encodeMembershipPlan,
} from '#/views/asset/catalog-form';

const emit = defineEmits<{ success: [] }>();
const formData = ref<MembershipPlan>();

const renewalPolicyOptions = [
  { label: '从当前有效期末继续叠加', value: 'stack_from_current_end' },
];

const transitionPolicyOptions = [
  { label: '当前周期结束后切换', value: 'replace_at_period_end' },
  { label: '立即替换当前计划', value: 'replace_immediately' },
];

const schema: VbenFormSchema<MembershipPlanFormValues>[] = [
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'membership_type_id',
    label: '会员类型 ID',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'code',
    label: '计划编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '计划名称',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'tier_rank',
    label: '等级',
    rules: 'required',
  },
  {
    component: 'Switch',
    defaultValue: true,
    fieldName: 'enabled',
    label: '启用',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      options: renewalPolicyOptions,
    },
    defaultValue: 'stack_from_current_end',
    fieldName: 'policy.renewal',
    help: '续期从当前有效期结束时间继续叠加，避免仍在有效期内时损失剩余时长。',
    label: '续期策略',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      options: transitionPolicyOptions,
    },
    defaultValue: 'replace_at_period_end',
    fieldName: 'policy.transition',
    help: '决定同一会员类型切换计划时立即生效，还是保留当前已购周期后再切换。',
    label: '计划切换策略',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'policy.grace_seconds',
    help: '计划到期后仅对明确允许宽限的权益继续生效，0 表示不设置宽限期。',
    label: '宽限秒数',
    rules: 'required',
  },
  {
    arrayProps: {
      addButtonText: '添加权益',
      createRow: () => ({
        entitlement_code: '',
        grace_allowed: false,
        parameters: '{}',
      }),
      emptyText: '尚未配置计划权益',
    },
    children: [
      {
        component: 'Input',
        fieldName: 'entitlement_code',
        label: '权益编码',
        rules: 'required',
      },
      {
        component: 'Switch',
        defaultValue: false,
        fieldName: 'grace_allowed',
        label: '允许宽限',
      },
      {
        component: 'JsonEditor',
        componentProps: {
          maxHeight: '240px',
          minHeight: '120px',
          valueMode: 'text',
        },
        defaultValue: '{}',
        fieldName: 'parameters',
        help: '仅填写该权益自行定义的动态参数；没有参数时保持 {}。',
        label: '动态参数',
        rules: 'required',
      },
    ],
    defaultValue: [],
    fieldName: 'entitlements',
    formItemClass: 'col-span-full',
    help: '每个权益编码在计划内只能出现一次；宽限只影响明确勾选的权益。',
    label: '计划权益',
    type: 'array',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 3 } },
    fieldName: 'intro',
    formItemClass: 'md:col-span-2',
    label: '说明',
  },
];

const [Form, formApi] = useVbenForm<MembershipPlanFormValues>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<MembershipPlan>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const { entitlements, plan } = encodeMembershipPlan(
        await formApi.getValues(),
      );
      const planId = formData.value?.id;
      const saved = planId
        ? await MembershipApi.updatePlan(planId, plan)
        : await MembershipApi.createPlan(plan);
      await MembershipApi.replaceEntitlements(planId ?? saved.id, entitlements);
      message.success('保存成功');
      drawerApi.close();
      emit('success');
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error('JSON 字段格式不正确');
        return;
      }
      throw error;
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    formData.value = data?.id ? data : undefined;
    await formApi.reset();
    if (formData.value) {
      const entitlements = await MembershipApi.entitlements(formData.value.id);
      await formApi.setValues(
        decodeMembershipPlan(formData.value, entitlements),
      );
    } else {
      await formApi.setValues({
        entitlements: [],
        policy: {
          grace_seconds: 0,
          renewal: 'stack_from_current_end',
          transition: 'replace_at_period_end',
        },
      });
    }
  },
});

const drawerTitle = computed(() =>
  formData.value?.id ? '编辑会员计划' : '新建会员计划',
);
</script>

<template>
  <Drawer class="w-full max-w-260" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
