import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Button, Checkbox, Popover, Select, Space, Tooltip, message } from 'antd';
import { UploadOutlined, SettingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import {
  DEFAULT_FILE_SERVICE,
  getFileConfig,
  uploadFile,
  type FileStorageConfig,
  type FileUploadResult,
  type UploadFileOptions,
} from '@/services/file';

export interface CommonUploaderProps {
  /** 已上传的附件ID */
  value?: number | string | null;
  /** 值变化回调 */
  onChange?: (value: number | string | null, result?: FileUploadResult) => void;
  /** 目标服务（默认统一文件服务 blade-resource） */
  service?: string;
  /** 业务目录 */
  dir?: string;
  /** 允许的文件类型（accept 属性格式） */
  accept?: string;
  /** 单文件大小上限（MB） */
  maxSize?: number;
  /** 是否多选 */
  multiple?: boolean;
  /** 最多上传数量 */
  maxCount?: number;
  /** 是否展示「上传选项」面板（压缩 / 加密 / 存储方式） */
  showOptions?: boolean;
  /** 默认是否打包 ZIP */
  defaultNeedZip?: boolean;
  /** 默认是否 AES 加密 */
  defaultNeedEncrypt?: boolean;
  /** 上传列表类型 */
  listType?: 'text' | 'picture-card';
  /** 按钮文案 */
  buttonText?: string;
  /** 禁用 */
  disabled?: boolean;
}

/**
 * 通用上传组件
 *
 * 后端统一走 blade-file 通用上传组件（本地/OSS 双通道 + ZIP 打包 + AES 加密 + 元数据落库）。
 * 前端可配置项：是否启用压缩（打包 ZIP）、是否启用加密（AES）、默认上传方式（本地/对象存储）。
 * 可选项的可开放范围由服务端 /file/config 决定（allowZip / allowEncrypt / allowStorageSwitch）。
 */
const CommonUploader: React.FC<CommonUploaderProps> = ({
  value,
  onChange,
  service = DEFAULT_FILE_SERVICE,
  dir = 'common',
  accept,
  maxSize = 100,
  multiple = false,
  maxCount = 1,
  showOptions = true,
  defaultNeedZip,
  defaultNeedEncrypt,
  listType = 'text',
  buttonText = '点击或拖拽上传',
  disabled = false,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [config, setConfig] = useState<FileStorageConfig | undefined>();
  const [needZip, setNeedZip] = useState<boolean>(!!defaultNeedZip);
  const [needEncrypt, setNeedEncrypt] = useState<boolean>(!!defaultNeedEncrypt);
  const [storage, setStorage] = useState<'LOCAL' | 'OSS'>('LOCAL');

  useEffect(() => {
    let mounted = true;
    getFileConfig(service).then((cfg) => {
      if (!mounted || !cfg) return;
      setConfig(cfg);
      if (defaultNeedZip === undefined) setNeedZip(cfg.defaultNeedZip);
      if (defaultNeedEncrypt === undefined) setNeedEncrypt(cfg.defaultNeedEncrypt);
      setStorage(cfg.defaultStorage);
    });
    return () => {
      mounted = false;
    };
  }, [service, defaultNeedZip, defaultNeedEncrypt]);

  const options: UploadFileOptions = useMemo(
    () => ({
      dir,
      needZip: config?.allowZip === false ? false : needZip,
      needEncrypt: config?.allowEncrypt === false ? false : needEncrypt,
      storage: config?.allowStorageSwitch === false ? undefined : storage,
      comefrom: 'frontend',
    }),
    [dir, needZip, needEncrypt, storage, config],
  );

  const beforeUpload = (file: File) => {
    if (file.size / 1024 / 1024 > maxSize) {
      message.error(`文件大小不能超过 ${maxSize}MB！`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps['customRequest'] = async (opt) => {
    const { file, onSuccess, onError } = opt;
    const raw = file as unknown as File;
    try {
      const result = await uploadFile(raw, options, service);
      if (result?.id) {
        onChange?.(result.id, result);
        if (multiple) {
          onSuccess?.(result, new XMLHttpRequest());
        } else {
          onSuccess?.(result, new XMLHttpRequest());
        }
        message.success('上传成功！');
      } else {
        onError?.(new Error('上传失败'));
      }
    } catch (e) {
      message.error((e as Error)?.message || '上传失败！');
      onError?.(e as Error);
    }
  };

  const optionPanel = (
    <div style={{ width: 220 }}>
      <Checkbox
        checked={needZip}
        disabled={config?.allowZip === false}
        onChange={(e) => setNeedZip(e.target.checked)}
      >
        压缩（打包为 ZIP）
      </Checkbox>
      <br />
      <Checkbox
        checked={needEncrypt}
        disabled={config?.allowEncrypt === false}
        onChange={(e) => setNeedEncrypt(e.target.checked)}
      >
        加密（AES）
      </Checkbox>
      <div style={{ marginTop: 8 }}>
        <Select
          size="small"
          style={{ width: '100%' }}
          value={storage}
          disabled={config?.allowStorageSwitch === false || !config?.ossAvailable}
          onChange={(v) => setStorage(v)}
          options={[
            { label: '本地存储', value: 'LOCAL' },
            { label: '对象存储（OSS）', value: 'OSS', disabled: !config?.ossAvailable },
          ]}
        />
      </div>
    </div>
  );

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space>
        <Upload
          name="file"
          listType={listType}
          accept={accept}
          multiple={multiple}
          maxCount={maxCount}
          fileList={fileList}
          disabled={disabled}
          beforeUpload={beforeUpload}
          customRequest={customRequest}
          onChange={(info) => setFileList(info.fileList)}
          onRemove={(f) => {
            setFileList(fileList.filter((x) => x.uid !== f.uid));
            if (!multiple) onChange?.(null);
            return true;
          }}
        >
          <Button icon={<UploadOutlined />} disabled={disabled}>
            {buttonText}
          </Button>
        </Upload>
        {showOptions && (
          <Tooltip title="上传选项：压缩 / 加密 / 存储方式">
            <Popover content={optionPanel} trigger="click" placement="bottomLeft">
              <Button icon={<SettingOutlined />} />
            </Popover>
          </Tooltip>
        )}
      </Space>
      {config && (
        <div style={{ fontSize: 12, color: '#999' }}>
          默认：{config.defaultStorage === 'OSS' ? '对象存储' : '本地存储'}
          {config.defaultNeedZip ? ' · ZIP 压缩' : ''}
          {config.defaultNeedEncrypt ? ' · AES 加密' : ''}
        </div>
      )}
    </Space>
  );
};

export default CommonUploader;