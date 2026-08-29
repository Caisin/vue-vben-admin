import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'task_title.contains', label: '任务名称' },
    { component: 'Input', fieldName: 'event_name.contains', label: '事件名称' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '新手任务', value: 1 },
          { label: '日常任务', value: 2 },
        ],
      },
      fieldName: 'task_type.eq',
      label: '任务类型',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '正常', value: 1 },
          { label: '停用', value: 0 },
        ],
      },
      fieldName: 'state.eq',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'cfg.task_title', minWidth: 220, title: '任务名称' },
    { field: 'cfg.event_name', title: '事件名称', width: 120 },
    {
      field: 'cfg.task_type',
      slots: { default: 'taskType' },
      title: '任务类型',
      width: 120,
    },
    { field: 'cfg.reward', title: '任务奖励', width: 100 },
    {
      field: 'cfg.state',
      slots: { default: 'state' },
      title: '状态',
      width: 100,
    },
    {
      field: 'cfg.lang',
      slots: { default: 'lang' },
      title: '多语言名称',
      width: 360,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: 100,
    },
  ];
}
