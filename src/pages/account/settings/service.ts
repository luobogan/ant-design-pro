import { request } from '@umijs/max';
import { getCityOptions, provinceOptions } from '@/utils/chinaDivision';
import type { CurrentUser, GeographicItemType } from './data';

export async function queryCurrent(): Promise<{ data: CurrentUser }> {
  // 原 demo 接口 /api/accountSettingCurrentUser 在 SpringBlade 后端不存在（404）。
  // 改为复用真实的当前用户接口，并防御性解包（响应可能是 {data} 或直接是用户对象）。
  const res: any = await request('/api/blade-system/user/info');
  const user = res?.data ?? res;
  return { data: (user ?? {}) as CurrentUser };
}

export async function queryProvince(): Promise<GeographicItemType[]> {
  // 后端无 geographic 接口，改用本地行政区划数据，避免 404
  return provinceOptions;
}

export async function queryCity(
  province: string,
): Promise<GeographicItemType[]> {
  // 后端无 geographic 接口，改用本地行政区划数据，避免 404
  return getCityOptions(province);
}
