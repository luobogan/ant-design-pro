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
}
