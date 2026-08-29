import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetOnline = '/adm/stat/online',
}
export type StatsData = {
  allOrder: number;
  allOrder_rmb: number;
  blanketOrder: number;
  blanketRegister: number;
  buyVip: number;
  numberOfOnlineUsers: number;
  numberOfOnlineUsers_hy: number;
  numberOfOnlineUsers_qk: number;
  rmb_today_new_money: number;
  rmb_today_plus_money: number;
  rmb_today_sub_money: number;
  rmb_totale: number;
  rmb_yesterday_new_money: number;
  rmb_yesterday_plus_money: number;
  rmb_yesterday_sub_money: number;
  short_play_all: number;
  short_play_all_SevenDays: number;
  short_play_all_thirtyDays: number;
  short_play_all_today: number;
  short_play_en: number;
  short_play_en_SevenDays: number;
  short_play_en_thirtyDays: number;
  short_play_en_today: number;
  short_play_fr: number;
  short_play_fr_SevenDays: number;
  short_play_fr_thirtyDays: number;
  short_play_fr_today: number;
  short_play_it: number;
  short_play_it_SevenDays: number;
  short_play_it_thirtyDays: number;
  short_play_it_today: number;
  short_play_ja: number;
  short_play_ja_SevenDays: number;
  short_play_ja_thirtyDays: number;
  short_play_ja_today: number;
  short_play_ko: number;
  short_play_ko_SevenDays: number;
  short_play_ko_thirtyDays: number;
  short_play_ko_today: number;
  short_play_vi: number;
  short_play_vi_SevenDays: number;
  short_play_vi_thirtyDays: number;
  short_play_vi_today: number;
  short_play_zh: number;
  short_play_zh_hk: number;
  short_play_zh_hk_SevenDays: number;
  short_play_zh_hk_thirtyDays: number;
  short_play_zh_hk_today: number;
  short_play_zh_SevenDays: number;
  short_play_zh_thirtyDays: number;
  short_play_zh_today: number;
  today_new_money: number;
  today_plus_money: number;
  today_sub_money: number;
  todaycost: string;
  todaycost_rmb: number;
  todayRecharge: number;
  todayRecharge_rmb: number;
  todayVip: number;
  todayVip_rmb: number;
  totalcost: string;
  totalcost_rmb: number;
  totale: number;
  updated_at: string;
  uv: number;
  uv_hy: number;
  uv_qk: number;
  validVip: number;
  yesterday_new_money: number;
  yesterday_plus_money: number;
  yesterday_rmb_totale: number;
  yesterday_sub_money: number;
  yesterday_totale: number;
  Yesterday_uv: number;
  yesterdaycost: string;
  yesterdaycost_rmb: number;
  yesterdayRecharge: number;
  yesterdayRecharge_rmb: number;
  yesterdayVip: number;
  yesterdayVip_rmb: number;
};

type DataStatistics = {
  list: StatsData;
};

/**
 * @description: Get user menu based on id
 */

export const getOnline = () => {
  return defHttp.get<any>({ url: Api.GetOnline });
};
// 获取统计数据
export const getDataStatistics = () => {
  return defHttp.get<DataStatistics>({ url: '/admin/home/data_statistics' });
};
// 消耗和充值
export const getRechargeExpand = (params: any) => {
  return defHttp.get<any>({ url: '/admin/home/recharge_expend', params });
};

// 充值剧排行-top3
export const getRechargeShortTop = (params: any) => {
  return defHttp.get<any>({ url: '/admin/home/recharge_short_top', params });
};

// 充值短剧排行
export const getRechargeShortList = (params: any) => {
  return defHttp.get<any>({ url: '/admin/home/recharge_short_list', params });
};

// 多语言短剧榜单
export const getLangRechargeShortList = (params: any) => {
  return defHttp.get<any>({
    url: '/admin/home/shore_play_watch_total_list',
    params,
  });
};

// 新增用户统计
export const getNewUserChart = (params: any) => {
  return defHttp.get<any>({ url: '/admin/home/new_users_chart', params });
};
// 订单量
export const getOrderEchart = (params: any) => {
  return defHttp.get<any>({ url: '/admin/home/order_e_chart', params });
};
// 用户占比
export const getUserShare = (params: any) => {
  return defHttp.get<any>({ url: '/admin/home/user_share_e_chart', params });
};
