import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, List, Space, Tag, message } from 'antd';
import {
  layoutApi,
  sealApi,
  odocLayoutContentUrl,
  type OdocLayoutFile,
  type OdocSeal,
  type OdocVersion,
} from '@/services/workflow';
import LayoutFileViewer from './LayoutFileViewer';

interface OdocLayoutSealProps {
  docId?: any;
  currentVersion?: OdocVersion;
  locked?: boolean;
}

const sealStatusLabel = ['待签', '已签', '已验', '已撤销'];

/**
 * 版式 / 电子签章面板（L2）。未装配对应 SPI 时（available=false）整体不渲染，
 * 前端自动停留 L1——与后端降级口径一致。
 */
const OdocLayoutSeal: React.FC<OdocLayoutSealProps> = ({ docId, currentVersion, locked }) => {
  const [layoutAvail, setLayoutAvail] = useState(false);
  const [sealAvail, setSealAvail] = useState(false);
  const [layouts, setLayouts] = useState<OdocLayoutFile[]>([]);
  const [seals, setSeals] = useState<OdocSeal[]>([]);
  const [preview, setPreview] = useState<{ id: any; format: number } | null>(null);

  const reload = useCallback(async (id: any) => {
    if (!id) return;
    const [la, sa, lf, sl] = await Promise.all([
      layoutApi.available().catch(() => false),
      sealApi.available().catch(() => false),
      layoutApi.list(id).catch(() => []),
      sealApi.list(id).catch(() => []),
    ]);
    setLayoutAvail(!!la);
    setSealAvail(!!sa);
    setLayouts(lf || []);
    setSeals(sl || []);
  }, []);

  useEffect(() => {
    if (docId) {
      reload(docId);
    } else {
      setLayouts([]);
      setSeals([]);
    }
  }, [docId, reload]);

  const toLayout = async (format: number) => {
    if (!currentVersion?.id) {
      message.warning('请先保存一个正文版本');
      return;
    }
    try {
      await layoutApi.to(docId, currentVersion.id, format);
      message.success('已生成版式文件');
      reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '转换失败');
    }
  };

  const sign = async (layoutFileId: any) => {
    try {
      await sealApi.sign(docId, layoutFileId, { sealType: 2 });
      message.success('签章完成');
      reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '签章失败');
    }
  };

  const verify = async (sealId: any) => {
    try {
      const r = await sealApi.verify(sealId);
      message.success(r?.status === 2 ? '验章通过' : '验章完成');
      reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '验章失败');
    }
  };

  if (!docId || (!layoutAvail && !sealAvail)) {
    return null;
  }

  return (
    <Card size="small" title="版式 / 电子签章（L2）" style={{ marginTop: 8 }}>
      {layoutAvail && (
        <Space wrap style={{ marginBottom: 8 }}>
          <Button onClick={() => toLayout(12)} disabled={locked}>
            转 PDF
          </Button>
          <Button onClick={() => toLayout(13)} disabled={locked}>
            转 OFD
          </Button>
        </Space>
      )}
      {layouts.length > 0 && (
        <List
          size="small"
          dataSource={layouts}
          renderItem={(lf) => (
            <List.Item
              actions={[
                <a key="pv" onClick={() => setPreview({ id: lf.id, format: lf.format || 12 })}>
                  预览
                </a>,
                <a key="dl" href={odocLayoutContentUrl(lf.id)} target="_blank">
                  下载
                </a>,
                sealAvail && !locked ? (
                  <a key="sg" onClick={() => sign(lf.id)}>
                    签章
                  </a>
                ) : null,
              ].filter(Boolean) as any}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag>{lf.format === 13 ? 'OFD' : 'PDF'}</Tag>
                    {lf.vendor || ''}
                  </Space>
                }
                description={`layoutStage=${lf.layoutStage ?? '-'}`}
              />
            </List.Item>
          )}
        />
      )}
      {seals.length > 0 && (
        <List
          size="small"
          header={<b>签章记录</b>}
          dataSource={seals}
          renderItem={(s) => (
            <List.Item
              actions={[
                <a key="vf" onClick={() => verify(s.id)}>
                  验章
                </a>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={s.status === 2 ? 'green' : 'blue'}>
                      {sealStatusLabel[s.status || 0]}
                    </Tag>
                    {s.algorithm || ''} {s.certSn || ''}
                  </Space>
                }
                description={s.verifyResult || (s.signTime ? `签于 ${s.signTime}` : '')}
              />
            </List.Item>
          )}
        />
      )}
      <LayoutFileViewer
        open={!!preview}
        layoutFileId={preview?.id}
        format={preview?.format}
        onClose={() => setPreview(null)}
      />
    </Card>
  );
};

export default OdocLayoutSeal;
