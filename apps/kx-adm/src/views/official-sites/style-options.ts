import type { SiteConfig } from '#/api/official-sites';

interface ThemeOption {
  value: SiteConfig['theme'];
  label: string;
  detail: string;
  color: string;
  accent: string;
  layout: SiteConfig['layout'];
  sample: string;
}
export const themes: ThemeOption[] = [
  {
    value: 'guyan',
    label: '参考复刻',
    detail: '暖色背景 · 双栏应用展示',
    color: '#72574f',
    accent: '#6938ef',
    layout: 'split',
    sample: 'APP.',
  },
  {
    value: 'light',
    label: '明亮简洁',
    detail: '清爽留白 · 居中产品介绍',
    color: '#e9edfa',
    accent: '#4667db',
    layout: 'centered',
    sample: 'Hello.',
  },
  {
    value: 'cinema',
    label: '深色影院',
    detail: '全屏故事海报 · 沉浸式首幕',
    color: '#15101e',
    accent: '#d99946',
    layout: 'immersive',
    sample: 'CINEMA',
  },
  {
    value: 'editorial',
    label: '杂志故事',
    detail: '暖白纸感 · 衬线大字 · 跨栏长页',
    color: '#f6f1e7',
    accent: '#b74729',
    layout: 'magazine',
    sample: 'Stories.',
  },
  {
    value: 'neon',
    label: '霓虹科技',
    detail: '黑绿网格 · 圆角卡片 · 信息拼图',
    color: '#0d1110',
    accent: '#d5ff47',
    layout: 'mosaic',
    sample: 'NEXT_',
  },
  {
    value: 'playful',
    label: '活力拼贴',
    detail: '蓝黄撞色 · 硬边阴影 · 错落海报',
    color: '#244bdd',
    accent: '#f6dc54',
    layout: 'showcase',
    sample: 'PLAY!',
  },
];
export const layouts: {
  value: SiteConfig['layout'];
  label: string;
  detail: string;
}[] = [
  { value: 'split', label: '左右分栏', detail: '左文右图，经典应用落地页' },
  {
    value: 'centered',
    label: '居中展示',
    detail: '标题、下载和设备纵向居中，功能三列展示',
  },
  {
    value: 'showcase',
    label: '海报墙排版',
    detail: '倾斜设备首屏，截图以错落海报墙展示',
  },
  {
    value: 'magazine',
    label: '杂志长页',
    detail: '使用介绍配图作为首屏故事图，正文按侧栏与文章编排',
  },
  {
    value: 'mosaic',
    label: '卡片拼图',
    detail: '文案、设备、应用卡和截图组成拼图，功能采用卡片网格',
  },
  {
    value: 'immersive',
    label: '全屏海报',
    detail: '使用介绍配图作为全屏背景，大标题与设备叠加，横向展示大截图',
  },
];
