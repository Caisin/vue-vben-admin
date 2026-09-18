import './runtime-polyfills';

/**
 * 应用初始化完成之后再进行页面加载渲染
 */
async function initApplication() {
  // 兼容补丁先执行，再加载可能在模块初始化时使用新 API 的框架依赖。
  const [
    { initPreferences, updatePreferences },
    { unmountGlobalLoading },
    { initDesktop },
    { overridesPreferences },
  ] = await Promise.all([
    import('@vben/preferences'),
    import('@vben/utils'),
    import('./desktop'),
    import('./preferences'),
  ]);

  // name用于指定项目唯一标识
  // 用于区分不同项目的偏好设置以及存储数据的key前缀以及其他一些需要隔离的数据
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const namespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  // app偏好设置初始化
  await initPreferences({
    namespace,
    overrides: overridesPreferences,
  });
  // 固定产品级设置，避免历史偏好缓存继续使用旧首页或压缩表格页面。
  updatePreferences({
    app: { contentCompact: 'wide', defaultHomePath: '/user-overview' },
  });

  await initDesktop();

  // 启动应用并挂载
  // vue应用主要逻辑及视图
  const { bootstrap } = await import('./bootstrap');
  await bootstrap(namespace);

  // 移除并销毁loading
  unmountGlobalLoading();
}

void initApplication().catch(async (error: unknown) => {
  const { unmountGlobalLoading } = await import('@vben/utils');
  unmountGlobalLoading();
  const box = document.createElement('div');
  box.style.cssText = 'padding:32px;max-width:720px;margin:auto';
  const text = document.createElement('p');
  text.textContent = `应用初始化失败，请检查系统凭据库或服务连接后重试：${String(error)}`;
  const retry = document.createElement('button');
  retry.textContent = '重新加载';
  retry.addEventListener('click', () => window.location.reload());
  box.append(text, retry);
  document.body.append(box);
});
