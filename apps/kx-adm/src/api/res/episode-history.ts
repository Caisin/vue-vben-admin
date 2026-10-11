import type { Id } from './versions';

import { plaintextRequestClient, requestClient } from '#/api/request';
export interface EpisodeRevision {
  id: Id;
  title: string;
  duration: number;
  remark: string;
  actor_uid: Id;
  actor_name: string;
  action: string;
  reason: string;
  changes: string;
  restored_from?: Id | null;
  created_at: number;
  is_current: boolean;
  restorable?: boolean;
}
export interface EpisodeHistoryView {
  items: EpisodeRevision[];
  total: number;
  revision: number;
  can_restore: boolean;
  finalized_at?: number;
  legacy_current: boolean;
}
const root = (res: Id, version: Id, seq: number) =>
  `/adm/res/review/${res}/${version}/episodes/${seq}/history`;
export const episodeHistoryApi = {
  setState: (
    res: Id,
    version: Id,
    seq: number,
    expected_revision: number,
    finalized: boolean,
    reason: string,
  ) =>
    requestClient.put(
      `/adm/res/review/${res}/${version}/episodes/${seq}/state`,
      { expected_revision, finalized, reason },
    ),
  list: (res: Id, version: Id, seq: number, page = 1) =>
    requestClient.get<EpisodeHistoryView>(root(res, version, seq), {
      params: { page, size: 10 },
    }),
  play: async (res: Id, version: Id, seq: number, history: Id) => {
    const path = `${root(res, version, seq)}/${history}`;
    const url = await requestClient.get<string>(`${path}/play`);
    if (/^https?:\/\//i.test(url)) return url;
    return URL.createObjectURL(
      await plaintextRequestClient.download<Blob>(`${path}/content`),
    );
  },
  restore: (
    res: Id,
    version: Id,
    seq: number,
    history: Id,
    expected_revision: number,
    reason: string,
  ) =>
    requestClient.post(`${root(res, version, seq)}/${history}/restore`, {
      expected_revision,
      reason,
    }),
};
