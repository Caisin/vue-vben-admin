import { expect, it } from 'vitest';

import { deliveryEpisode } from './delivery-files';
it.each([
  ['提示词/第3集/镜头1.txt', 3],
  ['EP06/截图02.png', 6],
  ['01/字幕.srt', 1],
  ['2026/作品-12.mp4', 12],
  ['视频/第7集-最终.mp4', 7],
  ['字幕.srt', 0],
  [String.raw`工程截图\第2集\截图99.png`, 2],
])('目录文件 %s 定位到集数 %s', (path, seq) => {
  expect(deliveryEpisode(path)).toBe(seq);
});
