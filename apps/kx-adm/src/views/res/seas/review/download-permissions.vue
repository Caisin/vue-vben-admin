<script setup lang="ts">
import type { GrantResource } from '#/api/res/grant-maintenance';
import type { Id } from '#/api/res/versions';

import { ref, watch } from 'vue';

import { Alert, Button, Modal, Spin } from 'antdv-next';

import { deliveryApi } from '#/api/res/delivery';
import { reviewApi } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';

import GrantManager from '../download-authorizations/modules/grant-manager.vue';
const props = defineProps<{ scope: Id; version: Id }>();
const open = ref(false);
const loading = ref(false);
const errorText = ref('');
const resource = ref<GrantResource>();
let generation = 0;
async function load() {
  const ticket = ++generation;
  loading.value = true;
  resource.value = undefined;
  errorText.value = '';
  try {
    const [subject, versions, materials] = await Promise.all([
      reviewApi.resource(props.scope),
      reviewApi.versions(props.scope),
      deliveryApi.materials(props.scope),
    ]);
    if (ticket !== generation) return;
    resource.value = {
      res_id: Number(props.scope),
      name: subject.res_name,
      code: subject.resource_code,
      versions: [
        ...versions.map((v) => ({
          id: Number(v.id),
          name: v.name,
          kind: v.delivery_kind,
        })),
        {
          id: Number(materials.version_id),
          name: '项目资料',
          kind: 'materials',
        },
      ],
    };
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取项目授权信息失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
watch(
  () => [props.scope, props.version],
  () => {
    if (open.value) void load();
  },
);
</script>
<template>
  <Button
    v-access:code="'api:res.delivery.grants.maintenance.page'"
    @click="
      open = true;
      load();
    "
  >
    下载权限
  </Button>
  <Modal
    v-model:open="open"
    title="交付材料下载权限"
    get-container="body"
    width="min(1440px,96vw)"
    :footer="null"
    :destroy-on-hidden="true"
  >
    <Spin :spinning="loading">
      <Alert v-if="errorText" type="error" :message="errorText">
        <template #action><Button @click="load">重试</Button></template>
      </Alert>
      <GrantManager
        v-if="resource"
        :key="`${scope}:${version}`"
        delivery
        :fixed-resource="resource"
        :fixed-version="Number(version)"
      />
    </Spin>
  </Modal>
</template>
