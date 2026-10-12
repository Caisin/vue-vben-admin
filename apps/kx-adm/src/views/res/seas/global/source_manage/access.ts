/** 页面、版本和章节分别检查实际动作，不从完整维护权限推导全部按钮。 */
export function resourceCapabilities(has: (codes: string[]) => boolean) {
  const api = (code: string) => has([`api:res.admin.res.${code}`]);
  return {
    create: api('version_resource.create'),
    edit: api('update_res_info.post'),
    bindCode: api('resource_code.bind'),
    category: api('set_category.res_id.post'),
    removeCategory: api('set_category.res_id.post'),
    refreshCategory: api('update_all_tags.put'),
    price: api('set_price.post'),
    ad: api('set_ad_cfg.post'),
    state: api('chg_state.res_id.post'),
    heat: api('save_res_heat.post'),
    readContent: api('versions.detail'),
    createVersion: api('versions.create'),
    updateVersion: api('versions.update'),
    deleteVersion: api('versions.delete'),
    createItem: api('versions.items.create'),
    updateItem: api('versions.items.update'),
    deleteItem: api('versions.items.delete'),
    upload: api('versions.files.upload'),
    importVideo: api('video_import.submit'),
    importNovel: api('novel_import.submit'),
    download: has(['res:content:download']),
    authorize: api('download_permissions.get'),
  };
}
