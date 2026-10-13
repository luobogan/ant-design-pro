import React from 'react';
import { Button, Modal, Space } from 'antd';
import { odocLayoutContentUrl } from '@/services/workflow';

interface LayoutFileViewerProps {
  open: boolean;
  layoutFileId?: any;
  /** 12PDF 13OFD */
  format?: number;
  onClose: () => void;
}

/**
 * 版式文件查看器：按 format 分发。
 * - PDF(12)：浏览器原生渲染（iframe）。
 * - OFD(13)：需信创 OFD 阅读器控件（另行集成），此处提供下载入口。
 */
const LayoutFileViewer: React.FC<LayoutFileViewerProps> = ({ open, layoutFileId, format, onClose }) => {
  const url = layoutFileId != null ? odocLayoutContentUrl(layoutFileId) : '';
  const isPdf = format === 12;
  return (
    <Modal
      open={open}
      title={isPdf ? '版式预览（PDF）' : '版式文件（OFD）'}
      onCancel={onClose}
      footer={null}
      width="82%"
      style={{ top: 24 }}
    >
      {layoutFileId == null ? (
        <p>无可预览的版式文件</p>
      ) : isPdf ? (
        <iframe src={url} style={{ width: '100%', height: '72vh', border: 'none' }} title="pdf-preview" />
      ) : (
        <div>
          <p>OFD 需专用阅读器控件（信创环境集成）。可先下载查看：</p>
          <Space>
            <Button type="primary" href={url} target="_blank">
              下载 OFD
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default LayoutFileViewer;
