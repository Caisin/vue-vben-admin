import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  ArticleDoc,
  ArticleState,
  ArticleThemeView,
  ArticleVisibility,
} from '#/api/article';

import { Times } from '#/times';

export const visibilityOptions: Array<{
  color: string;
  label: string;
  value: ArticleVisibility;
}> = [
  { color: 'success', label: '公开', value: 'public' },
  { color: 'warning', label: '密码', value: 'password' },
];

export const stateOptions: Array<{
  color: string;
  label: string;
  value: ArticleState;
}> = [
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'success', label: '已发布', value: 'published' },
  { color: 'warning', label: '已取消', value: 'unpublished' },
];

export function useGridFormSchema(
  themeOptions: () => Array<{ label: string; value: string }>,
): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'title', label: '标题' },
    { component: 'Input', fieldName: 'slug', label: 'Slug' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'state',
      label: '发布状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: visibilityOptions },
      fieldName: 'visibility',
      label: '访问方式',
    },
    {
      component: 'Select',
      componentProps: () => ({ allowClear: true, options: themeOptions() }),
      fieldName: 'theme_code',
      label: '主题',
    },
    { component: 'Input', fieldName: 'created_by', label: '创建人 ID' },
  ];
}

export function themeOptions(themes: ArticleThemeView[]) {
  return themes.map((theme) => ({
    label: `${theme.name} (${theme.version})`,
    value: theme.code,
  }));
}

export function useColumns(
  onActionClick: OnActionClickFn<ArticleDoc>,
): VxeTableGridColumns<ArticleDoc> {
  return [
    {
      field: 'title',
      fixed: 'left',
      minWidth: 240,
      slots: { default: 'titleCell' },
      title: '标题',
    },
    {
      cellRender: { name: 'CellTag', options: visibilityOptions },
      field: 'visibility',
      title: '访问方式',
      width: 100,
    },
    { field: 'theme_code', title: '主题', width: 130 },
    {
      cellRender: { name: 'CellTag', options: stateOptions },
      field: 'state',
      title: '发布状态',
      width: 110,
    },
    { field: 'current_release_id', title: '当前版本', width: 110 },
    {
      field: 'slug',
      slots: { default: 'slugCell' },
      title: '公开地址',
      width: 220,
    },
    {
      field: 'updated_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.updated_at),
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    {
      align: 'right',
      cellRender: {
        attrs: { nameField: 'title', onClick: onActionClick },
        name: 'CellOperation',
        options: [
          { code: 'preview', text: '预览' },
          { code: 'publish', text: '发布' },
          { code: 'history', text: '发布记录' },
          { code: 'unpublish', text: '取消发布' },
          { code: 'delete', text: '删除' },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 260,
    },
  ];
}
