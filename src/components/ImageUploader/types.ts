import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

export interface UploadResult {
  id?: number | string;
  url?: string;
  filename?: string;
  filesize?: number;
  isZip?: boolean;
}

export interface ImageValue {
  id?: number | string;
  url?: string;
}

export interface ImageUploaderProps {
  name?: string;
  label?: string;
  value?: string | string[] | ImageValue | ImageValue[];
  onChange?: (value: string | string[] | ImageValue | ImageValue[]) => void;
  multiple?: boolean;
  maxCount?: number;
  accept?: string;
  maxSize?: number;
  uploadUrl?: string;
  supportDrag?: boolean;
  showPreview?: boolean;
  showProgress?: boolean;
  width?: string | number;
  height?: string | number;
  required?: boolean;
  loading?: boolean;
  useLocalUpload?: boolean;
  /**
   * 是否将 base64 图片原样返回（用于后端处理）
   * 为 true 时，上传后返回 base64 数据，由后端转换为文件路径
   */
  returnBase64?: boolean;
  /**
   * 是否返回包含 id 和 url 的对象
   * 为 true 时，上传后返回 { id, url } 对象
   */
  returnObject?: boolean;
  /**
   * 上传参数
   */
  uploadParams?: Record<string, any>;
  /**
   * 租户ID（用于上传时指定租户目录）
   * 不传则自动从当前登录用户获取
   */
  tenantId?: string;
  /**
   * 目标服务（后端 blade-file 通用上传组件；默认 blade-resource）
   */
  service?: string;
  /**
   * 是否展示「上传选项」面板（压缩 / 加密 / 存储方式）
   */
  showOptions?: boolean;
  /**
   * 默认是否打包 ZIP（不传则取服务端 /file/config 的默认值）
   */
  defaultNeedZip?: boolean;
  /**
   * 默认是否 AES 加密（不传则取服务端 /file/config 的默认值）
   */
  defaultNeedEncrypt?: boolean;
}
