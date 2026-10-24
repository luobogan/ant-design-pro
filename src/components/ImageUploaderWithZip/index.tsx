import React, { useState, useEffect } from 'react';
import { Upload, Button, Modal, message, Form, Space, Tag, Tooltip, Checkbox, Popover, Select } from 'antd';
import { PlusOutlined, LoadingOutlined, EyeOutlined, FileImageOutlined, SettingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import ZipImagePreview from '@/components/ZipImagePreview';
import type { ZipImageInfo } from '@/components/ZipImagePreview';
import { getTenantId, getToken } from '@/utils/authority';
import { getFileConfig, resolveFileUrl, type FileStorageConfig } from '@/services/file';

export interface ImageUploaderWithZipProps {
  name?: string;
  label?: string;
  value?: number | null;
  onChange?: (value: number | null) => void;
  multiple?: boolean;
  maxCount?: number;
  accept?: string;
  maxSize?: number;
  uploadUrl?: string;
  supportDrag?: boolean;
  showPreview?: boolean;
  showProgress?: boolean;
  width?: string;
  height?: number;
  required?: boolean;
  loading?: boolean;
  useLocalUpload?: boolean;
  returnBase64?: boolean;
  uploadParams?: Record<string, string>;
  tenantId?: string;
  imageInfo?: ZipImageInfo | null;
  /** 目标服务（后端 blade-file 通用上传组件） */
  service?: string;
  /** 是否展示「上传选项」面板（压缩 / 加密 / 存储方式） */
  showOptions?: boolean;
  /** 默认是否打包 ZIP（不传则取服务端 /file/config 默认值） */
  defaultNeedZip?: boolean;
  /** 默认是否 AES 加密 */
  defaultNeedEncrypt?: boolean;
}

const ImageUploaderWithZip: React.FC<ImageUploaderWithZipProps> = ({
  name,
  label,
  value,
  onChange,
  multiple = false,
  maxCount = 1,
  accept = '.jpg,.jpeg,.png',
  maxSize = 10,
  uploadUrl = '/api/blade-mall/admin/upload/image',
  supportDrag = true,
  showPreview = true,
  showProgress = true,
  width = '100%',
  height = 120,
  required = false,
  loading = false,
  useLocalUpload = false,
  returnBase64 = true,
  uploadParams,
  tenantId: propTenantId,
  imageInfo: propImageInfo,
  service = 'blade-mall',
  showOptions = true,
  defaultNeedZip,
  defaultNeedEncrypt,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [zipPreviewVisible, setZipPreviewVisible] = useState(false);
  const [currentImageInfo, setCurrentImageInfo] = useState<ZipImageInfo | null>(null);
  // 上传选项（压缩 / 加密 / 存储方式）
  const [fileConfig, setFileConfig] = useState<FileStorageConfig | undefined>();
  const [needZip, setNeedZip] = useState<boolean>(!!defaultNeedZip);
  const [needEncrypt, setNeedEncrypt] = useState<boolean>(!!defaultNeedEncrypt);
  const [storage, setStorage] = useState<'LOCAL' | 'OSS'>('LOCAL');

  useEffect(() => {
    let mounted = true;
    getFileConfig(service).then((cfg) => {
      if (!mounted || !cfg) return;
      setFileConfig(cfg);
      if (defaultNeedZip === undefined) setNeedZip(cfg.defaultNeedZip);
      if (defaultNeedEncrypt === undefined) setNeedEncrypt(cfg.defaultNeedEncrypt);
      setStorage(cfg.defaultStorage);
    });
    return () => {
      mounted = false;
    };
  }, [service, defaultNeedZip, defaultNeedEncrypt]);

  useEffect(() => {
    if (value && fileList.length === 0) {
      if (propImageInfo) {
        const file: UploadFile = {
          uid: `existing-${Date.now()}`,
          name: propImageInfo.filename || 'image.jpg',
          status: 'done' as const,
          url: propImageInfo.url,
        };
        setFileList([file]);
      }
    } else if (!value) {
      setFileList([]);
    }
  }, [value, propImageInfo]);

  const validateFile = (file: UploadFile): boolean => {
    const isLtMaxSize = file.size ? file.size / 1024 / 1024 < maxSize : true;
    if (!isLtMaxSize) {
      message.error(`图片大小不能超过 ${maxSize}MB！`);
      return false;
    }

    const fileName = file.name ? file.name.toLowerCase() : '';
    const fileExtension = fileName.split('.').pop();
    const allowedExtensions = accept.split(',').map((ext) => ext.replace('.', ''));

    const isAllowedExtension =
      fileExtension && allowedExtensions.includes(fileExtension);
    const isAllowedMimeType = file.type && accept.includes(file.type);

    if (!isAllowedExtension && !isAllowedMimeType) {
      message.error(`只能上传 ${accept} 格式的图片！`);
      return false;
    }

    return true;
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;

    if (!validateFile(file as UploadFile)) {
      onError?.(new Error('文件验证失败'));
      return;
    }

    setUploadLoading(true);

    try {
      if (useLocalUpload) {
        const reader = new FileReader();
        reader.onload = () => {
          const fileUrl = reader.result as string;
          message.success('图片上传成功！');
          onSuccess?.({ url: fileUrl, data: fileUrl });
        };
        reader.onerror = () => {
          message.error('图片读取失败！');
          onError?.(new Error('文件读取失败'));
        };
        reader.readAsDataURL(file as any);
      } else {
        const formData = new FormData();
        formData.append('file', file as any);
        // 统一上传组件的可选项：压缩（ZIP）/ 加密（AES）/ 存储方式
        if (fileConfig?.allowZip !== false) {
          formData.append('needZip', String(needZip));
        }
        if (fileConfig?.allowEncrypt !== false) {
          formData.append('needEncrypt', String(needEncrypt));
        }
        if (fileConfig?.allowStorageSwitch !== false && fileConfig?.ossAvailable) {
          formData.append('storage', storage);
        }

        if (uploadParams) {
          Object.entries(uploadParams).forEach(([key, value]) => {
            formData.append(key, value);
          });
        }

        const token = getToken() || '';
        const uploadTenantId = propTenantId || getTenantId() || '000000';

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
            'Blade-Auth': `bearer ${token}`,
            'Tenant-Id': uploadTenantId,
          },
          body: formData,
        });

        const result = await response.json();

        if (result.success && result.data) {
          const imageData = result.data;

          if (imageData.id) {
            if (onChange) {
              onChange(imageData.id);
            }

            setCurrentImageInfo({
              id: imageData.id,
              filename: imageData.filename || file.name,
              url: resolveFileUrl(imageData.url, imageData.id, service),
              filesize: imageData.filesize || 0,
              filetype: imageData.filetype || '',
              iszip: imageData.isZip ? 1 : 0,
              encrypt: imageData.isEncrypt || false,
            });
          }

          message.success('图片上传成功！');
          onSuccess?.({ id: imageData.id, data: imageData });
        } else {
          message.error(result.msg || '图片上传失败！');
          onError?.(new Error('上传失败'));
        }
      }
    } catch (error) {
      message.error('图片上传失败！');
      onError?.(error as Error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList);
  };

  const handleRemove: UploadProps['onRemove'] = () => {
    setFileList([]);
    if (onChange) {
      onChange(null);
    }
    return true;
  };

  const handleZipPreview = () => {
    if (propImageInfo) {
      setCurrentImageInfo(propImageInfo);
      setZipPreviewVisible(true);
    } else if (currentImageInfo) {
      setZipPreviewVisible(true);
    }
  };

  const uploadButton = (
    <div
      style={{
        width: '100%',
        height: height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed #d9d9d9',
        borderRadius: '4px',
      }}
    >
      {uploadLoading ? (
        <LoadingOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
      ) : (
        <PlusOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
      )}
      <div style={{ marginTop: '8px' }}>点击或拖拽上传</div>
      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
        支持 {accept} 格式，不超过 {maxSize}MB
      </div>
    </div>
  );

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload
            name="file"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={{
              showPreviewIcon: true,
              showRemoveIcon: true,
              showDownloadIcon: false,
            }}
            customRequest={handleUpload}
            onChange={handleChange}
            onRemove={handleRemove}
            multiple={multiple}
            maxCount={maxCount}
            accept={accept}
            fileList={fileList}
            disabled={loading}
          >
            {fileList.length < maxCount && uploadButton}
          </Upload>

          {(propImageInfo || currentImageInfo) && (
            <Tooltip title="查看ZIP压缩包中的图片">
              <Button
                icon={<EyeOutlined />}
                onClick={handleZipPreview}
                type="primary"
                ghost
                size="small"
              >
                预览图片
              </Button>
            </Tooltip>
          )}

          {(propImageInfo?.iszip === 1 || currentImageInfo?.iszip === 1) && (
            <Tag color="blue" icon={<FileImageOutlined />}>
              ZIP压缩
            </Tag>
          )}

          {showOptions && (
            <Tooltip title="上传选项：压缩 / 加密 / 存储方式">
              <Popover
                content={
                  <div style={{ width: 220 }}>
                    <Checkbox
                      checked={needZip}
                      disabled={fileConfig?.allowZip === false}
                      onChange={(e) => setNeedZip(e.target.checked)}
                    >
                      压缩（打包为 ZIP）
                    </Checkbox>
                    <br />
                    <Checkbox
                      checked={needEncrypt}
                      disabled={fileConfig?.allowEncrypt === false}
                      onChange={(e) => setNeedEncrypt(e.target.checked)}
                    >
                      加密（AES）
                    </Checkbox>
                    <div style={{ marginTop: 8 }}>
                      <Select
                        size="small"
                        style={{ width: '100%' }}
                        value={storage}
                        disabled={
                          fileConfig?.allowStorageSwitch === false || !fileConfig?.ossAvailable
                        }
                        onChange={(v) => setStorage(v)}
                        options={[
                          { label: '本地存储', value: 'LOCAL' },
                          {
                            label: '对象存储（OSS）',
                            value: 'OSS',
                            disabled: !fileConfig?.ossAvailable,
                          },
                        ]}
                      />
                    </div>
                  </div>
                }
                trigger="click"
                placement="bottomLeft"
              >
                <Button icon={<SettingOutlined />} size="small" />
              </Popover>
            </Tooltip>
          )}
        </div>

        {(propImageInfo || currentImageInfo) && (
          <div style={{
            padding: '8px 12px',
            background: '#f5f5f5',
            borderRadius: 4,
            fontSize: 12,
            color: '#666',
          }}>
            <Space wrap>
              <span>
                文件名：<strong>{propImageInfo?.filename || currentImageInfo?.filename}</strong>
              </span>
              {propImageInfo?.filesize && (
                <span>
                  大小：{formatFileSize(propImageInfo.filesize)}
                </span>
              )}
              {propImageInfo?.iszip === 1 && (
                <Tag color="blue">ZIP压缩</Tag>
              )}
              {propImageInfo?.encrypt && (
                <Tag color="orange">已加密</Tag>
              )}
            </Space>
          </div>
        )}
      </Space>

      <ZipImagePreview
        visible={zipPreviewVisible}
        imageInfo={currentImageInfo || propImageInfo || null}
        onClose={() => setZipPreviewVisible(false)}
      />
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export default ImageUploaderWithZip;
