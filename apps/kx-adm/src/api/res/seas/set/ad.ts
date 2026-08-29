import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/admin/ad/page',
  GetPageListNoPage = '/adm/google/list',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const getListNoPage = (params: any): any => {
  return new Promise((resolve, reject) => {
    defHttp
      .get<any>({ url: Api.GetPageListNoPage })
      .then((res) => {
        let list = res.map((item: any) => {
          let data = {
            product_id: item.product_id,
            product_name: item.product_name,
          };
          if (item.product_info) {
            data = { ...data, ...item.product_info };
          }
          return data;
        });
        if (params.item_type) {
          list = list.filter(
            (item: any) => String(item.item_type) === String(params.item_type),
          );
        }

        resolve(list);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: '/admin/ad/save', data });
};
export const postDelete = (id: any) => {
  return defHttp.delete<any>({ url: `/admin/ad/del/${id}` });
};

export const getAreaList = (params: any) => {
  return defHttp.get<any>({ url: '/params/iso_code/list', params });
};
