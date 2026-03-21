import React, { useState, useEffect } from 'react';
import { Upload, Button, Modal, message, Form } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { ImageUploaderProps } from './types';

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
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  useEffect(() => {
    if (value) {
      if (Array.isArray(value)) {
        const files: UploadFile[] = value.map((url, index) => ({
          uid: `existing-${index}-${Date.now()}`,
          name: `image-${index}.jpg`,
          status: 'done',
          url,
        }));
        setFileList(files);
      } else {
        const file: UploadFile = {
          uid: `existing-${Date.now()}`,
          name: 'image.jpg',
          status: 'done',
          url: value,
        };
        setFileList([file]);
      }
    } else {
      setFileList([]);
    }
  }, [value]);

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

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;

    if (!validateFile(file as UploadFile)) {
      onError?.(new Error('文件验证失败'));
      return;
    }

    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file as any);

      const token = localStorage.getItem('sword-token') || '';

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
          'Blade-Auth': `bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        const fileUrl = result.data.link || result.data.url || result.data;
        message.success('图片上传成功！');
        onSuccess?.({ url: fileUrl, data: fileUrl });
      } else {
        message.error(result.msg || '图片上传失败！');
        onError?.(new Error('上传失败'));
      }
    } catch (error) {
      message.error('图片上传失败！');
      onError?.(error as Error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleChange: UploadProps['onChange'] = (info) => {
    const processedFileList = info.fileList.map((file) => {
      if (file.status === 'done') {
        if (!file.url && file.response && file.response.data) {
          return {
            ...file,
            url:
              file.response.data.link ||
              file.response.data.url ||
              file.response.data,
          };
        }
      }
      return file;
    });

    setFileList(processedFileList);

    const urls = processedFileList
      .filter((file) => file.status === 'done' && file.url)
      .map((file) => file.url as string);

    if (onChange) {
      if (multiple) {
        onChange(urls);
      } else {
        onChange(urls[0] || '');
      }
    }
  };

  const handlePreview = (file: UploadFile) => {
    if (file.url) {
      setPreviewImage(file.url);
      setPreviewVisible(true);
    } else {
      message.warning('无法预览此图片');
    }
  };

  const handleRemove: UploadProps['onRemove'] = (file) => {
    const newFileList = fileList.filter((item) => item.uid !== file.uid);
    setFileList(newFileList);

    const urls = newFileList
      .filter((file) => file.status === 'done' && file.url)
      .map((file) => file.url as string);

    if (onChange) {
      if (multiple) {
        onChange(urls);
      } else {
        onChange(urls[0] || '');
      }
    }

    return true;
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
      {label && (
        <Form.Item
          label={label}
          name={name}
          rules={
            required ? [{ required: true, message: `请上传${label}` }] : []
          }
        >
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
        </Form.Item>
      )}

      {!label && (
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
      )}

      <Modal
        open={previewVisible}
        title="图片预览"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <img alt="预览图片" style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </div>
  );
};

export default ImageUploader;
