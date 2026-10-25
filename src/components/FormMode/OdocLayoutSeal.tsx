import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Divider, List, Space, Tag, message } from 'antd';
import {
  layoutApi,
  sealApi,
  odocEsignApi,
  odocLayoutContentUrl,
  type OdocLayoutFile,
  type OdocSeal,
  type OdocSealStatus,
  type OdocVersion,
} from '@/services/workflow';
import LayoutFileViewer from './LayoutFileViewer';

interface OdocLayoutSealProps {
  docId?: any;
  currentVersion?: OdocVersion;
  locked?: boolean;
}

const sealStatusLabel = ['待签', '已签', '已验', '已撤销'];

/** 第三方签署状态配色 */
const esignStatusColor = (status?: number) => {
  switch (status) {
    case 1:
      return 'blue';
    case 2:
      return 'green';
    case 4:
    case 5:
      return 'red';
    case 9:
      return 'volcano';
    default:
      return 'default';
  }
};

/**
 * 版式 / 电子签章面板（L2）。未装配对应 SPI 时（available=false）整体不渲染，
 * 前端自动停留 L1——与后端降级口径一致。
 *
 * <p>同时承载「第三方电子签章（e签宝）」的签署状态与「去签署」入口：
 * 状态来源 {@code GET /odoc/esign/status?docId=}，发起/归档由后端流程接线自动完成。</p>
 */
const OdocLayoutSeal: React.FC<OdocLayoutSealProps> = ({ docId, currentVersion, locked }) => {
  const [layoutAvail, setLayoutAvail] = useState(false);
  const [sealAvail, setSealAvail] = useState(false);
  const [layouts, setLayouts] = useState<OdocLayoutFile[]>([]);
  const [seals, setSeals] = useState<OdocSeal[]>([]);
  const [esign, setEsign] = useState<OdocSealStatus | null>(null);
  const [preview, setPreview] = useState<{ id: any; format: number } | null>(null);

  const reload = useCallback(async (id: any) => {
    if (!id) return;
    const [la, sa, lf, sl, es] = await Promise.all([
      layoutApi.available().catch(() => false),
      sealApi.available().catch(() => false),
      layoutApi.list(id).catch(() => []),
      sealApi.list(id).catch(() => []),
      odocEsignApi.status(id).catch(() => null),
    ]);
    setLayoutAvail(!!la);
    setSealAvail(!!sa);
    setLayouts(lf || []);
    setSeals(sl || []);
    setEsign((es?.data || null) as OdocSealStatus | null);
  }, []);

  useEffect(() => {
    if (docId) {
      reload(docId);
    } else {
      setLayouts([]);
      setSeals([]);
      setEsign(null);
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

  // 仅本地版式/CA 都不可用且没有第三方签署流程时整体不渲染（前端自动停留 L1）
  if (!docId || (!layoutAvail && !sealAvail && !esign)) {
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
                <a
                  key="dl"
                  onClick={async () => {
                    const u = await odocLayoutContentUrl(lf.id);
                    if (u) window.open(u, '_blank');
                  }}
                >
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
      {esign && esign.signStatus != null && (
        <>
          <Divider orientation="left" plain>
            第三方签署（e签宝）
          </Divider>
          <Space wrap>
            <Tag color={esignStatusColor(esign.signStatus)}>{esign.signStatusText || '未发起'}</Tag>
            {esign.signUrl && (
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  if (esign.signUrl) window.open(esign.signUrl, '_blank');
                }}
              >
                去签署
              </Button>
            )}
            {esign.finished && <Tag color="green">签署件已归档</Tag>}
            {esign.esignFlowId && (
              <span style={{ color: '#8c8c8c', fontSize: 12 }}>流程号 {esign.esignFlowId}</span>
            )}
          </Space>
        </>
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
