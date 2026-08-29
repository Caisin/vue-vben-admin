import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  ResChapter,
  ResRecord,
} from '#/api/res/seas/global/source_manage';

export const resTypeOptions = [
  { label: '短剧', value: 1 },
  { label: '小说', value: 2 },
];

export const resStateOptions = [
  { label: '上架', value: 1 },
  { label: '下架', value: 0 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'InputNumber', fieldName: 'id', label: 'ID' },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '名称、简介、分类或标签',
      },
      fieldName: 'keyword',
      label: '全文关键字',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: resStateOptions },
      fieldName: 'state',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: resTypeOptions },
      fieldName: 'res_type',
      label: '类型',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<ResRecord> {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    {
      field: 'cover',
      slots: { default: 'cover' },
      title: '封面',
      width: 96,
    },
    { field: 'res_name', fixed: 'left', minWidth: 220, title: '资源名称' },
    {
      field: 'res_type',
      slots: { default: 'resType' },
      title: '类型',
      width: 90,
    },
    {
      field: 'lang_info',
      minWidth: 180,
      showOverflow: false,
      slots: { default: 'languages' },
      title: '章节语言',
    },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 90,
    },
    { field: 'heat_num', title: '热度', width: 100 },
    {
      field: 'category',
      minWidth: 240,
      showOverflow: false,
      slots: { default: 'category' },
      title: '分类/标签',
    },
    {
      field: 'ad_cfg',
      minWidth: 180,
      slots: { default: 'adConfig' },
      title: '广告配置',
    },
    {
      field: 'remark',
      minWidth: 160,
      showOverflow: 'tooltip',
      title: '备注',
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 150,
    },
  ];
}

export function useChapterColumns(): VxeTableGridColumns<ResChapter> {
  return [
    { field: 'id', title: 'ID', width: 80 },
    { field: 'seq_no', title: '集数', width: 80 },
    { field: 'title', minWidth: 180, title: '标题' },
    { field: 'price', title: '价格', width: 100 },
    {
      field: 'url',
      minWidth: 260,
      showOverflow: 'tooltip',
      title: '播放地址',
    },
    {
      align: 'right',
      field: 'operation',
      slots: { default: 'operation' },
      title: '操作',
      width: 90,
    },
  ];
}
