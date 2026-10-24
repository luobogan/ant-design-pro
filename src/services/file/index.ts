import { request } from '@umijs/max';
import { getTenantId, getToken } from '@/utils/authority';
import type {
  BladeResponse,
  FileStorageConfig,
  FileUploadResult,
  UploadFileOptions,
} from './typings';

export type { BladeResponse, FileStorageConfig, FileUploadResult, UploadFileOptions };

/**
 * 通用文件服务（后端 blade-file，各业务服务同构暴露 /file/**）
 *
 * - 默认走 blade-resource（统一文件服务）；
 * - 业务内上传可显式传 service（如 blade-mall / blade-doc / blade-workflow / blade-portal）；
 * - 上传统一使用原生 fetch + FormData（umi request 无 multipart 封装）。
 */
export const DEFAULT_FILE_SERVICE = 'blade-resource';

const apiBase = (service: string) => `/api/${service}`;

/** 统一的文件下载地址（任意服务均可按 fileId 下载） */
export const buildDownloadUrl = (fileId: number | string, service: string = DEFAULT_FILE_SERVICE) =>
  `${apiBase(service)}/file/download/${fileId}`;

/** 统一的外链地址（OSS 场景） */
export const buildLinkUrl = (fileId: number | string, service: string = DEFAULT_FILE_SERVICE) =>
  `${apiBase(service)}/file/link/${fileId}`;

/**
 * 读取上传能力配置：默认压缩/加密、是否允许切换存储方式、OSS 是否可用
 */
export async function getFileConfig(
  service: string = DEFAULT_FILE_SERVICE,
): Promise<FileStorageConfig | undefined> {
  try {
    const response = await request<BladeResponse<FileStorageConfig>>(
      `${apiBase(service)}/file/config`,
      { method: 'GET' },
    );
    return response?.data;
  } catch (e) {
    return undefined;
  }
}

/**
 * 上传文件（统一上传组件）
 *
 * @param file    待上传文件
 * @param options 可选项：压缩（needZip）/ 加密（needEncrypt）/ 存储方式（storage）
 * @param service 目标服务（默认统一文件服务）
 */
export async function uploadFile(
  file: File,
  options: UploadFileOptions = {},
  service: string = DEFAULT_FILE_SERVICE,
): Promise<FileUploadResult | undefined> {
  const form = new FormData();
  form.append('file', file);
  if (options.dir) form.append('dir', options.dir);
  if (options.needZip !== undefined) form.append('needZip', String(options.needZip));
  if (options.needEncrypt !== undefined) form.append('needEncrypt', String(options.needEncrypt));
  if (options.storage) form.append('storage', options.storage);
  if (options.comefrom) form.append('comefrom', options.comefrom);

  const token = getToken() || '';
  const tenantId = getTenantId() || '000000';
  const res = await fetch(`${apiBase(service)}/file/upload`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic c2FiZXI6c2FiZXJfc2VjcmV0',
      'Blade-Auth': `bearer ${token}`,
      'Tenant-Id': tenantId,
    },
    body: form,
  });
  const json: BladeResponse<FileUploadResult> = await res.json();
  if (json && json.success && json.data) {
    return json.data;
  }
  throw new Error(json?.msg || '文件上传失败');
}

/**
 * 删除附件
 */
export async function deleteFile(
  fileId: number | string,
  service: string = DEFAULT_FILE_SERVICE,
): Promise<boolean> {
  const response = await request<BladeResponse<boolean>>(`${apiBase(service)}/file/delete/${fileId}`, {
    method: 'POST',
  });
  return !!response?.data;
}

/**
 * 归一化后端返回的附件地址
 *
 * 后端统一返回服务内相对路径（如 /file/download/123），这里补齐服务前缀，
 * 使其在浏览器侧可直接访问（OSS 场景返回的是完整外链，原样透传）。
 */
export function resolveFileUrl(
  url: string | undefined,
  fileId?: number | string,
  service: string = DEFAULT_FILE_SERVICE,
): string {
  if (!url) {
    return fileId !== undefined && fileId !== null ? buildDownloadUrl(fileId, service) : '';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/')) {
    return url;
  }
  if (url.startsWith('/file/')) {
    return `${apiBase(service)}${url}`;
  }
  return url;
}
/**
 * 业务兼容：按旧结构返回上传结果（id/url/filename/filesize/isZip）
 */
export function toLegacyUploadResult(
  result: FileUploadResult,
  service: string = DEFAULT_FILE_SERVICE,
) {
  return {
    id: result.id,
    url: result.url || buildDownloadUrl(result.id, service),
    filename: result.filename,
    filesize: result.filesize,
    iszip: result.isZip ? 1 : 0,
    isEncrypt: !!result.isEncrypt,
    storage: result.storage,
  };
}