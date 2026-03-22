import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

export interface ImageUploaderProps {
  name?: string;
  label?: string;
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
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
}
