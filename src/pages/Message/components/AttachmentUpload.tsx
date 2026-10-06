import { FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Flex, Tag, Upload, theme } from 'antd';
import { useState } from 'react';
import { getTenantId } from '@/utils/authority';
import type { AttachmentMeta } from '../data';

interface Props {
  value?: AttachmentMeta[];
  onChange?: (value: AttachmentMeta[]) => void;
}

/**
 * 附件上传：前端直传 blade-resource（OSS put-file），仅将元数据回传后端。
 */
export default function AttachmentUpload({ value = [], onChange }: Props) {
  const { token } = theme.useToken();
  const [uploading, setUploading] = useState(false);

  const customRequest: UploadProps['customRequest'] = ({
    file,
    onSuccess,
    onError,
  }) => {
    const token = localStorage.getItem('sword-token') || '';
    const formData = new FormData();
    formData.append('file', file as Blob);
    setUploading(true);
    fetch('/api/blade-resource/oss/endpoint/put-file', {
      method: 'POST',
      headers: {
        Authorization: 'Basic c2FiZXI6c2FiZXJfc2VjcmV0',
        'Blade-Auth': `bearer ${token}`,
        'Tenant-Id': getTenantId() || '',
      },
      body: formData,
    })
      .then((r) => r.json())
      .then((res) => {
        const data = res?.data;
        const meta: AttachmentMeta = {
          fileId: data?.id ?? String(data?.link ?? ''),
          fileUrl: data?.link || data?.url,
          fileName: (file as any).name,
          fileSize: (file as any).size,
          fileType: (file as any).type,
        };
        onChange?.([...value, meta]);
        onSuccess?.(meta);
      })
      .catch((e) => onError?.(e as any))
      .finally(() => setUploading(false));
  };

  return (
    <Flex align="center" gap={8} wrap>
      <Upload
        multiple
        showUploadList={false}
        customRequest={customRequest as any}
        disabled={uploading}
      >
        <UploadOutlined
          style={{ fontSize: 18, color: token.colorPrimary, cursor: 'pointer' }}
        />
      </Upload>
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
