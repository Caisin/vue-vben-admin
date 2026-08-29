import { AuditLogApi } from '#/api/system/audit-log';

export const getOpLogList = async (params: any) => {
  const page = await AuditLogApi.list({
    api_path_prefix: params?.path ?? params?.['path.starts_with'],
    method: params?.op_type ?? params?.['op_type.eq'],
    page: params?.page,
    size: params?.pageSize ?? params?.page_size,
    uid: params?.uid ?? params?.['uid.eq'],
  });
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      in_time: item.created_at,
      ip: item.remote_ip,
      op_type: item.method,
      path: item.api_path,
    })),
  };
};
