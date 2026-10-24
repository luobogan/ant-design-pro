/** 通用上传/下载组件（后端 blade-file）相关类型 */

/** 后端统一返回包装 */
export interface BladeResponse<T = unknown> {
  code: number;
  success: boolean;
  data?: T;
  msg?: string;
}

/** 存储方式 */
export type FileStorageType = 'LOCAL' | 'OSS';

/** 上传结果（后端 FileUploadResult） */
export interface FileUploadResult {
  id: number | string;
  filename: string;
  contentType?: string;
  filesize?: number;
  storage?: FileStorageType;
  path?: string;
  url?: string;
  downloadUrl?: string;
  isZip?: boolean;
  isEncrypt?: boolean;
  aesCode?: string;
  tenantId?: string;
}

/** 上传能力配置（后端 FileStorageConfigVO） */
export interface FileStorageConfig {
  enabled: boolean;
  defaultStorage: FileStorageType;
  ossAvailable: boolean;
  defaultNeedZip: boolean;
  defaultNeedEncrypt: boolean;
  allowZip: boolean;
  allowEncrypt: boolean;
  allowStorageSwitch: boolean;
  maxSize: number;
  allowedExtensions?: string[];
}

/** 单次上传可选项（前端按次指定） */
export interface UploadFileOptions {
  /** 业务目录 */
  dir?: string;
  /** 是否打包为 ZIP（任意类型附件均生效） */
  needZip?: boolean;
  /** 是否 AES 加密 */
  needEncrypt?: boolean;
  /** 存储方式 */
  storage?: FileStorageType;
  /** 附件来源标识 */
  comefrom?: string;
}