import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MallProduct, MallSku } from '#/api/mall';

import { MallAdminApi } from '#/api/mall';
import { Times } from '#/times';

import {
  buildCategoryTree,
  fulfillmentTypeOptions,
  mallStatusOptions,
  mallStatusSelectOptions,
} from '../shared';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'keyword', label: '商品名称' },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        api: MallAdminApi.categories,
        afterFetch: buildCategoryTree,
        allowClear: true,
        class: 'w-full',
        labelField: 'name',
        showSearch: true,
        treeDefaultExpandAll: true,
        valueField: 'id',
      },
      fieldName: 'category_id',
      label: '商品类目',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: mallStatusSelectOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<MallProduct>,
): VxeTableGridColumns<MallProduct> {
  return [
    {
      field: 'code',
      fixed: 'left',
      sortable: true,
      title: '商品编码',
      width: 150,
    },
    {
      field: 'name',
      fixed: 'left',
      minWidth: 220,
      slots: { default: 'nameCell' },
      title: '商品名称',
    },
    { field: 'category_id', sortable: true, title: '类目 ID', width: 110 },
    {
      cellRender: { name: 'CellTag', options: mallStatusOptions },
      field: 'status',
      sortable: true,
      title: '状态',
      width: 100,
    },
    {
      field: 'featured',
      slots: { default: 'featuredCell' },
      title: '推荐',
      width: 80,
    },
    { field: 'cover_file_id', title: '封面文件 ID', width: 130 },
    {
      field: 'published_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.published_at),
      sortable: true,
      title: '发布时间',
      width: 180,
    },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.created_at),
      sortable: true,
      title: '创建时间',
      width: 180,
    },
    {
      align: 'right',
      cellRender: {
        attrs: { nameField: 'name', onClick: onActionClick },
        name: 'CellOperation',
        options: [
          { auth: 'mall:product:write', code: 'skus', text: 'SKU' },
          { auth: 'mall:product:publish', code: 'publish', text: '发布' },
          { auth: 'mall:product:publish', code: 'unpublish', text: '下架' },
          { auth: 'mall:product:write', code: 'edit', text: '编辑' },
          {
            auth: 'mall:product:write',
            code: 'delete',
            danger: true,
            text: '删除',
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 280,
    },
  ];
}

export function useSkuColumns(
  onActionClick: OnActionClickFn<MallSku>,
): VxeTableGridColumns<MallSku> {
  return [
    { field: 'code', fixed: 'left', title: 'SKU 编码', width: 150 },
    {
      field: 'name',
      minWidth: 180,
      slots: { default: 'skuNameCell' },
      title: 'SKU 名称',
    },
    { field: 'points_price', sortable: true, title: '积分价', width: 100 },
    {
      cellRender: { name: 'CellTag', options: fulfillmentTypeOptions },
      field: 'fulfillment_type',
      title: '履约',
      width: 110,
    },
    {
      cellRender: { name: 'CellTag', options: mallStatusOptions },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'per_user_limit', title: '限兑', width: 90 },
    {
      field: 'specs',
      slots: { default: 'specsCell' },
      title: '规格',
      minWidth: 220,
    },
    {
      align: 'right',
      cellRender: {
        attrs: { nameField: 'name', onClick: onActionClick },
        name: 'CellOperation',
        options: [
          { auth: 'mall:product:write', code: 'edit', text: '编辑' },
          {
            auth: 'mall:product:write',
            code: 'delete',
            danger: true,
            text: '删除',
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 130,
    },
  ];
}
