export const actionLabels: Record<string, string> = {
  discover: '发现源表',
  confirm: '确认表配置',
  inspect: '检查结构',
  activate: '确认建表并启用',
  sync: '同步一次',
  reconcile: '回执对账',
  pause: '暂停后续调度',
  resume: '恢复后续调度',
  cancel: '取消当前运行',
  force_stop: '强制停止',
};
export const operationStates: Record<string, string> = {
  pending: '等待执行',
  dispatching: '正在提交',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  blocked: '需核对或对账',
  cancelled: '已取消',
};
export const recoveryAdvice: Record<string, string> = {
  data_sync_table_plan_not_activated: '逐表配置尚未启用，请检查结构并确认启用后重试。',

  data_sync_preflight_stale: '配置或状态已变化。重新预检并确认，不沿用旧计划。',
  data_sync_action_unavailable: '当前状态不允许此操作，请重新预检查看原因。',
  data_sync_operation_forbidden: '权限已变化，请联系管理员确认操作权限。',
  data_sync_dispatch_outcome_unknown:
    '子任务提交结果尚未确认。核对运行记录后处理，不能直接重发。',
  data_sync_database_busy: '所属全库正在运行或存在待对账批次，请等待或先对账。',
  data_sync_job_busy: '任务仍有运行占用，请检查当前运行与待对账批次。',
  data_sync_commit_unknown:
    '远端提交结果未知，请先回执对账，禁止直接重复同步。',
  data_sync_source_schema_drift: '源结构发生变化，请检查映射并重新确认结构。',
  data_sync_target_schema_drift: '目标结构发生变化，请核对目标合同并重新检查。',
  data_sync_cancelled: '当前操作已取消，已提交数据保留。',
};
export function operationProgress(op: {
  total: number;
  succeeded: number;
  failed: number;
}) {
  return op.total > 0
    ? Math.min(
        100,
        Math.round(
          ((Number(op.succeeded) + Number(op.failed)) * 100) / Number(op.total),
        ),
      )
    : 0;
}
export function operationActive(state: string) {
  return ['dispatching', 'pending', 'running'].includes(state);
}
