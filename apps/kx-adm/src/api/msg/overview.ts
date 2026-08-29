import type { MsgOverviewView } from './types';

import { requestClient } from '#/api/request';

export interface MsgOverviewParams {
  expires_within_days?: number;
  low_balance_threshold?: string;
}

export const MsgOverviewApi = {
  get: (params?: MsgOverviewParams) =>
    requestClient.get<MsgOverviewView>('/msg/overview', { params }),
};
