/** 页面与版本弹层使用同一按钮权限，角色编码不进入页面判断。 */
export function resourceCapabilities(has: (codes: string[]) => boolean) {
  const manage = has(['res:content:manage']);
  return {
    manage,
    upload: manage || has(['res:content:upload']),
    download: manage || has(['res:content:download']),
    authorize: manage || has(['res:download:authorize']),
  };
}
