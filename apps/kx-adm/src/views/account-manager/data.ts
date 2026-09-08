import type { FieldKind } from '#/api/account-manager';

import { requestErrorMessage } from '#/request-errors';

export const fieldKinds: { label: string; value: FieldKind }[] = [
  { label: '文本', value: 'text' },
  { label: '多行文本', value: 'textarea' },
  { label: '网址', value: 'url' },
  { label: '邮箱', value: 'email' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '开关', value: 'boolean' },
  { label: '选择项', value: 'select' },
  { label: '密码', value: 'password' },
];
export function accountError(error: unknown) {
  const code = requestErrorMessage(error, '操作失败，请稍后重试');
  const messages: Record<string, string> = {
    account_type_version_conflict:
      '账户类型已更新，请关闭并重新打开表单后填写。',
    account_version_conflict: '账户已被修改或删除，请刷新后重试。',
    account_not_found: '账户不存在或没有访问权限。',
    account_type_disabled: '该账户类型已停用，不能新建账户。',
    account_type_create_failed: '账户类型创建失败，请检查类型编码是否重复。',
    account_type_code_invalid:
      '类型编码需以小写字母开头，仅包含小写字母、数字和下划线。',
    account_type_name_invalid: '请填写有效的类型名称。',
    account_name_invalid: '请填写账户名称。',
    account_field_definition_immutable:
      '已保存字段的数据类型和敏感设置不能更改，请新增字段并停用旧字段。',
    account_values_too_large: '账户字段内容过长，总大小不能超过 16 KiB。',
    credential_master_key_unavailable:
      '账户加密服务暂不可用，请联系管理员检查服务配置。',
  };
  if (code.startsWith('account_field_required:'))
    return `请填写必填字段：${code.split(':').slice(1).join(':')}`;
  if (code.startsWith('account_field_value_invalid:'))
    return `字段格式不正确：${code.split(':').slice(1).join(':')}`;
  return messages[code] ?? code;
}
