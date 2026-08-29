import type { Dayjs } from 'dayjs';

import dayjs from 'dayjs';

export type TimeInput = null | number | string | undefined;

type DateRange = [Dayjs, Dayjs];

function unixRange(value: unknown): DateRange | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [start, end] = value;
  if (!dayjs.isDayjs(start) || !dayjs.isDayjs(end)) return undefined;
  return [start, end];
}

type OptionalDateRangeField<
  TFormValues extends Record<string, unknown>,
  TRangeField extends keyof TFormValues,
> =
  Record<never, never> extends Pick<TFormValues, TRangeField>
    ? [Exclude<TFormValues[TRangeField], undefined>] extends [never]
      ? never
      : Exclude<TFormValues[TRangeField], undefined> extends DateRange
        ? TRangeField
        : never
    : never;

type DateRangeSubmitValues<
  TFormValues extends Record<string, unknown>,
  TRangeField extends keyof TFormValues,
  TStartField extends string,
  TEndField extends string,
> = Omit<TFormValues, TRangeField> &
  Record<TEndField | TStartField, string | undefined>;

interface DateRangeCodecOptions<
  TFormValues extends Record<string, unknown>,
  TRangeField extends keyof TFormValues & string,
  TStartField extends string,
  TEndField extends string,
> {
  endField: TEndField;
  rangeField: OptionalDateRangeField<TFormValues, TRangeField> & TRangeField;
  startField: TStartField;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  hour12: false,
  timeStyle: 'medium',
});

function normalizeUnixSeconds(value: TimeInput): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  // 后端约定 Unix 秒；兼容少量毫秒值，避免迁移期页面显示 5 万年后的日期。
  return timestamp > 10_000_000_000 ? Math.floor(timestamp / 1000) : timestamp;
}

export const Times = {
  createDateRangeCodec<TFormValues extends Record<string, unknown>>() {
    return function createCodec<
      TRangeField extends keyof TFormValues & string,
      TStartField extends string,
      TEndField extends string,
    >(
      options: DateRangeCodecOptions<
        TFormValues,
        TRangeField,
        TStartField,
        TEndField
      >,
    ) {
      const { endField, startField } = options;
      const rangeField = options.rangeField as TRangeField;
      type SubmitValues = DateRangeSubmitValues<
        TFormValues,
        TRangeField,
        TStartField,
        TEndField
      >;

      return {
        decode(values: Readonly<SubmitValues>): TFormValues {
          const {
            [endField]: end,
            [startField]: start,
            ...formValues
          } = values;
          return {
            ...formValues,
            ...(start && end
              ? { [rangeField]: [dayjs(start), dayjs(end)] }
              : {}),
          } as TFormValues;
        },
        encode(values: Readonly<TFormValues>): SubmitValues {
          const { [rangeField]: value, ...formValues } = values;
          const range = value as DateRange | undefined;
          return {
            ...formValues,
            [endField]: range?.[1]?.format('YYYY-MM-DD'),
            [startField]: range?.[0]?.format('YYYY-MM-DD'),
          } as SubmitValues;
        },
      };
    };
  },

  formatUnix(value: TimeInput, fallback = '未知'): string {
    const seconds = normalizeUnixSeconds(value);
    if (seconds === undefined) return fallback;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return fallback;
    return dateTimeFormatter.format(date);
  },

  formatOptionalUnix(value: TimeInput, fallback = '-'): string {
    return Times.formatUnix(value, fallback);
  },

  formatUnixField(record: object, field: unknown, fallback = '-'): string {
    return typeof field === 'string'
      ? Times.formatUnix(
          (record as Record<string, unknown>)[field] as TimeInput,
          fallback,
        )
      : fallback;
  },

  parseUnixRange(value: unknown): DateRange | undefined {
    if (typeof value !== 'string') return undefined;
    const [start, end, ...rest] = value.split(',');
    if (rest.length > 0 || !start || !end) return undefined;
    const startSeconds = Number(start);
    const endSeconds = Number(end);
    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      startSeconds <= 0 ||
      endSeconds < startSeconds
    ) {
      return undefined;
    }
    return [dayjs.unix(startSeconds), dayjs.unix(endSeconds)];
  },

  toUnixRange(value: unknown): string | undefined {
    const range = unixRange(value);
    return range ? `${range[0].unix()},${range[1].unix()}` : undefined;
  },

  toUnixSeconds(value: TimeInput): number | undefined {
    return normalizeUnixSeconds(value);
  },
};
