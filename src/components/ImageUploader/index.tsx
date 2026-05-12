import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Modal, Spin, App } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { ImageUploaderProps, UploadResult, ImageValue } from './types';
import { getTenantId } from '@/utils/authority';

/**
 * fetchImageAsBlob 的"settle-once"封装
 * 确保：
 *   1. 整个操作（含 response.blob()）在 timeoutMs 内必定 settle
 *   2. controller.abort() 在收到响应头后也能中断 response.blob()
 *   3. 外部 signal 触发时同样 settle 并清除定时器
 */
const fetchImageAsBlob = (
  url: string,
  token: string,
  tenantId: string,
  signal?: AbortSignal,
  timeoutMs: number = 30000,
): Promise<string | null> => {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const controller = new AbortController();

    // 定时器：超时后 abort controller → 中断 fetch 和 blob()
    const timerId = setTimeout(() => {
      console.warn(`[ImageUploader] fetch 超时（${timeoutMs}ms）:`, url);
      controller.abort();
      settle(null);
    }, timeoutMs);

    // 外部 signal 触发时：清除定时器、abort、settle
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timerId);
        controller.abort();
        settle(null);
        return;
      }
      signal.addEventListener('abort', () => {
        clearTimeout(timerId);
        controller.abort();
        settle(null);
      });
    }

    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
        'Blade-Auth': `bearer ${token}`,
        'Tenant-Id': tenantId,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timerId);
        if (!response.ok) {
          console.warn('[ImageUploader] fetch图片失败:', response.status, url);
          settle(null);
          return;
        }
        // 此处若 controller 已被 abort，blob() 会抛出 AbortError
        const blob = await response.blob();
        settle(URL.createObjectURL(blob));
      })
      .catch((err: any) => {
        clearTimeout(timerId);
        if (err?.name !== 'AbortError') {
          console.warn('[ImageUploader] fetch图片异常:', err?.message || err, url);
        }
        settle(null);
      });
  });
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

  // AbortController：用于取消正在进行的 fetch 请求（防止竞态+连接泄漏）
  const abortRef = useRef<AbortController | null>(null);

  // 标记：上传回显进行中（防止 useEffect 覆盖 handleChange 正在处理的 fileList）
  const uploadEchoRef = useRef(false);

  // 使用 App 上下文（替代静态 message/Modal，支持动态主题）
  const { message: messageApi } = App.useApp();

  /**
   * 取消当前所有进行中的 fetch 请求
   */
  const cancelPendingFetches = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  /**
   * 创建新的 AbortController 并取消旧的
   */
  const createNewAbortController = useCallback((): AbortController => {
    cancelPendingFetches();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, [cancelPendingFetches]);

  // 清理 blob URL 内存 + 取消进行中的 fetch
  useEffect(() => {
    return () => {
      cancelPendingFetches(); // 组件卸载时取消所有进行中的fetch
      blobUrlsRef.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (_e) { /* ignore */ }
      });
      blobUrlsRef.current.clear();
    };
  }, [cancelPendingFetches]);

  /**
   * 安全地创建并追踪 blob URL
   */
  const trackBlobUrl = useCallback((blobUrl: string): string => {
    blobUrlsRef.current.add(blobUrl);
    return blobUrl;
  }, []);

  /**
   * 判断 URL 是否需要通过带认证的 fetch 转为 blob URL
   */
  const needsBlobConversion = useCallback((rawUrl: string): boolean => {
    if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return false;
    if (rawUrl.includes('/file/download/') || rawUrl.includes('/api/')) return true;
    if (rawUrl.startsWith('/')) return true;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return false;
    return true;
  }, []);

  /**
   * 将普通 URL 转为 blob URL（带认证）
   */
  const convertToBlobUrl = useCallback(
    async (rawUrl: string, signal?: AbortSignal): Promise<string | undefined> => {
      if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
        return rawUrl;
      }
      if (!needsBlobConversion(rawUrl)) {
        return rawUrl;
      }
      const token = localStorage.getItem('sword-token') || '';
      const uploadTenantId = propTenantId || getTenantId() || '000000';
      const blobUrl = await fetchImageAsBlob(rawUrl, token, uploadTenantId, signal, 30000);
      if (blobUrl) {
        return trackBlobUrl(blobUrl);
      }
      return rawUrl;
    },
    [propTenantId, trackBlobUrl, needsBlobConversion]
  );

  useEffect(() => {
    console.log('[ImageUploader] value effect 触发, value:', value, 'prevValue:', prevValueRef.current, 'uploadEcho:', uploadEchoRef.current);
    if (uploadEchoRef.current) { console.log('[ImageUploader] uploadEchoRef 为 true，跳过'); return; }
    // 强制每次 value 变化都执行，去掉 isSameValue 优化
    prevValueRef.current = value;
    const controller = createNewAbortController();

    const buildFileList = async () => {
      if (Array.isArray(value)) {
        const validItems = value.filter((item) => item != null && item !== '');
        if (validItems.length === 0) {
          setFileList([]);
          return;
        }
        const placeholderFiles: UploadFile[] = validItems.map((item, index) => {
          let url: string = '';
          let id: string | number | undefined;
          if (typeof item === 'string') {
            url = item;
          } else {
            url = (item as ImageValue).url || '';
            id = (item as ImageValue).id;
          }
          const f = {
            uid: `existing-${index}-${Date.now()}`,
            name: `image-${index}.jpg`,
            status: 'uploading' as const,
            url: '',
            response: id ? { data: { id } } : undefined,
            _rawUrl: url,
          } as any as UploadFile;
          return f;
        });
        setFileList(placeholderFiles);

        for (let i = 0; i < placeholderFiles.length; i++) {
          const f = placeholderFiles[i];
          if (controller.signal.aborted) break;
          if (f._rawUrl && !f._rawUrl.startsWith('blob:')) {
            const blobUrl = await convertToBlobUrl(f._rawUrl, controller.signal);
            if (controller.signal.aborted) break;
            if (blobUrl && blobUrl !== f._rawUrl) {
              setFileList((prev) =>
                prev.map((item) =>
                  item.uid === f.uid
                    ? { ...item, url: blobUrl, status: 'done' as const }
                    : item
                )
              );
            } else {
              setFileList((prev) =>
                prev.map((item) =>
                  item.uid === f.uid
                    ? { ...item, url: f._rawUrl, status: 'done' as const }
                    : item
                )
              );
            }
          } else {
            setFileList((prev) =>
              prev.map((item) =>
                item.uid === f.uid
                  ? { ...item, url: f._rawUrl, status: 'done' as const }
                  : item
              )
            );
          }
        }
      } else if (value !== '' && value != null) {
        let url: string = '';
        let id: string | number | undefined;
        if (typeof value === 'string') {
          url = value;
        } else {
          url = (value as ImageValue).url || '';
          id = (value as ImageValue).id;
        }
        const file: UploadFile = {
          uid: `existing-${Date.now()}`,
          name: 'image.jpg',
          status: 'uploading' as const,
          url: '',
          response: id ? { data: { id } } : undefined,
          _rawUrl: url,
        } as any as UploadFile;
        setFileList([file]);

        if (!url.startsWith('blob:') && !url.startsWith('data:')) {
          const blobUrl = await convertToBlobUrl(url, controller.signal);
          if (!controller.signal.aborted && blobUrl) {
            setFileList((prev) =>
              prev.map((f) => (f.uid === file.uid ? { ...f, url: blobUrl, status: 'done' } : f))
            );
          } else if (!controller.signal.aborted) {
            setFileList((prev) =>
              prev.map((f) => (f.uid === file.uid ? { ...f, url, status: 'done' } : f))
            );
          }
        } else {
          setFileList((prev) =>
            prev.map((f) => (f.uid === file.uid ? { ...f, url, status: 'done' } : f))
          );
        }
      } else {
        setFileList([]);
      }
    };

    buildFileList();

    return () => {
      controller.abort();
    };
  }, [value, convertToBlobUrl, createNewAbortController]);

  // ==================== 文件验证 ====================
  const validateFile = (file: UploadFile) => {
    const isLtMaxSize = file.size ? file.size / 1024 / 1024 < maxSize : true;
    if (!isLtMaxSize) {
      messageApi.error(`图片大小不能超过 ${maxSize}MB！`);
      return false;
    }
    const fileName = file.name ? file.name.toLowerCase() : '';
    const fileExtension = fileName.split('.').pop();
    const allowedExtensions = accept.split(',').map((ext) => ext.replace('.', ''));
    const isAllowedExtension =
      fileExtension && allowedExtensions.includes(fileExtension);
    const isAllowedMimeType = file.type && accept.includes(file.type);
    if (!isAllowedExtension && !isAllowedMimeType) {
      messageApi.error(`只能上传 ${accept} 格式的图片！`);
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
          messageApi.success('图片上传成功！');
          onSuccess?.({ url: fileUrl, data: fileUrl });
        };
        reader.onerror = () => {
          messageApi.error('图片读取失败！');
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
        const uploadController = new AbortController();
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
            'Blade-Auth': `bearer ${token}`,
            'Tenant-Id': uploadTenantId,
          },
          body: formData,
          signal: uploadController.signal,
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
            messageApi.success('图片上传成功！');
            if (returnObject && fileId) {
              onSuccess?.({
                url: fileUrl,
                data: { id: fileId, url: fileUrl, isZip },
              });
            } else {
              onSuccess?.({ url: fileUrl, data: fileUrl });
            }
          } else {
            messageApi.error('图片上传失败！');
            onError?.(new Error('上传失败'));
          }
        } else {
          messageApi.error(result.msg || '图片上传失败！');
          onError?.(new Error('上传失败'));
        }
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        messageApi.error('图片上传失败！');
        onError?.(error as Error);
      }
    } finally {
      setUploadLoading(false);
    }
  };

  // ==================== 上传完成后：转换为 blob URL 显示 ====================
  const handleChange: UploadProps['onChange'] = (info) => {
    let pendingEchoCount = 0;
    const processedFileList = info.fileList.map((file) => {
      if (file.status === 'done') {
        if (!file.url && file.response && file.response.data) {
          uploadEchoRef.current = true;
          pendingEchoCount++;

          let fileUrl: string;
          let fileId: string | number | undefined;
          if (typeof file.response.data === 'string') {
            fileUrl = file.response.data;
          } else {
            fileUrl = file.response.data.link || file.response.data.url || '';
            fileId = file.response.data.id;
          }
          if (fileUrl) {
            file.url = '';
            const token = localStorage.getItem('sword-token') || '';
            const uploadTenantId = propTenantId || getTenantId() || '000000';
            const changeController = new AbortController();

            fetchImageAsBlob(fileUrl, token, uploadTenantId, changeController.signal, 30000)
              .then((blobUrl) => {
                pendingEchoCount--;
                if (pendingEchoCount <= 0) uploadEchoRef.current = false;
                if (changeController.signal.aborted) return;
                if (blobUrl) {
                  const trackedUrl = trackBlobUrl(blobUrl);
                  setFileList((prev) => {
                    const updated = prev.map((f) => (f.uid === file.uid ? { ...f, url: trackedUrl } : f));
                    triggerOnChange(updated);
                    return updated;
                  });
                } else {
                  setFileList((prev) => {
                    const updated = prev.map((f) => (f.uid === file.uid ? { ...f, url: fileUrl, status: 'done' } : f));
                    triggerOnChange(updated);
                    return updated;
                  });
                }
              })
              .catch((err: any) => {
                pendingEchoCount--;
                if (pendingEchoCount <= 0) uploadEchoRef.current = false;
                console.warn('[ImageUploader] handleChange: fetch转blob异常', err?.name, err?.message);
                setFileList((prev) => {
                  const updated = prev.map((f) => (f.uid === file.uid ? { ...f, url: fileUrl, status: 'done' } : f));
                  triggerOnChange(updated);
                  return updated;
                });
              });
          } else {
            pendingEchoCount--;
            if (pendingEchoCount <= 0) uploadEchoRef.current = false;
          }
        }
      }
      return file;
    });
    setFileList(processedFileList);
    triggerOnChange(processedFileList);
  };

  // ==================== 预览 ====================
  const previewAbortRef = useRef<AbortController | null>(null);

  const handlePreview = async (file: UploadFile) => {
    if (file.url) {
      const needFetch =
        (file.response?.data?.isZip) ||
        (file.url.includes('/file/download/') && !file.url.startsWith('blob:'));
      if (needFetch) {
        if (previewAbortRef.current) {
          previewAbortRef.current.abort();
        }
        const controller = new AbortController();
        previewAbortRef.current = controller;
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
            signal: controller.signal,
          });
          if (response.ok) {
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            const imageUrl = URL.createObjectURL(blob);
            setPreviewImage(imageUrl);
            setPreviewVisible(true);
          } else {
            if (!controller.signal.aborted) {
              messageApi.warning('无法预览此图片');            }
          }
        } catch (error: any) {
          if (error?.name !== 'AbortError' && !controller.signal.aborted) {
            messageApi.warning('预览失败');
          }
        }
      } else {
        setPreviewImage(file.url);
        setPreviewVisible(true);
      }
    } else {
      messageApi.warning('无法预览此图片');
    }
  };

  // ==================== 删除 ====================
  const handleRemove: UploadProps['onRemove'] = (file) => {
    if (file.url && file.url.startsWith('blob:')) {
      try { URL.revokeObjectURL(file.url); } catch (_e) { /* ignore */ }
      blobUrlsRef.current.delete(file.url);
    }
    const newFileList = fileList.filter((item) => item.uid !== file.uid);
    setFileList(newFileList);
    triggerOnChange(newFileList);
    return true;
  };

  // ==================== 统一触发 onChange ====================
  const getServerUrl = (file: UploadFile): string | undefined => {
    if (file.response?.data) {
      if (typeof file.response.data === 'string') return file.response.data;
      return file.response.data.link || file.response.data.url;
    }
    if (file.url && !file.url.startsWith('blob:')) return file.url;
    return undefined;
  };

  const triggerOnChange = (currentFileList: UploadFile[]) => {
    if (!onChange) return;
    if (returnObject) {
      const values = currentFileList
        .filter((file) => file.status === 'done')
        .map((file) => {
          let id: string | number | undefined;
          let isZip = false;
          if (file.response && typeof file.response.data === 'object') {
            id = file.response.data.id;
            isZip = file.response.data.isZip || false;
          }
          const url = getServerUrl(file) || '';
          return { id, url, isZip };
        });
      if (multiple) {
        onChange(values);
      } else {
        onChange(values[0] || undefined);
      }
    } else {
      const urls = currentFileList
        .filter((file) => file.status === 'done')
        .map((file) => getServerUrl(file))
        .filter((url): url is string => !!url);
      if (multiple) {
        onChange(urls);
      } else {
        onChange(urls[0] || '');
      }
    }
  };

  // ==================== 自定义缩略图渲染 ====================
  const customItemRender: UploadProps['itemRender'] = (
    originNode: React.ReactNode,
    file: UploadFile,
    currFileList: UploadFile[],
  ) => {
    if (!file || file.status === 'uploading' || !file.url) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        </div>
      );
    }
    return originNode as React.ReactElement;
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
        itemRender={customItemRender}
      >
        {fileList.length < maxCount && uploadButton}
      </Upload>

      <Modal
        open={previewVisible}
        title="图片预览"
        footer={null}
        onCancel={() => {
          if (previewImage && previewImage.startsWith('blob:')) {
            try { URL.revokeObjectURL(previewImage); } catch (_e) { /* ignore */ }
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
