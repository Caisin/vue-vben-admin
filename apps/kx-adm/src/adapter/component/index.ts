import type {
  AutoCompleteProps,
  ButtonProps,
  CheckboxProps,
  DatePickerProps,
  DividerProps,
  InputNumberProps,
  InputProps,
  RadioGroupProps,
  RangePickerProps,
  SegmentedProps,
  SelectProps,
  SwitchProps,
  TextAreaProps,
  TreeSelectProps,
} from 'antdv-next';

import type { Component } from 'vue';

import type {
  ApiComponentSharedProps,
  BaseFormComponentType,
  IconPickerProps,
} from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type {
  DicRadioGroupProps,
  DicSelectProps,
} from '#/components/dictionary';
import type { FileUrlInput, FileUrlsInput } from '#/components/file-picker';
import type { JsonEditorProps } from '#/components/json-editor';

import { defineAsyncComponent, defineComponent, h, ref } from 'vue';

import { ApiComponent, globalShareState, IconPicker } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { notification } from 'antdv-next';
import dayjs from 'dayjs';

import { DicRadioGroup, DicSelect } from '#/components/dictionary';
import { productFormComponents } from '#/products/components';

const FormFileUrlInput = defineAsyncComponent(
  () => import('#/components/file-picker/file-url-input.vue'),
);
const FormFileUrlsInput = defineAsyncComponent(
  () => import('#/components/file-picker/file-urls-input.vue'),
);

const AutoComplete = defineAsyncComponent(
  () => import('antdv-next/dist/auto-complete/index'),
);
const Button = defineAsyncComponent(
  () => import('antdv-next/dist/button/index'),
);
const Checkbox = defineAsyncComponent(
  () => import('antdv-next/dist/checkbox/index'),
);
const DatePicker = defineAsyncComponent(
  () => import('antdv-next/dist/date-picker/index'),
);
const Divider = defineAsyncComponent(
  () => import('antdv-next/dist/divider/index'),
);
const Input = defineAsyncComponent(() => import('antdv-next/dist/input/index'));
const InputNumber = defineAsyncComponent(
  () => import('antdv-next/dist/input-number/index'),
);
const InputPassword = defineAsyncComponent(() =>
  import('antdv-next/dist/input/index').then((res) => res.InputPassword),
);
const JsonEditor = defineAsyncComponent(
  () => import('#/components/json-editor'),
);
const RadioGroup = defineAsyncComponent(() =>
  import('antdv-next/dist/radio/index').then((res) => res.RadioGroup),
);
const RangePicker = defineAsyncComponent(() =>
  import('antdv-next/dist/date-picker/index').then(
    (res) => res.DateRangePicker,
  ),
);

const quickTimeRangePresets = [
  {
    label: '1h',
    value: () => [dayjs().subtract(1, 'hour'), dayjs()],
  },
  {
    label: '24h',
    value: () => [dayjs().subtract(24, 'hour'), dayjs()],
  },
  {
    label: '今天',
    value: () => [dayjs().startOf('day'), dayjs().endOf('day')],
  },
  {
    label: '昨天',
    value: () => {
      const yesterday = dayjs().subtract(1, 'day');
      return [yesterday.startOf('day'), yesterday.endOf('day')];
    },
  },
  {
    label: '本周',
    value: () => {
      const now = dayjs();
      const monday = now.startOf('day').subtract((now.day() + 6) % 7, 'day');
      return [monday, monday.add(7, 'day').subtract(1, 'millisecond')];
    },
  },
  {
    label: '本月',
    value: () => [dayjs().startOf('month'), dayjs().endOf('month')],
  },
];
const Segmented = defineAsyncComponent(
  () => import('antdv-next/dist/segmented/index'),
);
const Select = defineAsyncComponent(
  () => import('antdv-next/dist/select/index'),
);
const Switch = defineAsyncComponent(
  () => import('antdv-next/dist/switch/index'),
);
const Textarea = defineAsyncComponent(
  () => import('antdv-next/dist/input/TextArea'),
);
const TreeSelect = defineAsyncComponent(
  () => import('antdv-next/dist/tree-select/index'),
);

const ApiTreeSelect = defineComponent({
  name: 'ApiTreeSelect',
  inheritAttrs: false,
  setup: (props, { attrs, slots }) => {
    return () =>
      h(
        ApiComponent,
        {
          ...props,
          ...attrs,
          component: TreeSelect,
          modelPropName: 'value',
          optionsPropName: 'treeData',
        },
        slots,
      );
  },
});

const withDefaultPlaceholder = (
  component: Component,
  type: 'input' | 'select',
  componentProps: Recordable<unknown> = {},
) =>
  defineComponent({
    name: component.name,
    inheritAttrs: false,
    setup: (props, { attrs, expose, slots }) => {
      const placeholder = attrs.placeholder || $t(`ui.placeholder.${type}`);
      const innerRef = ref();
      expose(
        new Proxy(
          {},
          {
            get: (_target, key) => innerRef.value?.[key],
            has: (_target, key) => key in (innerRef.value || {}),
          },
        ),
      );
      return () =>
        h(
          component,
          { ...componentProps, ...props, ...attrs, placeholder, ref: innerRef },
          slots,
        );
    },
  });

export type ComponentType =
  | 'ApiTreeSelect'
  | 'AutoComplete'
  | 'Checkbox'
  | 'DefaultButton'
  | 'DicRadioGroup'
  | 'DicSelect'
  | 'Divider'
  | 'FileUrlInput'
  | 'FileUrlsInput'
  | 'IconPicker'
  | 'Input'
  | 'InputNumber'
  | 'InputPassword'
  | 'JsonEditor'
  | 'PrimaryButton'
  | 'RadioGroup'
  | 'RangePicker'
  | 'Segmented'
  | 'Select'
  | 'Switch'
  | 'Textarea'
  | 'TreeSelect'
  | BaseFormComponentType;

export interface ComponentPropsMap {
  ApiTreeSelect: ApiComponentSharedProps & TreeSelectProps;
  AutoComplete: AutoCompleteProps;
  Checkbox: CheckboxProps;
  DatePicker: DatePickerProps;
  DefaultButton: ButtonProps;
  DicRadioGroup: DicRadioGroupProps;
  DicSelect: DicSelectProps;
  Divider: DividerProps;
  FileUrlInput: InstanceType<typeof FileUrlInput>['$props'];
  FileUrlsInput: InstanceType<typeof FileUrlsInput>['$props'];
  IconPicker: IconPickerProps;
  Input: InputProps;
  InputNumber: InputNumberProps;
  InputPassword: InputProps;
  JsonEditor: JsonEditorProps;
  PrimaryButton: ButtonProps;
  RadioGroup: RadioGroupProps;
  RangePicker: RangePickerProps;
  Segmented: SegmentedProps;
  Select: SelectProps;
  Switch: SwitchProps;
  Textarea: TextAreaProps;
  TreeSelect: TreeSelectProps;
}

async function initComponentAdapter() {
  const components: Partial<Record<ComponentType, Component>> = {
    ApiTreeSelect,
    AutoComplete: withDefaultPlaceholder(AutoComplete, 'select'),
    Checkbox,
    DatePicker: withDefaultPlaceholder(DatePicker, 'select'),
    DefaultButton: (props, { attrs, slots }) =>
      h(Button, { ...props, attrs, type: 'default' }, slots),
    DicRadioGroup,
    DicSelect,
    Divider,
    FileUrlInput: FormFileUrlInput,
    FileUrlsInput: FormFileUrlsInput,
    Input: withDefaultPlaceholder(Input, 'input'),
    InputNumber: withDefaultPlaceholder(InputNumber, 'input'),
    InputPassword: withDefaultPlaceholder(InputPassword, 'input'),
    IconPicker,
    JsonEditor,
    PrimaryButton: (props, { attrs, slots }) =>
      h(Button, { ...props, attrs, type: 'primary' }, slots),
    RadioGroup,
    RangePicker: withDefaultPlaceholder(RangePicker, 'select', {
      presets: quickTimeRangePresets,
    }),
    Segmented,
    Select: withDefaultPlaceholder(Select, 'select'),
    ...productFormComponents,
    Switch,
    Textarea: withDefaultPlaceholder(Textarea, 'input'),
    TreeSelect: withDefaultPlaceholder(TreeSelect, 'select'),
  };

  globalShareState.setComponents(components);
  globalShareState.defineMessage({
    copyPreferencesSuccess: (title, content) => {
      notification.success({
        description: content,
        placement: 'bottomRight',
        title,
      });
    },
  });
}

export { initComponentAdapter };
