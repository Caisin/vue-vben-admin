import { createSkuApi } from './_shared';

const api = createSkuApi('ios');

export const getList = api.getList;
export const getListNoPage = api.getListNoPage;
export const postSave = api.postSave;
export const postDelete = api.postDelete;
