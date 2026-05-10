import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Modal, message } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { ImageUploaderProps, UploadResult, ImageValue } from './types';
import { getTenantId } from '@/utils/authority';

/**
 * 通过 fetch 带认证头获取图片，转为 blob URL
 * 解决 <img> 标签无法携带 blade-auth header 导致的 401 问题
 */
const fetchImageAsBlob = async (
  url: string,
  token: string,
  tenantId: string
): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
        'Blade-Auth': `bearer ${token}`,
        'Tenant-Id': tenantId,
      },
    });

    if (!response.ok) {
      console.warn('[ImageUploader] fetch图片失败:', response.status, url);
      return null;
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('[ImageUploader] fetch图片异常:', error);
    return null;
  }
};

const ImageUploader: React.FC<ImageUploaderProps> = ({
  name,
  label,
  value,
  onChange,
  multiple = false,
  maxCount = 1,
  accept = '.jpg,.jpeg,.png',
  maxSize = 2,
  uploadUrl = '/api/blade-resource/oss/endpoint/put-file',
  supportDrag = true,
  showPreview = true,
  showProgress = true,
  width = '100%',
  height = 120,
  required = false,
  loading = false,
  useLocalUpload = false,
  returnBase64 = true,
  returnObject = false,
  uploadParams,
  tenantId: propTenantId,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const prevValueRef = useRef(value);

  // 追踪所有创建的 blob URL，用于组件卸载时释放内存
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // 清理 blob URL 内存
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  /**
   * 安全地创建并追踪 blob URL
   */
  const trackBlobUrl = useCallback((blobUrl: string): string => {
    blobUrlsRef.current.add(blobUrl);
    return blobUrl;
  }, []);

  /**
   * 将普通 URL 转为 blob URL（带认证）
   * 用于初始化回显和上传后的图片加载
   */
  const convertToBlobUrl = useCallback(
    async (file: UploadFile, rawUrl: string): Promise<string | undefined> => {
      // 已经是 blob URL 或 base64，无需转换
      if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
        return rawUrl;
      }

      // 非下载接口的 URL（如外部 CDN），直接使用
      if (!rawUrl.includes('/file/download/') && !rawUrl.includes('/api/')) {
        return rawUrl;
      }

      const token = localStorage.getItem('sword-token') || '';
      const uploadTenantId = propTenantId || getTenantId() || '000000';

      const blobUrl = await fetchImageAsBlob(rawUrl, token, uploadTenantId);

      if (blobUrl) {
        return trackBlobUrl(blobUrl);
      }
      
      // fetch 失败：返回原始 URL（可能是公开资源或白名单已放行）
      console.warn('[ImageUploader] 无法通过fetch获取图片，回退到原始URL:', rawUrl);
      return rawUrl;
    },
    [propTenantId, trackBlobUrl]
  );

  // ==================== 初始化/回显：value 变化时同步 fileList ====================
  useEffect(() => {
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;

    const buildFileList = async () => {
      if (Array.isArray(value)) {
        const files: UploadFile[] = value
          .filter((item) => item != null && item !== '')
          .map((item, index) => {
            let url: string;
            let id: string | number | undefined;
            let isZip = false;

            if (typeof item === 'string') {
              url = item;
            } else {
              url = (item as ImageValue).url || '';
              id = (item as ImageValue).id;
              isZip = (item as any).isZip || false;
            }

            return {
              uid: `existing-${index}-${Date.now()}`,
              name: `image-${index}.jpg`,
              status: 'done' as const,
              url,           // 先设原始 URL，下面异步替换为 blob URL
              response: id ? { data: { id, isZip } } : undefined,
              _rawUrl: url,  // 保存原始 URL 用于异步转换
            };
          });
        setFileList(files);

        // 异步将每个文件 URL 转为 blob URL（解决 <img> 标签 401 问题）
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f._rawUrl && !f._rawUrl.startsWith('blob:')) {
            const blobUrl = await convertToBlobUrl(f, f._rawUrl);
            if (blobUrl && blobUrl !== f._rawUrl) {
              setFileList((prev) =>
                prev.map((item) =>
                  item.uid === f.uid ? { ...item, url: blobUrl } : item
                )
              );
            }
          }
        }
      } else if (value !== '' && value != null) {
        let url: string;
        let id: string | number | undefined;
        let isZip = false;

        if (typeof value === 'string') {
          url = value;
        } else {
          url = (value as ImageValue).url || '';
          id = (value as ImageValue).id;
          isZip = (value as any).isZip || false;
        }

        const file: UploadFile = {
          uid: `existing-${Date.now()}`,
          name: 'image.jpg',
          status: 'done',
          url,
          response: id ? { data: { id, isZip } } : undefined,
          _rawUrl: url,
        };
        setFileList([file]);

        // 异步转换为 blob URL
        if (!url.startsWith('blob:')) {
          const blobUrl = await convertToBlobUrl(file, url);
          if (blobUrl && blobUrl !== url) {
            setFileList((prev) =>
              prev.map((f) => (f.uid === file.uid ? { ...f, url: blobUrl } : f))
            );
          }
        }
      } else {
        setFileList([]);
      }
    };

    buildFileList();
  }, [value, convertToBlobUrl]);

  // ==================== 文件验证 ====================
  const validateFile = (file: UploadFile) => {
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

  // ==================== 上传逻辑 ====================
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

        if (uploadParams) {
          Object.entries(uploadParams).forEach(([key, val]) => {
            formData.append(key, val);
          });
        }

        const token = localStorage.getItem('sword-token') || '';
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
          let fileUrl: string;
          let fileId: string | number | undefined;
          let isZip = false;

          if (typeof result.data === 'string') {
            fileUrl = result.data;
          } else {
            fileUrl = result.data.link || result.data.url || '';
            fileId = result.data.id;
            isZip = result.data.isZip || false;
          }

          if (fileUrl) {
            message.success('图片上传成功！');
            if (returnObject && fileId) {
              onSuccess?.({
                url: fileUrl,
                data: { id: fileId, url: fileUrl, isZip },
              });
            } else {
              onSuccess?.({ url: fileUrl, data: fileUrl });
            }
          } else {
            message.error('图片上传失败！');
            onError?.(new Error('上传失败'));
          }
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

  // ==================== 上传完成后：转换为 blob URL 显示 ====================
  const handleChange: UploadProps['onChange'] = (info) => {
    const processedFileList = info.fileList.map((file) => {
      if (file.status === 'done') {
        if (!file.url && file.response && file.response.data) {
          let fileUrl: string;
          let fileId: string | number | undefined;
          if (typeof file.response.data === 'string') {
            fileUrl = file.response.data;
          } else {
            fileUrl = file.response.data.link || file.response.data.url || '';
            fileId = file.response.data.id;
          }
          if (fileUrl) {
            file.url = fileUrl; // 先设原始 URL 立即显示

            // 异步转为 blob URL（带认证）
            const token = localStorage.getItem('sword-token') || '';
            const uploadTenantId = propTenantId || getTenantId() || '000000';

            fetchImageAsBlob(fileUrl, token, uploadTenantId)
              .then((blobUrl) => {
                if (blobUrl) {
                  const trackedUrl = trackBlobUrl(blobUrl);
                  setFileList((prev) =>
                    prev.map((f) => (f.uid === file.uid ? { ...f, url: trackedUrl } : f))
                  );
                }
              })
              .catch(() => {
                // 保持原始 URL
                console.warn('[ImageUploader] handleChange: fetch转blob失败，保持原始URL');
              });
          }
        }
      }
      return file;
    });

    setFileList(processedFileList);

    // 触发 onChange 回调
    triggerOnChange(processedFileList);
  };

  // ==================== 预览 ====================
  const handlePreview = async (file: UploadFile) => {
    if (file.url) {
      // 如果是 ZIP 文件或下载接口 URL，通过 fetch 带认证获取
      const needFetch =
        (file.response?.data?.isZip) ||
        (file.url.includes('/file/download/') && !file.url.startsWith('blob:'));

      if (needFetch) {
        const fileId = file.response?.data?.id;
        const downloadUrl = fileId
          ? `/api/blade-mall/file/download/${fileId}`
          : file.url;

        const token = localStorage.getItem('sword-token') || '';
        const uploadTenantId = propTenantId || getTenantId() || '000000';

        try {
          const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
              Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
              'Blade-Auth': `bearer ${token}`,
              'Tenant-Id': uploadTenantId,
            },
          });

          if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            setPreviewImage(imageUrl);
            setPreviewVisible(true);
            // 预览关闭后释放
            const originalOnCancel = () => setPreviewImage(imageUrl);
          } else {
            message.warning('无法预览此图片');
          }
        } catch (error) {
          message.warning('预览失败');
        }
      } else {
        setPreviewImage(file.url);
        setPreviewVisible(true);
      }
    } else {
      message.warning('无法预览此图片');
    }
  };

  // ==================== 删除 ====================
  const handleRemove: UploadProps['onRemove'] = (file) => {
    // 如果删除的是 blob URL，释放内存
    if (file.url && file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
      blobUrlsRef.current.delete(file.url);
    }

    const newFileList = fileList.filter((item) => item.uid !== file.uid);
    setFileList(newFileList);
    triggerOnChange(newFileList);
    return true;
  };

  // ==================== 统一触发 onChange ====================
  const triggerOnChange = (currentFileList: UploadFile[]) => {
    if (!onChange) return;

    if (returnObject) {
      const values = currentFileList
        .filter((file) => file.status === 'done')
        .map((file) => {
          let id: string | number | undefined;
          let url: string | undefined;
          let isZip = false;

          if (file.response && file.response.data) {
            if (typeof file.response.data === 'object') {
              id = file.response.data.id;
              url = file.response.data.link || file.response.data.url;
              isZip = file.response.data.isZip || false;
            }
          }
          url = url || file.url;

          return { id, url, isZip };
        });

      if (multiple) {
        onChange(values);
      } else {
        onChange(values[0] || undefined);
      }
    } else {
      const urls = currentFileList
        .filter((file) => file.status === 'done' && file.url)
        .map((file) => file.url as string);

      if (multiple) {
        onChange(urls);
      } else {
        onChange(urls[0] || '');
      }
    }
  };

  // ==================== 渲染 ====================
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
        onPreview={handlePreview}
        onRemove={handleRemove}
        multiple={multiple}
        maxCount={maxCount}
        accept={accept}
        fileList={fileList}
        disabled={loading}
      >
        {fileList.length < maxCount && uploadButton}
      </Upload>

      <Modal
        open={previewVisible}
        title="图片预览"
        footer={null}
        onCancel={() => {
          // 关闭预览时释放预览图 blob URL
          if (previewImage.startsWith('blob:')) {
            URL.revokeObjectURL(previewImage);
          }
          setPreviewVisible(false);
        }}
      >
        <img alt="预览图片" style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </div>
  );
};

export default ImageUploader;
