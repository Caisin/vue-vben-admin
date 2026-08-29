import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  PhoneAccount,
  PhoneAccountFilterOptions,
  PhoneAccountStatus,
} from '#/api/msg';

export const fallbackPhoneAccountStatusOptions = [
  { label: '启用', value: 'active' as PhoneAccountStatus },
  { label: '停用', value: 'disabled' as PhoneAccountStatus },
];

export function textSelectOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

export function phoneAccountStatusOptions(options: PhoneAccountFilterOptions) {
  return options.statuses.length > 0
    ? options.statuses
    : fallbackPhoneAccountStatusOptions;
}

export function useFormSchema(
  filterOptions: PhoneAccountFilterOptions,
): VbenFormSchema[] {
  return [
    {
      component: 'SimCardSelect',
      componentProps: {
        requirePhoneNumber: true,
        valueField: 'phone_number',
      },
      fieldName: 'phone_number',
      label: '电话号码',
    },
    {
      component: 'DicSelect',
      componentProps: {
        allowClear: true,
        autoSelect: false,
        code: 'msg_phone_account_type',
      },
      fieldName: 'account_type',
      label: '账号类型',
    },
    {
      component: 'DicSelect',
      componentProps: {
        allowClear: true,
        autoSelect: false,
        code: 'msg_phone_account_platform',
      },
      fieldName: 'platform',
      label: '平台名称',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: phoneAccountStatusOptions(filterOptions),
      },
      fieldName: 'status',
      label: '账号状态',
    },
  ];
}

export function useColumns(
  onStatusChange?: (
    status: PhoneAccountStatus,
    row: PhoneAccount,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PhoneAccount> {
  return [
    {
      field: 'phone_number',
      sortable: true,
      fixed: 'left',
      title: '电话号码',
      width: 160,
    },
    { field: 'purpose', title: '业务用途', width: 180 },
    {
      field: 'account_type',
      sortable: true,
      slots: { default: 'accountType' },
      title: '类型',
      width: 100,
    },
    {
      field: 'platform',
      sortable: true,
      slots: { default: 'platform' },
      title: '平台',
      width: 140,
    },
    {
      field: 'account_name',
      minWidth: 220,
      slots: { default: 'accountName' },
      title: '账号',
    },
    {
      field: 'login_url',
      minWidth: 240,
      slots: { default: 'loginUrl' },
      title: '登录入口',
    },
    {
      field: 'password_set',
      slots: { default: 'password' },
      title: '密码',
      width: 100,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
        options: fallbackPhoneAccountStatusOptions,
        props: { checkedValue: 'active', unCheckedValue: 'disabled' },
      },
      field: 'status',
      sortable: true,
      title: '状态',
      width: 100,
    },
    {
      field: 'updated_at',
      sortable: true,
      slots: { default: 'updatedAt' },
      title: '更新时间',
      width: 180,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 90,
    },
  ];
}

export function createFormSchema(
  filterOptions: PhoneAccountFilterOptions,
): VbenFormSchema[] {
  return [
    {
      component: 'SimCardSelect',
      componentProps: {
        placeholder: '按号码、ICCID 或 IMSI 选择电话号码',
        requirePhoneNumber: true,
        valueField: 'phone_number',
      },
      fieldName: 'phone_number',
      label: '电话号码',
      rules: 'required',
    },
    {
      component: 'AutoComplete',
      componentProps: {
        maxlength: 200,
        options: textSelectOptions(filterOptions.purposes),
      },
      fieldName: 'purpose',
      label: '业务用途',
      rules: 'required',
    },
    {
      component: 'DicSelect',
      componentProps: {
        code: 'msg_phone_account_type',
        creatable: true,
        createPlaceholder: '输入新账号类型',
      },
      fieldName: 'account_type',
      label: '账号类型',
      rules: 'selectRequired',
    },
    {
      component: 'DicSelect',
      componentProps: {
        code: 'msg_phone_account_platform',
        creatable: true,
        createPlaceholder: '输入新平台名称',
      },
      fieldName: 'platform',
      label: '平台',
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 320 },
      fieldName: 'account_name',
      label: '账号',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: fallbackPhoneAccountStatusOptions,
      },
      defaultValue: 'active',
      fieldName: 'status',
      label: '状态',
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      fieldName: 'login_url',
      formItemClass: 'md:col-span-2',
      label: '登录地址',
    },
    {
      component: 'InputPassword',
      componentProps: {
        autocomplete: 'new-password',
        placeholder: '留空表示不设置或保留原密码',
      },
      fieldName: 'password',
      formItemClass: 'md:col-span-2',
      label: '密码',
    },
    {
      component: 'Checkbox',
      dependencies: {
        show: (values) => Boolean(values.password_set),
        triggerFields: ['password_set'],
      },
      fieldName: 'clear_password',
      formItemClass: 'md:col-span-2',
      renderComponentContent() {
        return { default: () => '清空已保存密码' };
      },
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 2000, rows: 4, showCount: true },
      fieldName: 'note',
      formItemClass: 'md:col-span-2',
      label: '备注',
    },
  ];
}
