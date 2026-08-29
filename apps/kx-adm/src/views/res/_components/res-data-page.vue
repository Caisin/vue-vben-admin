<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Space,
  TextArea,
  Upload,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  dashboard,
  ditch,
  global,
  log,
  report,
  run,
  set,
} from '#/api/res/seas';

type ApiFn = (payload?: any, payload2?: any) => Promise<any>;
type Field = {
  label: string;
  name: string;
  options?: Array<{ label: string; value: any }>;
  type?: 'number' | 'select' | 'text';
};
type RowAction = {
  confirm?: boolean;
  handler: (row: any) => Promise<any>;
  label: string;
};
type ExtraAction = { handler: (params: any) => Promise<any>; label: string };
type Config = {
  actions?: RowAction[];
  columns?: string[];
  detail?: (row: any, params: any) => Promise<any>;
  extras?: ExtraAction[];
  list: ApiFn;
  remove?: (row: any) => Promise<any>;
  save?: ApiFn;
  search?: Field[];
  title: string;
  upload?: (params: any, progress: (event: any) => void) => Promise<any>;
};

const props = defineProps<{
  moduleKey: string;
  title?: string;
  variant?: string;
}>();

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];
const commonSearch: Field[] = [
  { label: 'ID', name: 'id.eq', type: 'number' },
  { label: 'UID', name: 'uid.eq', type: 'number' },
  { label: '关键字', name: 'kw.contains' },
];
const dateSearch: Field[] = [
  { label: '开始日期', name: 'start_date' },
  { label: '结束日期', name: 'end_date' },
];

function cfg(partial: Omit<Config, 'search'> & { search?: Field[] }): Config {
  return { search: commonSearch, ...partial };
}

const configs: Record<string, Config> = {
  dashboard: cfg({
    columns: [
      'uv',
      'todayRecharge',
      'todayVip',
      'numberOfOnlineUsers',
      'totale',
      'updated_at',
    ],
    extras: [
      { handler: dashboard.getOnline, label: '在线数据' },
      { handler: dashboard.getRechargeExpand, label: '充值消耗' },
      { handler: dashboard.getRechargeShortTop, label: '充值剧 Top3' },
      { handler: dashboard.getNewUserChart, label: '新增用户' },
      { handler: dashboard.getOrderEchart, label: '订单趋势' },
    ],
    list: dashboard.getDataStatistics,
    title: 'RES 数据看板',
  }),
  'ditch/index': cfg({
    columns: [
      'id',
      'name',
      'code',
      'state',
      'remark',
      'created_at',
      'updated_at',
    ],
    extras: [
      { handler: ditch.getPageListNoPage, label: '渠道列表' },
      { handler: ditch.getTeamAllList, label: '渠道分组' },
      { handler: ditch.getChannelUserInfo, label: '当前渠道用户' },
      { handler: ditch.getAuthSourceIdList, label: '已授权资源' },
    ],
    list: ditch.getPageList,
    save: ditch.savePage,
    search: [
      { label: '渠道名', name: 'name.contains' },
      { label: '渠道码', name: 'code.contains' },
      {
        label: '状态',
        name: 'state.eq',
        type: 'select',
        options: statusOptions,
      },
    ],
    title: '渠道管理',
  }),
  'ditch/source': cfg({
    actions: [
      {
        confirm: true,
        handler: (row) =>
          ditch.authSource({
            cid: row.cid ?? row.channel_id,
            res_id: row.res_id ?? row.id,
          }),
        label: '授权',
      },
      {
        confirm: true,
        handler: (row) =>
          ditch.unAuthSource({
            cid: row.cid ?? row.channel_id,
            res_id: row.res_id ?? row.id,
          }),
        label: '取消授权',
      },
    ],
    columns: ['id', 'res_id', 'cid', 'title', 'name', 'state', 'lang'],
    list: ditch.getSourceList,
    search: [
      { label: '渠道 ID', name: 'cid', type: 'number' },
      { label: '资源名', name: 'title.contains' },
    ],
    title: '渠道资源授权',
  }),
  'ditch/team': cfg({
    columns: ['id', 'name', 'code', 'remark'],
    list: ditch.getTeamList,
    save: ditch.saveTeam,
    title: '渠道分组',
  }),
  'ditch/user': cfg({
    columns: ['id', 'uid', 'username', 'channel_id', 'state'],
    list: ditch.getUserList,
    save: ditch.saveUser,
    title: '渠道用户',
  }),
  'global/consume': cfg({
    columns: [
      'id',
      'uid',
      'asset_id',
      'change_num',
      'balance',
      'remark',
      'created_at',
    ],
    list: global.user.getConsumeLogList,
    title: '用户消耗记录',
  }),
  'global/fb_event': cfg({
    columns: ['id', 'event_name', 'event_time', 'uid', 'pixel_id', 'state'],
    list: set.fb.getEventList,
    title: 'Facebook 事件记录',
  }),
  'global/fire': cfg({
    columns: ['id', 'uid', 'firebase_token', 'app_version', 'created_at'],
    list: global.user.getFireBaseList,
    title: 'Firebase Token',
  }),
  'global/link': cfg({
    columns: ['id', 'name', 'link_url', 'channel', 'state', 'created_at'],
    extras: [{ handler: global.link.getAnalysisList, label: '付费分析' }],
    list: global.link.getList,
    remove: global.link.postDel,
    save: global.link.postSave,
    title: '链接管理',
  }),
  'global/link_change': cfg({
    columns: ['id', 'uid', 'link_id', 'old_link_id', 'created_at'],
    list: global.user.getUserLinkList,
    title: '用户链接变更',
  }),
  'global/order': cfg({
    actions: [
      {
        confirm: true,
        handler: (row) => global.order.refund(row.id),
        label: '退款',
      },
      {
        confirm: true,
        handler: (row) => global.order.recovery(row.id),
        label: '恢复订单',
      },
    ],
    columns: [
      'id',
      'order_no',
      'acct_id',
      'uid',
      'amount',
      'currency',
      'state',
      'created_at',
    ],
    extras: [{ handler: global.order.getTotal, label: '订单总计' }],
    list: global.order.getList,
    title: '订单管理',
  }),
  'global/page_manage': cfg({
    actions: [
      {
        handler: (row) =>
          global.page_manage.refreshPage(row.page_code ?? row.code ?? 'index'),
        label: '刷新缓存',
      },
    ],
    columns: ['id', 'page_code', 'page_name', 'state', 'remark'],
    list: global.page_manage.getPageList,
    save: global.page_manage.savePage,
    title: '页面管理',
  }),
  'global/page_module_manage': cfg({
    columns: ['id', 'page_code', 'group_code', 'group_name', 'sort', 'state'],
    extras: [
      { handler: global.page_module_manage.getSourceList, label: '模块资源' },
    ],
    list: global.page_module_manage.getList,
    save: global.page_module_manage.postSave,
    title: '页面模块',
  }),
  'global/read': cfg({
    columns: ['id', 'uid', 'res_id', 'lang', 'read_time', 'created_at'],
    list: global.user.getSubList,
    title: '阅读记录',
  }),
  'global/read_detail': cfg({
    columns: ['id', 'uid', 'res_id', 'item_id', 'seq_no', 'created_at'],
    list: global.user.getSubDetailList,
    title: '章节阅读明细',
  }),
  'global/return_config': cfg({
    actions: [
      {
        handler: (row) =>
          global.return_config.refreshPage(row.page_code ?? 'post_tmp'),
        label: '刷新缓存',
      },
    ],
    columns: ['id', 'tmp_name', 'state', 'remark'],
    extras: [{ handler: global.return_config.getBackList, label: '模板列表' }],
    list: global.return_config.getPageList,
    save: global.return_config.savePage,
    title: '回传模板',
  }),
  'global/source_manage': cfg({
    actions: [
      {
        handler: (row) =>
          global.source_manage.postChangeState(
            row.id ?? row.res_id,
            row.state === 1 ? 0 : 1,
          ),
        label: '上下架',
      },
      {
        handler: (row) =>
          global.source_manage.getDefaultPrice(row.id ?? row.res_id),
        label: '默认价格',
      },
      {
        handler: (row) =>
          global.source_manage.getCoinConfig({ id: row.id ?? row.res_id }),
        label: '金币配置',
      },
    ],
    columns: [
      'id',
      'res_id',
      'title',
      'lang',
      'state',
      'heat',
      'created_at',
      'updated_at',
    ],
    detail: (row) => global.source_manage.getDetail(row.id ?? row.res_id),
    extras: [
      { handler: global.source_manage.getListAll, label: '全部资源' },
      { handler: global.source_manage.getChapterListPage, label: '章节分页' },
      { handler: global.source_manage.getMarkTagList, label: '标签列表' },
      { handler: global.source_manage.getCoinHistory, label: '金币历史' },
    ],
    list: global.source_manage.getList,
    save: global.source_manage.postSave,
    title: '资源管理',
    upload: global.source_manage.parse_file,
  }),
  'global/tmplate_lib': cfg({
    columns: ['id', 'code', 'name', 'enabled', 'remark'],
    extras: [
      { handler: global.tmplate_lib.getListNoPage, label: '模板列表' },
      { handler: global.tmplate_lib.getMoneyTypeList, label: '资金类型' },
      { handler: global.tmplate_lib.getMoneyItemList, label: '资金科目' },
    ],
    list: global.tmplate_lib.getList,
    save: global.tmplate_lib.postSave,
    title: '支付模板库',
  }),
  'global/translate': cfg({
    columns: ['id', 'code', 'lang', 'value', 'updated_at'],
    detail: (row) => global.i18n.getDetail(row.code),
    list: global.i18n.getList,
    save: global.i18n.postSave,
    title: '多语言翻译',
  }),
  'global/user': cfg({
    columns: [
      'id',
      'uid',
      'nickname',
      'mobile',
      'email',
      'state',
      'created_at',
    ],
    detail: (row) =>
      global.user.getUserDetail({ uid: { eq: row.uid ?? row.id } }),
    list: global.user.getList,
    title: '用户管理',
  }),
  'global/user_detail': cfg({
    columns: ['id', 'uid', 'nickname', 'mobile', 'email', 'state'],
    detail: (_row, params) =>
      global.user.getUserDetail({
        uid: { eq: params['uid.eq'] ?? params.uid },
      }),
    list: global.user.getList,
    title: '用户详情',
  }),
  'global/watch': cfg({
    columns: ['id', 'uid', 'ad_id', 'position', 'reward', 'created_at'],
    list: global.user.getAdWatchList,
    title: '广告观看记录',
  }),
  'log/access': cfg({
    columns: [
      'id',
      'in_time',
      'leave_time',
      'uid',
      'app_version',
      'device_id',
      'in_ip',
      'stay_time',
    ],
    list: log.access.getAccessLogList,
    title: '访问日志',
  }),
  'log/back': cfg({
    actions: [
      {
        confirm: true,
        handler: (row) => log.back.postReBack(row.id),
        label: '补回传',
      },
    ],
    columns: ['id', 'uid', 'event_name', 'state', 'fbclid', 'created_at'],
    list: log.back.getBackLogList,
    title: '回传日志',
  }),
  'log/error': cfg({
    columns: ['id', 'uid', 'err_msg', 'stack', 'app_version', 'created_at'],
    list: log.error.getErrorLogList,
    title: '错误日志',
  }),
  'log/fb-follow': cfg({
    columns: ['id', 'uid', 'acct_id', 'state', 'created_at'],
    list: log.fb_follow.getFBFollowLogList,
    title: 'Facebook 关注日志',
  }),
  'log/op': cfg({
    columns: ['id', 'uid', 'op_type', 'path', 'ip', 'in_time'],
    list: log.op.getOpLogList,
    title: '操作日志',
  }),
  'log/w2a': cfg({
    columns: ['id', 'uid', 'w2a_id', 'device_id', 'created_at'],
    list: log.w2a.getW2aLogList,
    title: 'W2A 日志',
  }),
  'report/ad': cfg({
    columns: [
      'date',
      'platform',
      'link_id',
      'position',
      'cost',
      'show',
      'click',
      'income',
    ],
    extras: [
      { handler: report.ad.getTotal, label: '平台汇总' },
      { handler: report.ad.getLinkTotal, label: '链接汇总' },
      { handler: report.ad.getPositionTotal, label: '位置汇总' },
      { handler: report.ad.getUserTotal, label: '用户汇总' },
    ],
    list: report.ad.getList,
    search: dateSearch,
    title: '广告统计',
  }),
  'report/day': cfg({
    actions: [
      {
        handler: (row) =>
          report.day.postCost({ date: row.date, cost: row.cost }),
        label: '保存成本',
      },
    ],
    columns: ['date', 'uv', 'pay_user', 'pay_money', 'cost', 'roi'],
    extras: [{ handler: report.day.getTotal, label: '日报总计' }],
    list: report.day.getList,
    search: dateSearch,
    title: '日报统计',
  }),
  'report/day_reader': cfg({
    columns: ['date', 'uid', 'read_count', 'pay_money', 'created_at'],
    list: report.day_reader.getList,
    search: dateSearch,
    title: '每日阅读统计',
  }),
  'report/fb_back': cfg({
    columns: ['date', 'event_name', 'pixel_id', 'success', 'fail'],
    list: report.fb_back.getList,
    search: dateSearch,
    title: 'Facebook 回传统计',
  }),
  'report/fb_sub': cfg({
    columns: ['date', 'acct_id', 'sub_count', 'unsub_count'],
    list: report.fb_sub.getList,
    search: dateSearch,
    title: 'Facebook 关注统计',
  }),
  'report/iap/plan': cfg({
    actions: [
      {
        handler: (row) =>
          report.iap.plan.postCost({
            id: row.id,
            date: row.date,
            cost: row.cost,
          }),
        label: '保存成本',
      },
    ],
    columns: [
      'date',
      'campaign_id',
      'adset_id',
      'ad_id',
      'cost',
      'pay_money',
      'roi',
    ],
    extras: [
      { handler: report.iap.plan.getTotal, label: '总计' },
      { handler: report.iap.plan.getAdCampaignList, label: '广告系列' },
      { handler: report.iap.plan.getAdAdsetList, label: '广告组' },
      { handler: report.iap.plan.getAdList, label: '广告' },
    ],
    list: report.iap.plan.getList,
    search: dateSearch,
    title: 'IAP 计划统计',
  }),
  'report/iap/plan_paytime': cfg({
    actions: [
      {
        handler: (row) =>
          report.iap.plan_paytime.postCost({
            id: row.id,
            date: row.date,
            cost: row.cost,
          }),
        label: '保存成本',
      },
    ],
    columns: [
      'date',
      'campaign_id',
      'adset_id',
      'ad_id',
      'pay_time',
      'cost',
      'pay_money',
      'roi',
    ],
    extras: [
      { handler: report.iap.plan_paytime.getTotal, label: '总计' },
      { handler: report.iap.plan_paytime.getAdCampaignList, label: '广告系列' },
      { handler: report.iap.plan_paytime.getAdAdsetList, label: '广告组' },
      { handler: report.iap.plan_paytime.getAdList, label: '广告' },
    ],
    list: report.iap.plan_paytime.getList,
    search: dateSearch,
    title: 'IAP 付费时间统计',
  }),
  'report/iap/roi': cfg({
    columns: ['date', 'cost', 'pay_money', 'roi', 'd1', 'd3', 'd7'],
    detail: (row) => report.iap.roi.getDay({ date: row.date }),
    extras: [{ handler: report.iap.roi.getTotal, label: 'ROI 表头' }],
    list: report.iap.roi.getList,
    search: dateSearch,
    title: 'IAP ROI',
  }),
  'report/iap/total': cfg({
    columns: ['date', 'cost', 'pay_money', 'roi', 'register_count', 'pay_user'],
    detail: (row) => report.iap.total.getDay({ date: row.date }),
    extras: [{ handler: report.iap.total.getTotal, label: '总览表头' }],
    list: report.iap.total.getList,
    search: dateSearch,
    title: 'IAP 总览',
  }),
  'report/link': cfg({
    actions: [
      {
        handler: (row) =>
          report.link.postCost({
            date: row.date,
            link_id: row.link_id,
            cost: row.cost,
          }),
        label: '保存成本',
      },
    ],
    columns: ['date', 'link_id', 'uv', 'pay_user', 'pay_money', 'cost', 'roi'],
    extras: [{ handler: report.link.getTotal, label: '链接总计' }],
    list: report.link.getList,
    search: dateSearch,
    title: '链接统计',
  }),
  'report/user_income': cfg({
    columns: ['date', 'uid', 'income', 'pay_money', 'created_at'],
    list: report.user_income.getList,
    search: dateSearch,
    title: '用户收入统计',
  }),
  'run/push': cfg({
    actions: [
      {
        handler: (row) => run.push.testPush({ id: row.id, uid: row.uid }),
        label: '测试推送',
      },
      {
        confirm: true,
        handler: (row) => run.push.sendPush(row.id),
        label: '发送推送',
      },
      {
        handler: (row) => run.push.refreshPage(row.page_code ?? 'app_push'),
        label: '刷新缓存',
      },
    ],
    columns: ['id', 'title', 'content', 'push_time', 'state', 'created_at'],
    extras: [{ handler: run.push.getLogList, label: '推送记录' }],
    list: run.push.getPageList,
    save: run.push.savePage,
    title: '推送管理',
  }),
  'set/ad': cfg({
    columns: [
      'id',
      'product_id',
      'platform',
      'position',
      'state',
      'created_at',
    ],
    extras: [
      { handler: set.ad.getListNoPage, label: '广告商品' },
      { handler: set.ad.getAreaList, label: '地区列表' },
    ],
    list: set.ad.getList,
    remove: (row) => set.ad.postDelete(row.id),
    save: set.ad.postSave,
    title: '广告设置',
  }),
  'set/category': cfg({
    actions: [
      {
        handler: (row) =>
          set.category.refreshSourceCateList(row.id ?? row.cat_id),
        label: '刷新资源标签',
      },
      { handler: set.category.refreshAllCateList, label: '刷新全部标签' },
    ],
    columns: ['id', 'name', 'lang', 'state', 'sort', 'created_at'],
    extras: [
      {
        handler: (params) =>
          set.category.getCateSourceList(params.cat_id ?? params.id),
        label: '分类资源',
      },
    ],
    list: set.category.getList,
    remove: (row) => set.category.postDelete(row.id),
    save: set.category.postSave,
    title: '分类标签',
  }),
  'set/def_tmplate_lib': cfg({
    columns: ['id', 'code', 'name', 'enabled', 'remark'],
    list: global.tmplate_lib.getList,
    save: global.tmplate_lib.postSave,
    title: '默认模板库',
  }),
  'set/fb': cfg({
    columns: [
      'id',
      'pixel_id',
      'access_token',
      'event_name',
      'state',
      'created_at',
    ],
    extras: [
      { handler: set.fb.getListNoPage, label: 'Pixel 配置' },
      { handler: set.fb.getEventList, label: '事件日志' },
    ],
    list: set.fb.getList,
    save: set.fb.postSave,
    title: 'Facebook Pixel 设置',
  }),
  'set/feedback': cfg({
    columns: ['id', 'uid', 'content', 'replier_id', 'state', 'created_at'],
    detail: (row) => set.feedback.getReplyList(row.id),
    extras: [{ handler: set.feedback.getListNoPage, label: '反馈列表' }],
    list: set.feedback.getList,
    save: set.feedback.postSave,
    title: '用户反馈',
    upload: set.feedback.uploadImg,
  }),
  'set/follow': cfg({
    columns: ['id', 'acct_id', 'name', 'page_id', 'state', 'created_at'],
    extras: [{ handler: set.follow.getListAll, label: '关注账号列表' }],
    list: set.follow.getList,
    save: set.follow.postSave,
    title: 'Facebook 关注设置',
  }),
  'set/sku/android': cfg({
    columns: ['id', 'product_id', 'product_name', 'item_type', 'state'],
    extras: [
      { handler: set.sku.android.getListNoPage, label: 'Android 商品列表' },
    ],
    list: set.sku.android.getList,
    remove: (row) => set.sku.android.postDelete(row.id),
    save: set.sku.android.postSave,
    title: 'Android SKU',
  }),
  'set/sku/ios': cfg({
    columns: ['id', 'product_id', 'product_name', 'item_type', 'state'],
    extras: [{ handler: set.sku.ios.getListNoPage, label: 'iOS 商品列表' }],
    list: set.sku.ios.getList,
    remove: (row) => set.sku.ios.postDelete(row.id),
    save: set.sku.ios.postSave,
    title: 'iOS SKU',
  }),
  'set/task': cfg({
    columns: ['id', 'task_type', 'title', 'reward', 'state', 'sort'],
    extras: [{ handler: set.task.getSignList, label: '签到设置' }],
    list: set.task.getList,
    save: set.task.postSave,
    title: '任务设置',
  }),
};

const dashboardConfig = configs.dashboard as Config;
const config = computed<Config>(
  () => configs[props.moduleKey] ?? dashboardConfig,
);
const pageTitle = computed(() => props.title || config.value.title);
const saving = ref(false);
const editOpen = ref(false);
const editRecord = reactive<Record<string, any>>({});
const detailOpen = ref(false);
const detailTitle = ref('详情');
const detailRecord = ref<any>({});
let latestQuery: Record<string, any> = { page: 1, size: 20 };

function formComponent(type: Field['type']) {
  if (type === 'number') return 'InputNumber';
  if (type === 'select') return 'Select';
  return 'Input';
}

function useGridFormSchema(): VbenFormSchema[] {
  return (config.value.search ?? []).map((field) => ({
    component: formComponent(field.type),
    componentProps:
      field.type === 'select'
        ? { allowClear: true, options: field.options }
        : { allowClear: true },
    fieldName: field.name,
    label: field.label,
  }));
}

function useColumns(): VxeTableGridColumns {
  const keys = [...new Set(config.value.columns)].filter(Boolean);
  return [
    ...keys.map((key) => ({
      field: key,
      minWidth: 140,
      showOverflow: 'tooltip' as const,
      slots: { default: 'value' },
      title: labelize(key),
    })),
    {
      align: 'right' as const,
      field: '__operation',
      fixed: 'right' as const,
      headerAlign: 'center' as const,
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 180,
    },
  ];
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          latestQuery = cleanQuery(page.currentPage, page.pageSize, formValues);
          const result = await config.value.list(latestQuery);
          const items = normalizeRows(result).map((row, index) => ({
            ...row,
            __rowKey: row.id ?? row.uid ?? `${page.currentPage}-${index}`,
          }));
          return { items, total: normalizeTotal(result, items) };
        },
      },
    },
    rowConfig: { keyField: '__rowKey' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

const [DetailGrid, detailGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [],
    height: 520,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: '__rowKey' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      search: false,
      zoom: false,
    },
  } as VxeTableGridOptions,
});

function labelize(key: string) {
  const labels: Record<string, string> = {
    acct_id: '账户ID',
    ad_id: '广告ID',
    amount: '金额',
    content: '内容',
    cost: '成本',
    created_at: '创建时间',
    date: '日期',
    device_id: '设备ID',
    event_name: '事件',
    id: 'ID',
    lang: '语言',
    link_id: '链接ID',
    name: '名称',
    order_no: '订单号',
    pay_money: '支付金额',
    platform: '平台',
    product_id: '商品ID',
    state: '状态',
    title: '标题',
    uid: '用户ID',
    updated_at: '更新时间',
  };
  return labels[key] ?? key;
}

function normalizeRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['items', 'list', 'records', 'rows', 'data']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    if (payload.list && typeof payload.list === 'object') return [payload.list];
    return [payload];
  }
  return [];
}

function normalizeTotal(payload: any, list: any[]) {
  if (payload && typeof payload === 'object')
    return Number(
      payload.total ?? payload.count ?? payload.total_count ?? list.length,
    );
  return list.length;
}

function cleanQuery(
  page: number,
  size: number,
  formValues: Record<string, any> = {},
) {
  const params: Record<string, any> = { page, size };
  for (const [key, value] of Object.entries(formValues)) {
    if (value !== undefined && value !== null && value !== '')
      params[key] = value;
  }
  return params;
}

function openCreate() {
  Object.keys(editRecord).forEach((key) =>
    Reflect.deleteProperty(editRecord, key),
  );
  for (const column of config.value.columns ?? [])
    editRecord[column] = undefined;
  editOpen.value = true;
}

function openEdit(record: any) {
  Object.keys(editRecord).forEach((key) =>
    Reflect.deleteProperty(editRecord, key),
  );
  Object.assign(editRecord, JSON.parse(JSON.stringify(record ?? {})));
  editOpen.value = true;
}

async function save() {
  if (!config.value.save) return;
  saving.value = true;
  try {
    const payload = JSON.parse(JSON.stringify(editRecord));
    await config.value.save(payload);
    message.success('保存成功');
    editOpen.value = false;
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function remove(record: any) {
  if (!config.value.remove) return;
  await config.value.remove(JSON.parse(JSON.stringify(record)));
  message.success('删除成功');
  await gridApi.query();
}

async function runRowAction(action: RowAction, record: any) {
  const result = await action.handler(JSON.parse(JSON.stringify(record)));
  message.success(`${action.label}已提交`);
  if (result === undefined) {
    await gridApi.query();
  } else {
    showDetail(action.label, result);
  }
}

async function loadExtra(action: ExtraAction) {
  const result = await action.handler(latestQuery);
  showDetail(action.label, result);
}

async function showRowDetail(record: any) {
  if (!config.value.detail) return showDetail('行详情', record);
  const result = await config.value.detail(
    JSON.parse(JSON.stringify(record)),
    latestQuery,
  );
  showDetail('接口详情', result);
}

async function showDetail(title: string, value: any) {
  detailTitle.value = title;
  detailRecord.value = value;
  detailOpen.value = true;
  if (!Array.isArray(value)) return;
  const keys = Object.keys(value[0] ?? {});
  detailGridApi.setGridOptions({
    columns: keys.map((key) => ({
      field: key,
      minWidth: 140,
      showOverflow: 'tooltip',
      title: labelize(key),
    })),
  });
  await nextTick();
  await detailGridApi.grid.reloadData(
    value.map((row, index) => ({
      ...row,
      __rowKey: row.id ?? row.uid ?? index,
    })),
  );
}

async function beforeUpload(file: File) {
  if (!config.value.upload) return false;
  await config.value.upload({ file }, () => {});
  message.success('上传成功');
  await gridApi.query();
  return false;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    :title="pageTitle"
  >
    <Grid class="management-grid" :table-title="pageTitle">
      <template #toolbar-tools>
        <Space wrap>
          <Button v-if="config.save" type="primary" @click="openCreate">
            新增
          </Button>
          <Upload
            v-if="config.upload"
            :before-upload="beforeUpload"
            :show-upload-list="false"
          >
            <Button>上传</Button>
          </Upload>
          <Button
            v-for="item in config.extras"
            :key="item.label"
            @click="loadExtra(item)"
          >
            {{ item.label }}
          </Button>
        </Space>
      </template>
      <template #value="{ row, column }">
        <span>{{
          typeof row[column.field] === 'object'
            ? JSON.stringify(row[column.field])
            : (row[column.field] ?? '-')
        }}</span>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:eye',
              onClick: () => showRowDetail(row),
              text: '详情',
            },
            ...(config.save
              ? [
                  {
                    icon: 'lucide:edit',
                    onClick: () => openEdit(row),
                    text: '编辑',
                  },
                ]
              : []),
          ]"
          :dropdown-actions="[
            ...(config.actions ?? []).map((action) => ({
              text: action.label,
              ...(action.confirm
                ? {
                    popConfirm: {
                      confirm: () => runRowAction(action, row),
                      title: `确认执行“${action.label}”？`,
                    },
                  }
                : { onClick: () => runRowAction(action, row) }),
            })),
            ...(config.remove
              ? [
                  {
                    danger: true,
                    icon: 'lucide:trash-2',
                    popConfirm: {
                      confirm: () => remove(row),
                      title: '确认删除？',
                    },
                    text: '删除',
                  },
                ]
              : []),
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="editOpen"
      :confirm-loading="saving"
      title="表单编辑"
      width="840px"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem
          v-for="key in Object.keys(editRecord)"
          :key="key"
          :label="labelize(key)"
        >
          <InputNumber
            v-if="typeof editRecord[key] === 'number'"
            v-model:value="editRecord[key]"
            class="w-full"
          />
          <TextArea
            v-else-if="typeof editRecord[key] === 'object'"
            :value="JSON.stringify(editRecord[key], null, 2)"
            :rows="4"
            @change="
              (event) =>
                (editRecord[key] = JSON.parse(event.target.value || 'null'))
            "
          />
          <Input v-else v-model:value="editRecord[key]" allow-clear />
        </FormItem>
      </Form>
    </Modal>

    <Drawer v-model:open="detailOpen" :title="detailTitle" :size="720">
      <Descriptions
        v-if="
          detailRecord &&
          typeof detailRecord === 'object' &&
          !Array.isArray(detailRecord)
        "
        bordered
        :column="1"
        size="small"
      >
        <DescriptionsItem
          v-for="(value, key) in detailRecord"
          :key="key"
          :label="labelize(String(key))"
        >
          {{
            typeof value === 'object' ? JSON.stringify(value, null, 2) : value
          }}
        </DescriptionsItem>
      </Descriptions>
      <DetailGrid
        v-else-if="Array.isArray(detailRecord)"
        :table-title="detailTitle"
      />
      <pre v-else>{{ detailRecord }}</pre>
    </Drawer>
  </Page>
</template>
