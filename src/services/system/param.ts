import { request } from '@umijs/max';
import { pickPayload } from '@/utils/utils';
import { API_BASE_PATH, APPLICATION_SYSTEM_NAME } from '@/constants';

export interface ParamItem {
  id?: number | string;
  paramName?: string;
  paramKey?: string;
  paramValue?: string;
  remark?: string;
  tenantId?: number | string;
  [key: string]: any;
}

const PARAM_BASE_URL = `${API_BASE_PATH}/${APPLICATION_SYSTEM_NAME}/param`;

/**
 * 公开读取参数值（登录页等无需登录场景使用，对应后端 /param/public-value）。
 * 按租户隔离：传入 tenantId 读取该租户的开关值。
 * 返回参数为字符串值，未配置时返回 null/undefined。
 */
export async function getParamPublicValue(
  paramKey: string,
  tenantId: string = '000000',
): Promise<string | null | undefined> {
  const res = await request(
    `${PARAM_BASE_URL}/public-value?paramKey=${encodeURIComponent(
      paramKey,
    )}&tenantId=${encodeURIComponent(tenantId)}`,
  );
  return pickPayload(res);
}

/** 按参数键查询详情（需管理员权限） */
export async function getParamDetail(
  paramKey: string,
): Promise<ParamItem | undefined> {
  const res = await request(
    `${PARAM_BASE_URL}/detail?paramKey=${encodeURIComponent(paramKey)}`,
  );
  return pickPayload(res);
}

/** 新增或修改参数（需管理员权限） */
export async function saveParam(data: ParamItem): Promise<any> {
  const res = await request(`${PARAM_BASE_URL}/submit`, {
    method: 'POST',
    data,
  });
  return pickPayload(res);
}
