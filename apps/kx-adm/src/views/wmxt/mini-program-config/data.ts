export const configLinks = [
  {
    description:
      '维护任务类型、任务分类、模块编码、状态和适用对象等小程序业务选项。',
    path: '/param/dictionaries',
    title: '小程序业务字典',
  },
  {
    description:
      '维护微信小程序 app_id、app_key、app_secret、Token 与消息加解密密钥。',
    path: '/param/wechat-apps',
    title: '微信小程序登录应用',
  },
  {
    description: '维护小程序上传资料、随手拍图片和任务附件使用的对象存储配置。',
    path: '/storage/configs',
    title: '文件存储配置',
  },
  {
    description:
      '同步并审计 /wmxt、/wmxt/org、/wmxt/admin API 与按钮权限关系。',
    path: '/system/api-permissions',
    title: 'API 权限同步',
  },
  {
    description: '配置平台异步任务，查看资料打包等长耗时任务执行状态。',
    path: '/system/tasks',
    title: '任务中心',
  },
  {
    description:
      '统一维护管理端、个人端和单位端首页入口、图标、排序和跳转路径。',
    path: '/wmxt/home-entries',
    title: '首页入口配置',
  },
] as const;
