interface ControlState {
  state: string;
  schedule_paused: boolean;
  active_run_id?: null | number;
  active_task_id?: null | number;
}

/** 页面只展示当前状态需要的控制；提交前仍由服务端预检与授权校验。 */
export function syncActions(record: ControlState) {
  const ready = ['paused', 'ready'].includes(record.state);
  const active = !!(record.active_run_id || record.active_task_id);
  return {
    start: ready && !active,
    stop: record.state === 'running' || (ready && !record.schedule_paused),
    forceStop: active && ['cancelling', 'running'].includes(record.state),
    reconcile: record.state === 'blocked',
  };
}
