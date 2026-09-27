import type { RoleAccess, RolePermission } from '#/api/vestige';

import { computed, onScopeDispose, ref } from 'vue';

import { VestigeApi } from '#/api/vestige';
import { requestErrorMessage } from '#/request-errors';

export const permissionLabels: Record<RolePermission, string> = {
  contributor: '贡献者',
  owner: '管理者',
  publisher: '发布者',
  viewer: '只读成员',
};
export const statusLabels: Record<string, string> = {
  ready: '已就绪',
  provisioning: '准备中',
  archived: '已归档',
  failed: '准备失败',
};
/** 角色切换时立刻撤下旧权限；过期请求不能把另一角色的操作权限放回页面。 */
export function useRoleAccess(
  load: (id: string) => Promise<RoleAccess> = VestigeApi.access,
) {
  const id = ref('');
  const value = ref<RoleAccess>();
  const loading = ref(false);
  const errorText = ref('');
  let generation = 0;
  function clear() {
    generation++;
    id.value = '';
    value.value = undefined;
    loading.value = false;
    errorText.value = '';
  }
  async function select(role: string) {
    const current = ++generation;
    id.value = role;
    value.value = undefined;
    errorText.value = '';
    loading.value = true;
    try {
      const result = await load(role);
      if (current !== generation) return;
      if (result.role.id !== role)
        throw new Error('角色响应不匹配，请重新打开详情');
      value.value = result;
    } catch (error) {
      if (current === generation)
        errorText.value = requestErrorMessage(error, '角色权限加载失败');
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  onScopeDispose(clear);
  return {
    id,
    value,
    loading,
    error: errorText,
    clear,
    select,
    canManage: computed(() => value.value?.permission === 'owner'),
    canCopy: computed(() => value.value?.can_copy === true),
  };
}
