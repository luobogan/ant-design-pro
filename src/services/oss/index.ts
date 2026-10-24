/**
 * 对象存储配置服务（对标 BladeX blade_oss）
 *
 * 后端：blade-resource OssController（/api/blade-resource/oss/*）
 */
import { request } from '@umijs/max';

const BASE = '/api/blade-resource/oss';

/** 分类定义（value 与后端 blade_oss.category 一致）；当前仅开放 七牛云 / 本地存储 */
export const OSS_CATEGORIES = [
  { value: 'qiniu', label: '七牛云' },
  { value: 'local', label: '本地存储' },
] as const;

export interface OssConfigItem {
  id?: string;
  category?: string;
  ossCode?: string;
  endpoint?: string;
  domain?: string;
  bucketName?: string;
  accessPolicy?: number;
  accessKey?: string;
  secretKey?: string;
  region?: string;
  remark?: string;
  status?: number;
  /** 以下为本地存储(local)专属字段 */
  imageDir?: string;
  fileDir?: string;
  backupDir?: string;
  backupCycle?: number;
  compressEnable?: number | boolean;
  encryptEnable?: number | boolean;
}

interface BladePage<T> {
  success?: boolean;
  msg?: string;
  data: { records: T[]; total: number; size: number; current: number };
}

interface BladeResult<T = any> {
  success?: boolean;
  msg?: string;
  data: T;
}

/** 分页查询 */
export async function pageOssConfig(params: Record<string, any>): Promise<BladePage<OssConfigItem>> {
  return request<BladePage<OssConfigItem>>(`${BASE}/list`, { method: 'GET', params });
}

/** 详情 */
export async function getOssConfigDetail(params: { id: string }): Promise<BladeResult<OssConfigItem>> {
  return request<BladeResult<OssConfigItem>>(`${BASE}/detail`, { method: 'GET', params });
}

/** 新增或修改 */
export async function submitOssConfig(data: OssConfigItem): Promise<BladeResult<boolean>> {
  return request<BladeResult<boolean>>(`${BASE}/submit`, { method: 'POST', data });
}

/** 删除（逻辑删除） */
export async function removeOssConfig(ids: string): Promise<BladeResult<boolean>> {
  return request<BladeResult<boolean>>(`${BASE}/remove`, {
    method: 'POST',
    params: { ids },
  });
}

/** 启用配置（同一租户仅一条生效） */
export async function activeOssConfig(id: string): Promise<BladeResult<boolean>> {
  return request<BladeResult<boolean>>(`${BASE}/active`, {
    method: 'POST',
    params: { id },
  });
}

/** accessKey 脱敏展示 */
export function maskAccessKey(ak?: string): string {
  if (!ak) return '-';
  if (ak.length <= 6) return ak;
  return `${ak.slice(0, 3)}${'*'.repeat(Math.max(ak.length - 6, 5))}${ak.slice(-3)}`;
}
