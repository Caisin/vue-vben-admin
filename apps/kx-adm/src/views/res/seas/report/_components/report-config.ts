import type { ReportColumn, ReportFilter } from './report-table.vue';

export type AnyApi = {
  getList: (params: Record<string, any>) => Promise<any>;
  getTotal?: (params: Record<string, any>) => Promise<any>;
  postCost?: (params: Record<string, any>) => Promise<any>;
};

export const linkFilters: ReportFilter[] = [
  { field: 'link_id', label: '链接ID', type: 'number' },
  { field: 'uid', label: 'UID', type: 'number' },
  { field: 'pay_day', label: '付费日期' },
];

export const resFilters: ReportFilter[] = [
  { field: 'res_id', label: '资源ID', type: 'number' },
  { field: 'res_name', label: '资源名称' },
];

export const fbBackFilters: ReportFilter[] = [
  { field: 'id', label: '订单号' },
  { field: 'ad_name', label: '广告名称' },
  { field: 'adset_name', label: '广告组名称' },
  { field: 'campaign_name', label: '广告系列名称' },
];

export const adFilters: ReportFilter[] = [
  { field: 'ad_platform', label: '广告平台' },
  { field: 'link_id', label: '链接ID', type: 'number' },
  { field: 'ad_id', label: '广告ID' },
  { field: 'uid', label: 'UID', type: 'number' },
];

export const iapPlanFilters: ReportFilter[] = [
  { field: 'link_id', label: '链接ID', type: 'number' },
  { field: 'campaign_id', label: '广告系列ID' },
  { field: 'adset_id', label: '广告组ID' },
  { field: 'ad_id', label: '广告ID' },
];

export const linkPayColumns: ReportColumn[] = [
  { key: 'in_link_day', title: '进链日期', width: 120 },
  { key: 'pay_day', title: '付费日期', width: 120 },
  { key: 'link_id', title: '链接ID', width: 100 },
  { key: 'uid', title: 'UID', width: 100 },
  { key: 'pay_amount', title: '付费金额', width: 120 },
  { key: 'pay_num', title: '笔数', width: 100 },
  { key: 'pay_user_num', title: '付费人数', width: 110 },
  { key: 'stat_cost', title: '消耗', width: 110 },
];

export const dayPayColumns: ReportColumn[] = [
  { key: 'in_link_day', title: '日期', width: 120 },
  { key: 'stat_cost', title: '消耗', width: 110 },
  { key: 'pay_amount', title: '付费金额', width: 120 },
  { key: 'pay_num', title: '笔数', width: 100 },
  { key: 'pay_user_num', title: '付费人数', width: 110 },
  { key: 'roi', title: 'ROI', width: 100 },
  { key: 'link_id', title: '链接ID', width: 100 },
  { key: 'uid', title: 'UID', width: 100 },
  { key: 'pay_day', title: '付费日期', width: 120 },
];

export const dayReaderColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'res_id', title: '资源ID', width: 100 },
  { key: 'res_name', title: '资源名称', width: 180 },
  { key: 'user_num', title: '用户数量', width: 110 },
  { key: 'read_times', title: '观看次数', width: 110 },
  { key: 'rests_info', title: '其他信息', width: 240 },
];

export const fbSubColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'res_id', title: '资源ID', width: 100 },
  { key: 'res_name', title: '资源名称', width: 180 },
  { key: 'platform', title: '平台', width: 100 },
  { key: 'pop_num', title: '弹出次数', width: 110 },
  { key: 'pop_user_num', title: '弹出人数', width: 110 },
  { key: 'no_click_num', title: '未点击人数', width: 120 },
  { key: 'sub_num', title: '关注次数', width: 110 },
  { key: 'sub_user_num', title: '关注人数', width: 110 },
  { key: 'sub_rate', title: '关注率', width: 100 },
];

export const fbBackColumns: ReportColumn[] = [
  { key: 'created_at', title: '日期', width: 160 },
  { key: 'id', title: '订单号', width: 160 },
  { key: 'ad_id', title: '广告ID', width: 140 },
  { key: 'ad_name', title: '广告名称', width: 180 },
  { key: 'adset_id', title: '广告组ID', width: 140 },
  { key: 'adset_name', title: '广告组名称', width: 180 },
  { key: 'campaign_id', title: '广告系列ID', width: 140 },
  { key: 'campaign_name', title: '广告系列名称', width: 180 },
];

export const userIncomeColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'uid', title: 'UID', width: 120 },
  { key: 'ad_platform', title: '广告平台', width: 120 },
  { key: 'ad_unit_id', title: '广告位ID', width: 160 },
  { key: 'income', title: '收益', width: 120 },
  { key: 'impression', title: '展示', width: 120 },
  { key: 'click', title: '点击', width: 120 },
  { key: 'ecpm', title: 'ECPM', width: 120 },
];

export const adPlatformColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'ad_platform', title: '广告平台', width: 120 },
  { key: 'user_count', title: '观看用户数', width: 120 },
  { key: 'show_count', title: '生成', width: 100 },
  { key: 'click_count', title: '点击', width: 100 },
  { key: 'click_rate', title: '点击率', width: 100 },
  { key: 'complete_count', title: '完播', width: 100 },
  { key: 'complete_rate', title: '完播率', width: 100 },
  { key: 'ad_count', title: '唤起量', width: 100 },
  { key: 'link_count', title: '链接数', width: 100 },
];

export const adLinkColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'link_id', title: '链接ID', width: 100 },
  { key: 'ad_platform', title: '广告平台', width: 120 },
  { key: 'user_count', title: '用户数', width: 100 },
  { key: 'show_count', title: '展示', width: 100 },
  { key: 'click_count', title: '点击', width: 100 },
  { key: 'click_rate', title: '点击率', width: 100 },
  { key: 'income', title: '收益', width: 120 },
];

export const adPositionColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'ad_platform', title: '广告平台', width: 120 },
  { key: 'ad_position', title: '广告位', width: 140 },
  { key: 'user_count', title: '用户数', width: 100 },
  { key: 'show_count', title: '展示', width: 100 },
  { key: 'click_count', title: '点击', width: 100 },
  { key: 'click_rate', title: '点击率', width: 100 },
  { key: 'income', title: '收益', width: 120 },
];

export const adDistrictColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'country', title: '国家/地区', width: 140 },
  { key: 'ad_platform', title: '广告平台', width: 120 },
  { key: 'user_count', title: '用户数', width: 100 },
  { key: 'show_count', title: '展示', width: 100 },
  { key: 'click_count', title: '点击', width: 100 },
  { key: 'income', title: '收益', width: 120 },
];

export const adPlanColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'campaign_id', title: '广告系列ID', width: 140 },
  { key: 'campaign_name', title: '广告系列名称', width: 180 },
  { key: 'adset_id', title: '广告组ID', width: 140 },
  { key: 'adset_name', title: '广告组名称', width: 180 },
  { key: 'ad_id', title: '广告ID', width: 140 },
  { key: 'ad_name', title: '广告名称', width: 180 },
  { key: 'cost', title: '消耗', width: 100 },
  { key: 'income', title: '收益', width: 100 },
  { key: 'roi', title: 'ROI', width: 100 },
];

export const adUserColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'uid', title: 'UID', width: 120 },
  { key: 'ad_platform', title: '广告平台', width: 120 },
  { key: 'show_count', title: '展示', width: 100 },
  { key: 'click_count', title: '点击', width: 100 },
  { key: 'income', title: '收益', width: 120 },
];

export const iapColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'stat_cost', title: '消耗', width: 110 },
  { key: 'total_amount', title: '总充值', width: 120 },
  { key: 'vip_amount', title: '会员充值', width: 120 },
  { key: 'normal_amount', title: '普通充值', width: 120 },
  { key: 'in_link_user_count', title: '进链接人数', width: 120 },
  { key: 'in_link_user_reg_count', title: '新用户数', width: 110 },
  { key: 'order_count', title: '订单数', width: 100 },
  { key: 'order_user_count', title: '下单人数', width: 110 },
  { key: 'sub_user_count', title: '订阅人数', width: 110 },
  { key: 'pay_rate', title: '付费率', width: 100 },
  { key: 'roi', title: 'ROI', width: 100 },
  { key: 'roi1', title: 'ROI1', width: 100 },
  { key: 'roi2', title: 'ROI2', width: 100 },
  { key: 'roi3', title: 'ROI3', width: 100 },
  { key: 'roi7', title: 'ROI7', width: 100 },
  { key: 'roi15', title: 'ROI15', width: 100 },
  { key: 'roi30', title: 'ROI30', width: 100 },
];

export const iapPlanColumns: ReportColumn[] = [
  { key: 'stat_day', title: '日期', width: 120 },
  { key: 'campaign_id', title: '广告系列ID', width: 140 },
  { key: 'campaign_name', title: '广告系列名称', width: 180 },
  { key: 'adset_id', title: '广告组ID', width: 140 },
  { key: 'adset_name', title: '广告组名称', width: 180 },
  { key: 'ad_id', title: '广告ID', width: 140 },
  { key: 'ad_name', title: '广告名称', width: 180 },
  { key: 'stat_cost', title: '消耗', width: 100 },
  { key: 'total_amount', title: '充值', width: 100 },
  { key: 'roi', title: 'ROI', width: 100 },
];
