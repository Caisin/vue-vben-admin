import type { DescriptionsItemType } from '@vben/common-ui';

import type { HomePageTreeOption } from '../home-page-options';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  NotifyChannel,
  SystemDept,
  SystemUser,
  WeeklyReportRepublishRequest,
} from '#/api';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { SystemDeptApi } from '#/api';
import { $t } from '#/locales';
import { Times } from '#/times';
import { prependTreeOption } from '#/tree-select';

export function useWeeklyReportRepublishSchema(
  channels: NotifyChannel[],
): VbenFormSchema<WeeklyReportRepublishRequest>[] {
  return [
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        optionFilterProp: 'label',
        options: channels.map((item) => ({
          label: `${item.channel_name} / ${
            item.channel_type === 'dingtalk_custom_robot'
              ? '自定义群机器人'
              : '企业群机器人'
          } (${item.channel_code})`,
          value: Number(item.id),
        })),
        placeholder: '请选择钉钉消息通道',
        showSearch: true,
      },
      fieldName: 'channel_id',
      help: '本次重新推送使用的群机器人通道，不改变原钉钉周报文档。',
      label: '消息推送通道',
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: '链接卡片', value: 'link_card' },
          { label: '按钮卡片', value: 'action_card' },
          { label: 'Markdown', value: 'markdown' },
        ],
      },
      fieldName: 'notification_style',
      help: '主消息按所选样式发送，随后单独发送一条全员填写提醒。',
      label: '消息样式',
      rules: 'required',
    },
  ];
}

export function useFormSchema(
  resolveHomeOptions: (values: Readonly<SystemUser>) => HomePageTreeOption[],
): VbenFormSchema<SystemUser>[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.user.name'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      componentProps: {
        allowClear: true,
        placeholder: '留空则由服务端生成 12 位随机密码',
      },
      fieldName: 'password',
      help: '仅新建用户时使用，创建成功后明文只展示一次。',
      label: '初始密码',
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: SystemDeptApi.list,
        afterFetch: (items: SystemDept[]) =>
          prependTreeOption(items, {
            id: '0',
            name: '未分配部门',
            status: 1,
          }),
        class: 'w-full',
        labelField: 'name',
        valueField: 'id',
        childrenField: 'children',
      },
      fieldName: 'deptId',
      label: $t('system.user.dept'),
    },
    {
      component: 'TreeSelect',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        multiple: true,
        optionFilterProp: 'label',
        treeData: [],
        placeholder: '请选择角色',
        showSearch: true,
      },
      fieldName: 'roles',
      label: $t('system.user.roles'),
    },
    {
      component: 'Input',
      fieldName: 'permissions',
      formItemClass: 'items-start',
      label: '权限授权',
      modelPropName: 'modelValue',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        placeholder: '未配置时继承角色默认页或进入我的信息',
        showSearch: true,
        treeDefaultExpandAll: true,
        treeNodeFilterProp: 'label',
      },
      dependencies: {
        resolve: ({ values }) => ({
          componentProps: {
            allowClear: true,
            class: 'w-full',
            placeholder: '未配置时继承角色默认页或进入我的信息',
            showSearch: true,
            treeData: resolveHomeOptions(values),
            treeDefaultExpandAll: true,
            treeNodeFilterProp: 'label',
          },
        }),
        triggerFields: ['permissions', 'roles'],
      },
      fieldName: 'homePermId',
      label: '登录默认页面',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '姓名、手机、邮箱或备注',
      },
      fieldName: 'keyword',
      label: '全文关键字',
    },
    { component: 'Input', fieldName: 'id', label: $t('system.user.id') },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.user.createTime'),
    },
  ];
}

/**
 * 用户详情描述列表项
 * @param row 用户数据
 */
export function useDescriptionItems(row?: SystemUser): DescriptionsItemType[] {
  const enabled = row?.status === 1;
  return [
    { label: $t('system.user.name'), content: row?.name },
    { label: $t('system.user.id'), content: row?.id },
    { label: $t('system.user.dept'), content: row?.deptId },
    { label: $t('system.user.roles'), content: row?.roles?.join(', ') },
    {
      label: '登录默认页面',
      content: row?.homePermId
        ? `权限 #${row.homePermId}`
        : '继承角色 / 我的信息',
    },
    {
      label: $t('system.user.status'),
      content: () =>
        h(
          Tag,
          {
            color: enabled ? 'success' : 'error',
          },
          {
            default: () =>
              enabled ? $t('common.enabled') : $t('common.disabled'),
          },
        ),
    },
    {
      label: $t('system.user.createTime'),
      content: Times.formatUnix(row?.createTime),
    },
    { label: $t('system.user.remark'), content: row?.remark ?? undefined },
  ];
}

export function useColumns<T = SystemUser>(
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns {
  return [
    {
      field: 'name',
      title: $t('system.user.name'),
      width: 200,
    },
    {
      field: 'id',
      title: $t('system.user.id'),
      width: 200,
    },
    {
      field: 'tel',
      title: '手机号',
      width: 140,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.user.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('system.user.remark'),
    },
    {
      field: 'createTime',
      slots: { default: 'createTime' },
      title: $t('system.user.createTime'),
      width: 200,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('system.user.operation'),
      width: 180,
    },
  ];
}
