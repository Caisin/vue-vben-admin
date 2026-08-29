import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  DingtalkCustomRobotCfg,
  DingtalkGroupBotCfg,
  DingtalkKnowledgeTargetCfg,
  DingtalkKnowledgeTargetStatus,
} from '#/api/param';

export const knowledgeTargetStatusOptions: Array<{
  label: string;
  value: DingtalkKnowledgeTargetStatus;
}> = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
];

type SelectOption = { label: string; value: string };

export function useCustomFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'robot_code_prefix', label: '机器人编码' },
  ];
}

export function useGroupFormSchema(
  appOptions: SelectOption[],
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: { allowClear: true, options: appOptions },
      fieldName: 'app_key',
      label: '钉钉应用',
    },
    { component: 'Input', fieldName: 'bot_code_prefix', label: '配置编码' },
  ];
}

export function useKnowledgeFormSchema(
  appOptions: SelectOption[],
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: { allowClear: true, options: appOptions },
      fieldName: 'app_key',
      label: '钉钉应用',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: knowledgeTargetStatusOptions,
      },
      fieldName: 'status',
      label: '状态',
    },
    { component: 'Input', fieldName: 'target_code_prefix', label: '目标编码' },
  ];
}

export function groupBotColumns(): VxeTableGridColumns<DingtalkGroupBotCfg> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      field: 'bot_name',
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'groupBotName' },
      sortable: true,
      title: '名称',
    },
    { field: 'bot_code', minWidth: 170, sortable: true, title: '配置编码' },
    { field: 'app_key', minWidth: 160, sortable: true, title: '应用 AppKey' },
    { field: 'robot_code', minWidth: 170, title: '机器人编码' },
    {
      field: 'open_conversation_id',
      minWidth: 220,
      sortable: true,
      title: '群会话 ID',
    },
    {
      field: 'updated_at',
      slots: { default: 'updatedAt' },
      sortable: true,
      title: '更新时间',
      width: 180,
    },
  ];
}

export function customRobotColumns(): VxeTableGridColumns<DingtalkCustomRobotCfg> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      field: 'robot_name',
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'customRobotName' },
      sortable: true,
      title: '名称',
    },
    { field: 'robot_code', minWidth: 170, sortable: true, title: '配置编码' },
    {
      field: 'open_conversation_id',
      minWidth: 220,
      sortable: true,
      title: '群会话 ID',
    },
    { field: 'webhook_url_masked', minWidth: 280, title: 'Webhook 摘要' },
    {
      field: 'secret_configured',
      slots: { default: 'secretConfigured' },
      title: '加签',
      width: 90,
    },
    { field: 'keyword', minWidth: 140, title: '关键字' },
    {
      field: 'updated_at',
      slots: { default: 'updatedAt' },
      sortable: true,
      title: '更新时间',
      width: 180,
    },
  ];
}

export function knowledgeTargetColumns(
  onStatusChange?: (
    status: DingtalkKnowledgeTargetStatus,
    row: DingtalkKnowledgeTargetCfg,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<DingtalkKnowledgeTargetCfg> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      field: 'target_name',
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'knowledgeTargetName' },
      sortable: true,
      title: '目标名称',
    },
    { field: 'target_code', minWidth: 170, sortable: true, title: '目标编码' },
    { field: 'app_key', minWidth: 160, sortable: true, title: '应用 AppKey' },
    {
      field: 'workspace_id',
      minWidth: 220,
      sortable: true,
      title: '知识库 ID',
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
        props: { checkedValue: 'enabled', unCheckedValue: 'disabled' },
      },
      field: 'status',
      sortable: true,
      title: '状态',
      width: 90,
    },
    {
      field: 'last_verified_at',
      slots: { default: 'lastVerifiedAt' },
      sortable: true,
      title: '最近校验',
      width: 180,
    },
    {
      field: 'updated_at',
      slots: { default: 'updatedAt' },
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'knowledgeTargetOperation' },
      title: '操作',
      width: 100,
    },
  ];
}
