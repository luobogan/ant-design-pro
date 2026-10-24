import { FileTextOutlined, UploadOutlined, SettingOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Button, Checkbox, Flex, Popover, Select, Tag, Upload, theme } from 'antd';
import { useEffect, useState } from 'react';
import { getFileConfig, resolveFileUrl, uploadFile, type FileStorageConfig } from '@/services/file';
import type { AttachmentMeta } from '../data';

interface Props {
  value?: AttachmentMeta[];
  onChange?: (value: AttachmentMeta[]) => void;
  /** 目标服务（后端 blade-file 通用上传组件） */
  service?: string;
  /** 业务目录 */
  dir?: string;
}

/**
 * 附件上传：走后端统一上传组件（blade-file）
 *
 * - 端点：POST {service}/file/upload
 * - 可选项：压缩（打包 ZIP）/ 加密（AES）/ 存储方式（本地、对象存储）
 * - 返回元数据回传后端（fileId 为统一附件ID，fileUrl 为统一下载地址）
 */
export default function AttachmentUpload({
  value = [],
  onChange,
  service = 'blade-resource',
  dir = 'message',
}: Props) {
  const { token } = theme.useToken();
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState<FileStorageConfig | undefined>();
  const [needZip, setNeedZip] = useState(false);
  const [needEncrypt, setNeedEncrypt] = useState(false);
  const [storage, setStorage] = useState<'LOCAL' | 'OSS'>('LOCAL');

  useEffect(() => {
    let mounted = true;
    getFileConfig(service).then((cfg) => {
      if (!mounted || !cfg) return;
      setConfig(cfg);
      setNeedZip(cfg.defaultNeedZip);
      setNeedEncrypt(cfg.defaultNeedEncrypt);
      setStorage(cfg.defaultStorage);
    });
    return () => {
      mounted = false;
    };
  }, [service]);

  const customRequest: UploadProps['customRequest'] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    setUploading(true);
    try {
      const result = await uploadFile(
        file as unknown as File,
        {
          dir,
          needZip: config?.allowZip === false ? false : needZip,
          needEncrypt: config?.allowEncrypt === false ? false : needEncrypt,
          storage: config?.allowStorageSwitch === false ? undefined : storage,
          comefrom: 'message',
        },
        service,
      );
      const meta: AttachmentMeta = {
        fileId: result?.id != null ? String(result.id) : '',
        fileUrl: resolveFileUrl(result?.url, result?.id, service),
        fileName: result?.filename || (file as any).name,
        fileSize: result?.filesize ?? (file as any).size,
        fileType: result?.contentType || (file as any).type,
      };
      onChange?.([...value, meta]);
      onSuccess?.(meta);
    } catch (e) {
      onError?.(e as any);
    } finally {
      setUploading(false);
    }
  };

  const optionsPanel = (
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
    <Flex align="center" gap={8} wrap>
      <Upload multiple showUploadList={false} customRequest={customRequest as any} disabled={uploading}>
        <UploadOutlined style={{ fontSize: 18, color: token.colorPrimary, cursor: 'pointer' }} />
      </Upload>
      <Popover content={optionsPanel} trigger="click" placement="bottomLeft">
        <Button size="small" type="text" icon={<SettingOutlined />} />
      </Popover>
      {value.map((a, i) => (
        <Tag
          key={a.fileId || i}
          color="blue"
          closable
          onClose={() => onChange?.(value.filter((_, idx) => idx !== i))}
        >
          <FileTextOutlined /> {a.fileName || a.fileId}
        </Tag>
      ))}
    </Flex>
  );
}